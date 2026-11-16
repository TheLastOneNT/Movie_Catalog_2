import { normalizeProgressPatch, ValidationError } from "./progress.js";
import { averageRatedSeasons } from "../lib/series-cycles.js";
import { findDuplicateTitle, normalizeTitle } from "../lib/title-duplicates.js";
import { writeWeeklyBackup } from "./scheduled-backup.js";
import { validateBackup, bytesToBase64, base64ToBytes, BackupError, MAX_BACKUP_BYTES } from "./backup.js";

const SESSION_COOKIE = "movie_catalog_session";
const MOVIE_CATEGORIES = new Set(["movies", "series", "cartoons", "documentaries"]);
const POSTER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_POSTER_BYTES = 1_500_000;
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  for (const pair of cookie.split(";")) {
    const [key, ...parts] = pair.trim().split("=");
    if (key === name) return decodeURIComponent(parts.join("="));
  }
  return null;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function safeEqual(left, right) {
  const [leftHash, rightHash] = await Promise.all([sha256(left), sha256(right)]);
  let difference = leftHash.length ^ rightHash.length;
  for (let index = 0; index < Math.max(leftHash.length, rightHash.length); index += 1) {
    difference |= (leftHash.charCodeAt(index) || 0) ^ (rightHash.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function expectedSession(env) {
  if (!env.ACCESS_KEY) return null;
  return sha256(`movie-catalog-session:${env.ACCESS_KEY}`);
}

async function isAuthorized(request, env) {
  const expected = await expectedSession(env);
  const provided = getCookie(request, SESSION_COOKIE);
  return Boolean(expected && provided && (await safeEqual(provided, expected)));
}

function sessionCookie(value, request, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

async function readJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 20_000) throw new ValidationError("The request body is too large.");
  try {
    return await request.json();
  } catch {
    throw new ValidationError("The request body must contain valid JSON.");
  }
}

function assertSameOrigin(request, url) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) throw new Response("Forbidden", { status: 403 });
}

// Derive the visible rating at read time, so older ratings entered in a
// different order are corrected immediately after deployment (no DB migration).
// Series ratings aggregate the latest *rated* completed viewing of each
// distinct season. Ratings are not weighted by how often a season was rewatched.
// Movies keep their existing latest-calendar-date semantics.
// Ratings are derived exclusively from dated viewing records.
// A series' published rating is computed from its most recently completed
// viewing cycle. An active rewatch cannot silently overwrite the last result.
// Inside each cycle, the latest RATED viewing of each season contributes once.
const EFFECTIVE_RATING_SQL = `(
  CASE WHEN m.category='series' THEN (
    SELECT ROUND(AVG(latest.rating),1) FROM (
      SELECT sv.cycle_id, sv.rating, ROW_NUMBER() OVER (
        PARTITION BY sv.cycle_id,sv.season_number
        ORDER BY sv.finished_at DESC,sv.started_at DESC,sv.id DESC
      ) AS ranking FROM season_viewings sv
      WHERE sv.finished_at IS NOT NULL AND sv.rating IS NOT NULL
    ) latest WHERE latest.cycle_id = (
      SELECT sc.id FROM series_cycles sc
      WHERE sc.movie_id=m.id AND sc.outcome IN ('completed','stopped')
        AND EXISTS (SELECT 1 FROM season_viewings sv
          WHERE sv.cycle_id=sc.id AND sv.rating IS NOT NULL AND sv.finished_at IS NOT NULL)
      ORDER BY sc.ended_at DESC,sc.id DESC LIMIT 1
    ) AND latest.ranking=1
  ) ELSE (
    SELECT wh.rating FROM watch_history wh WHERE wh.movie_id=m.id
    ORDER BY substr(wh.watched_at,1,10) DESC,wh.id DESC LIMIT 1
  ) END
)`;
function mapMovie(row) {
  return {
    id: row.id,
    category: row.category,
    title: row.title_ru,
    titleEn: row.title_en,
    description: row.description_ru,
    descriptionEn: row.description_en,
    poster: row.poster_path,
    releaseYear: row.release_year,
    tmdbId: row.tmdb_id ?? null,
    tmdbMediaType: row.tmdb_media_type ?? null,
    genreIds: (() => { try { return JSON.parse(row.genre_ids || "[]"); } catch { return []; } })(),
    collectionOrder: row.collection_order,
    progress: {
      status: row.status === "watched" ? "watched" : "unwatched",
      rating: Object.prototype.hasOwnProperty.call(row, "effective_rating") ? row.effective_rating : row.rating,
      isFavorite: Boolean(row.is_favorite),
      lastWatchedAt: row.last_watched_at,
      watchCount: row.watch_count || 0,
      notes: row.notes || "",
      updatedAt: row.progress_updated_at,
    },
  };
}

function mapProgress(row) {
  return {
    status: row?.status === "watched" ? "watched" : "unwatched",
    rating: row?.rating ?? null,
    isFavorite: Boolean(row?.is_favorite),
    lastWatchedAt: row?.last_watched_at || null,
    watchCount: row?.watch_count || 0,
    notes: row?.notes || "",
    updatedAt: row?.updated_at || null,
  };
}

async function getProgress(env, movieId) {
  return env.DB.prepare("SELECT * FROM movie_progress WHERE movie_id = ?")
    .bind(movieId)
    .first();
}

async function listCatalog(env) {
  const [result, memberRows] = await Promise.all([
    env.DB.prepare(`
    SELECT
      m.id, m.category, m.title_ru, m.title_en, m.description_ru, m.description_en,
      m.poster_path, m.release_year, m.tmdb_id, m.tmdb_media_type, m.genre_ids, m.collection_order,
      p.status, p.rating, ${EFFECTIVE_RATING_SQL} AS effective_rating, p.is_favorite, p.last_watched_at, p.watch_count,
      p.notes, p.updated_at AS progress_updated_at
    FROM movies m
    LEFT JOIN movie_progress p ON p.movie_id = m.id
    ORDER BY m.collection_order ASC
  `).all(),
    env.DB.prepare("SELECT movie_id, member_id, rating, is_favorite, wants_to_watch, notes FROM member_progress").all(),
  ]);

  const membersByMovie = new Map();
  for (const row of memberRows.results) {
    if (!membersByMovie.has(row.movie_id)) membersByMovie.set(row.movie_id, {});
    membersByMovie.get(row.movie_id)[row.member_id] = {
      rating: row.rating, isFavorite: Boolean(row.is_favorite), wantsToWatch: Boolean(row.wants_to_watch), notes: row.notes || "",
    };
  }
  return result.results.map((row) => ({ ...mapMovie(row), members: membersByMovie.get(row.id) || {} }));
}

async function getCatalogMovie(env, movieId) {
  const row = await env.DB.prepare(`
    SELECT
      m.id, m.category, m.title_ru, m.title_en, m.description_ru, m.description_en,
      m.poster_path, m.release_year, m.tmdb_id, m.tmdb_media_type, m.genre_ids, m.collection_order,
      p.status, p.rating, ${EFFECTIVE_RATING_SQL} AS effective_rating, p.is_favorite, p.last_watched_at, p.watch_count,
      p.notes, p.updated_at AS progress_updated_at
    FROM movies m
    LEFT JOIN movie_progress p ON p.movie_id = m.id
    WHERE m.id = ?
  `).bind(movieId).first();
  if (!row) return null;
  const members = await env.DB.prepare(
    "SELECT member_id, rating, is_favorite, wants_to_watch, notes FROM member_progress WHERE movie_id = ?",
  ).bind(movieId).all();
  return { ...mapMovie(row), members: Object.fromEntries(members.results.map((entry) => [entry.member_id, {
    rating: entry.rating, isFavorite: Boolean(entry.is_favorite), wantsToWatch: Boolean(entry.wants_to_watch), notes: entry.notes || "",
  }])) };
}

async function saveNormalizedProgress(env, movieId, normalized, now) {
  if (normalized.clearHistory) {
    await env.DB.prepare("DELETE FROM watch_history WHERE movie_id = ?").bind(movieId).run();
  } else if (normalized.addHistory) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO watch_history (movie_id, watched_at) VALUES (?, ?)",
    ).bind(movieId, normalized.value.lastWatchedAt).run();
  }

  const history = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM watch_history WHERE movie_id = ?",
  ).bind(movieId).first();

  await env.DB.prepare(`
    INSERT INTO movie_progress (
      movie_id, status, rating, is_favorite, last_watched_at, watch_count, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(movie_id) DO UPDATE SET
      status = excluded.status,
      rating = excluded.rating,
      is_favorite = excluded.is_favorite,
      last_watched_at = excluded.last_watched_at,
      watch_count = excluded.watch_count,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `).bind(
    movieId,
    normalized.value.status,
    normalized.value.rating,
    normalized.value.isFavorite ? 1 : 0,
    normalized.value.lastWatchedAt,
    Number(history?.count || 0),
    normalized.value.notes,
    now,
  ).run();

  return mapProgress(await getProgress(env, movieId));
}

async function updateSharedRating(request, env, movieId) {
  const input = await readJson(request);
  if (!Object.prototype.hasOwnProperty.call(input, "rating") ||
      !(input.rating === null || (Number.isInteger(input.rating) && input.rating >= 1 && input.rating <= 5))) {
    throw new ValidationError("Shared rating must be 1–5 or null.");
  }
  const movie = await env.DB.prepare("SELECT id FROM movies WHERE id = ?").bind(movieId).first();
  if (!movie) return json({ error: "Movie not found." }, 404);
  return json({ error: "Ratings are derived from dated viewing history." }, 409);
}

async function updateProgress(request, env, movieId) {
  const movie = await env.DB.prepare("SELECT id FROM movies WHERE id = ?").bind(movieId).first();
  if (!movie) return json({ error: "Movie not found." }, 404);

  const currentRow = await getProgress(env, movieId);
  const current = mapProgress(currentRow);
  const input = await readJson(request);
  if (input.status === "unwatched" && current.watchCount > 0) {
    throw new ValidationError("Remove viewing dates individually; changing a status cannot erase history.");
  }
  const normalized = normalizeProgressPatch(input, current);
  const now = new Date().toISOString();
  return json({ progress: await saveNormalizedProgress(env, movieId, normalized, now) });
}

function optionalText(value, field, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new ValidationError(`${field} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new ValidationError(`${field} is too long.`);
  return trimmed || null;
}


function tmdbPosterUrl(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^https:\/\/image\.tmdb\.org\/t\/p\/w342\/[a-zA-Z0-9._-]+\.(jpg|jpeg|webp|png)$/i.test(value)) {
    throw new ValidationError("Invalid TMDB poster URL.");
  }
  return value;
}

async function tmdbGet(env, path, params = {}) {
  if (!env.TMDB_READ_TOKEN) throw new ValidationError("TMDB is not configured.");
  const endpoint = new URL(`https://api.themoviedb.org/3/${path}`);
  for (const [key, value] of Object.entries(params)) endpoint.searchParams.set(key, String(value));
  const response = await fetch(endpoint, {
    headers: { authorization: `Bearer ${env.TMDB_READ_TOKEN}`, accept: "application/json" },
  });
  if (!response.ok) throw new Error(`TMDB HTTP ${response.status}`);
  return response.json();
}
function tmdbImagePath(path) {
  return typeof path === "string" && /^\/[a-zA-Z0-9._-]+$/.test(path)
    ? `https://image.tmdb.org/t/p/w342${path}` : null;
}
function tmdbMediaType(category) {
  return category === "series" ? "tv" : "movie";
}
async function tmdbDetails(env, mediaType, id) {
  if (!["movie", "tv"].includes(mediaType) || !Number.isSafeInteger(id) || id < 1) throw new ValidationError("Invalid TMDB reference.");
  const path = `${mediaType}/${id}`;
  const [ru, en, images] = await Promise.all([
    tmdbGet(env, path, { language: "ru-RU" }),
    tmdbGet(env, path, { language: "en-US" }),
    tmdbGet(env, `${path}/images`),
  ]);
  const originalLanguage = /^[a-z]{2}$/.test(ru.original_language || "") ? ru.original_language : null;
  const originals = (images.posters || []).filter((image) =>
    originalLanguage && image.iso_639_1 === originalLanguage && tmdbImagePath(image.file_path)
  ).sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
  // No safe match: don't silently substitute a Russian-dubbed poster.
  const posterUrl = originals.length ? tmdbImagePath(originals[0].file_path) : null;
  const getTitle = (entry) => entry.title || entry.name || "";
  return {
    tmdbId: id, mediaType, originalLanguage,
    title: getTitle(ru),
    titleEn: getTitle(en),
    description: ru.overview || "",
    descriptionEn: en.overview || "",
    releaseYear: Number((ru.release_date || ru.first_air_date || "").slice(0, 4)) || null,
    posterUrl,
    posterAvailable: Boolean(posterUrl),
    genreIds: Array.isArray(ru.genres) ? ru.genres.map((genre) => genre.id) : [],
  };
}
async function searchTmdb(url, env) {
  if (!env.TMDB_READ_TOKEN) return json({ error: "TMDB is not configured." }, 503);
  const query = (url.searchParams.get("q") || "").trim();
  const yearText = (url.searchParams.get("year") || "").trim();
  const year = yearText ? Number(yearText) : null;
  if (yearText && (!Number.isInteger(year) || year < 1888 || year > 2200)) throw new ValidationError("Invalid search year.");
  if (query.length < 2 || query.length > 100) throw new ValidationError("Search must be 2–100 characters.");

  // A direct TMDB ID disambiguates very short titles, e.g. Home (2009) = tmdb:62320.
  const directId = query.match(/^tmdb:(\d{1,9})$/i);
  if (directId) {
    const id = Number(directId[1]);
    const data = await tmdbDetails(env, "movie", id);
    return json({ results: [{
      id, category: data.genreIds.includes(16) ? "cartoons" : data.genreIds.includes(99) ? "documentaries" : "movies",
      ...data,
    }] });
  }

  // Search the two media types separately so that movies are not crowded out by
  // person and TV matches in /search/multi, and use the year filter when supplied.
  const [movieResults, tvResults] = await Promise.all([
    tmdbGet(env, "search/movie", {
      query, language: "ru-RU", include_adult: "false", ...(year ? { year } : {}),
    }),
    tmdbGet(env, "search/tv", {
      query, language: "ru-RU", include_adult: "false", ...(year ? { first_air_date_year: year } : {}),
    }),
  ]);
  const candidates = [
    ...(movieResults.results || []).slice(0, 10).map(item => ({...item,media_type:"movie"})),
    ...(tvResults.results || []).slice(0, 6).map(item => ({...item,media_type:"tv"})),
  ];
  const resultYear = (item) => Number((item.release_date || item.first_air_date || "").slice(0,4)) || null;
  candidates.sort((a,b) => {
    if (year) return Number(resultYear(b) === year) - Number(resultYear(a) === year)
      || (b.popularity || 0) - (a.popularity || 0);
    return (b.popularity || 0) - (a.popularity || 0);
  });
  const matches = candidates.slice(0, 12);
  const results = await Promise.all(matches.map(async (item) => {
    try {
      const details = await tmdbDetails(env,item.media_type,item.id);
      return {
        id:item.id, category:item.media_type === "tv" ? "series" :
          details.genreIds.includes(16) ? "cartoons" : details.genreIds.includes(99) ? "documentaries" : "movies",
        ...details, title:details.title || item.title || item.name || "",
      };
    } catch {
      return {
        id:item.id, mediaType:item.media_type, category:item.media_type === "tv" ? "series" : "movies",
        title:item.title || item.name || "", titleEn:"", description:"", descriptionEn:"",
        releaseYear:resultYear(item), posterUrl:null,
      };
    }
  }));
  return json({ results });
}

async function listTmdbGenres(env) {
  if (!env.TMDB_READ_TOKEN) return json({genres:[]},503);
  const [ruMovie,ruTv,enMovie,enTv] = await Promise.all([
    tmdbGet(env,"genre/movie/list",{language:"ru-RU"}),tmdbGet(env,"genre/tv/list",{language:"ru-RU"}),
    tmdbGet(env,"genre/movie/list",{language:"en-US"}),tmdbGet(env,"genre/tv/list",{language:"en-US"}),
  ]);
  const merged=new Map();
  for (const genre of [...(enMovie.genres||[]),...(enTv.genres||[])]) merged.set(genre.id,{id:genre.id,en:genre.name,ru:genre.name});
  for (const genre of [...(ruMovie.genres||[]),...(ruTv.genres||[])]) {
    const existing=merged.get(genre.id);
    if(existing) existing.ru=genre.name;
    else merged.set(genre.id,{id:genre.id,en:genre.name,ru:genre.name});
  }
  return json({genres:[...merged.values()]});
}

async function listUnresolvedTmdbGenres(env) {
  const result=await env.DB.prepare(`SELECT id,title_ru AS title,title_en AS titleEn,
    release_year AS releaseYear,category
    FROM movies WHERE tmdb_id IS NULL ORDER BY collection_order`).all();
  return json({movies:result.results || []});
}

async function backfillTmdbGenres(request, env) {
  if (!env.TMDB_READ_TOKEN) return json({error:"TMDB is not configured."},503);
  const data=await readJson(request);
  const cursor=data.cursor == null ? 0 : Number(data.cursor);
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new ValidationError("Invalid backfill cursor.");
  const rows=await env.DB.prepare(`SELECT id,category,title_ru,title_en,release_year
    FROM movies WHERE id>? AND tmdb_id IS NULL ORDER BY id LIMIT 5`).bind(cursor).all();
  const unresolved=[];
  let updated=0;
  for(const movie of rows.results||[]) {
    try {
      const media=tmdbMediaType(movie.category);
      const primary=movie.title_ru || movie.title_en;
      const result=await tmdbGet(env,`search/${media}`,{query:primary,language:"ru-RU",include_adult:"false",
        ...(movie.release_year ? media==="tv"?{first_air_date_year:movie.release_year}:{year:movie.release_year}:{})});
      const normalized=[movie.title_ru,movie.title_en].map(normalizeTitle).filter(Boolean);
      const viable=(result.results||[]).filter(candidate=>{
        const title=normalizeTitle(candidate.title||candidate.name);
        const original=normalizeTitle(candidate.original_title||candidate.original_name);
        const year=Number((candidate.release_date||candidate.first_air_date||"").slice(0,4))||null;
        return (normalized.includes(title)||normalized.includes(original))
          && (movie.release_year == null || year===movie.release_year);
      });
      if(viable.length!==1){unresolved.push(movie.id);continue;}
      const details=await tmdbDetails(env,media,viable[0].id);
      if(movie.release_year!=null && details.releaseYear!==movie.release_year){unresolved.push(movie.id);continue;}
      const ids=details.genreIds.filter(n=>Number.isSafeInteger(n));
      await env.DB.prepare(`UPDATE movies SET tmdb_id=?,tmdb_media_type=?,genre_ids=?,updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND tmdb_id IS NULL`).bind(viable[0].id,media,JSON.stringify(ids),movie.id).run();
      updated++;
    } catch (err) {
      console.warn("TMDB genre sync skipped record",movie.id,err?.message);
      unresolved.push(movie.id);
    }
  }
  const nextCursor=rows.results?.length?rows.results.at(-1).id:cursor;
  const hasMore=await env.DB.prepare("SELECT id FROM movies WHERE id>? AND tmdb_id IS NULL LIMIT 1").bind(nextCursor).first();
  return json({updated,unresolved,nextCursor,done:!hasMore});
}

async function tmdbSuggestions(url, env) {
  if (!env.TMDB_READ_TOKEN) return json({ error: "TMDB is not configured." }, 503);
  const offset = Number(url.searchParams.get("offset") || 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 2000) throw new ValidationError("Invalid offset.");
  const rows = await env.DB.prepare(
    "SELECT id, category, title_ru, title_en, release_year, poster_path FROM movies ORDER BY collection_order LIMIT 6 OFFSET ?"
  ).bind(offset).all();
  const candidates = await Promise.all(rows.results.map(async (movie) => {
    try {
      const payload = await tmdbGet(env, "search/multi", { query: movie.title_ru, language: "ru-RU", include_adult: "false" });
      const matching = (payload.results || []).filter((item) => item.media_type === tmdbMediaType(movie.category));
      const year = (item) => Number((item.release_date || item.first_air_date || "").slice(0,4)) || null;
      const original = (value) => String(value || "").toLocaleLowerCase("ru").replace(/[^\p{L}\p{N}]+/gu," ").trim();
      const movieName = original(movie.title_ru);
      const ranked = matching.map((item) => {
        const itemName = original(item.title || item.name);
        const same = movieName === itemName;
        const yearMatch = movie.release_year && year(item) === movie.release_year;
        const yearDiff = movie.release_year && year(item) ? Math.abs(year(item) - movie.release_year) : null;
        const score = (same ? 70 : (movieName.includes(itemName) || itemName.includes(movieName)) ? 25 : 0)
          + (yearMatch ? 30 : (yearDiff !== null && yearDiff <= 1) ? 12 : 0);
        return { item, score };
      }).sort((a,b)=>b.score-a.score);
      const top = ranked[0];
      if (!top) return { movieId: movie.id, movieTitle: movie.title_ru, error: "No TMDB match", match: null };
      const detail = await tmdbDetails(env,top.item.media_type,top.item.id);
      return { movieId: movie.id, movieTitle: movie.title_ru, movieYear: movie.release_year,
        match: { ...detail, score: top.score }, ambiguous: Boolean(ranked[1] && ranked[1].score >= top.score - 15),
        needsReview: top.score < 70 || Boolean(ranked[1] && ranked[1].score >= top.score - 15),
      };
    } catch {
      return { movieId: movie.id, movieTitle: movie.title_ru, error: "TMDB lookup failed", match: null };
    }
  }));
  const countRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM movies").first();
  return json({ candidates, offset, total: countRow.total });
}
async function applyTmdbMatch(request, env, movieId) {
  const input = await readJson(request);
  if (!Number.isSafeInteger(input.tmdbId) || input.tmdbId < 1 || !["movie","tv"].includes(input.mediaType)) throw new ValidationError("Invalid TMDB match.");
  const movie = await env.DB.prepare("SELECT id, category, title_ru, description_ru, release_year FROM movies WHERE id = ?").bind(movieId).first();
  if (!movie) return json({ error: "Movie not found." },404);
  if (tmdbMediaType(movie.category) !== input.mediaType) throw new ValidationError("TMDB media type differs from movie category.");
  const data = await tmdbDetails(env, input.mediaType, input.tmdbId);
  if (data.posterUrl) {
    const response = await fetch(data.posterUrl);
    if (!response.ok) return json({ error: "Poster download failed; no data changed." }, 502);
    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (!POSTER_TYPES.has(contentType) || declaredLength > MAX_POSTER_BYTES) return json({ error: "Invalid poster; no data changed." }, 502);
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_POSTER_BYTES) return json({ error: "Poster too large; no data changed." }, 502);
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO movie_posters(movie_id,content_type,image) VALUES(?,?,?)
        ON CONFLICT(movie_id) DO UPDATE SET content_type=excluded.content_type,image=excluded.image,updated_at=CURRENT_TIMESTAMP`).bind(movieId,contentType,bytes),
      env.DB.prepare(`UPDATE movies SET title_en = COALESCE(?,title_en), description_en = COALESCE(?,description_en),
        description_ru = CASE WHEN description_ru IS NULL OR description_ru = '' THEN ? ELSE description_ru END,
        release_year = COALESCE(release_year,?), poster_path = ?,
        tmdb_id=?, tmdb_media_type=?, genre_ids=?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(optionalText(data.titleEn,"English title",160),optionalText(data.descriptionEn.slice(0,3000),"English description",3000),
          optionalText(data.description.slice(0,3000),"Russian description",3000),data.releaseYear,`/api/posters/${movieId}`,
          input.tmdbId,input.mediaType,JSON.stringify(data.genreIds),movieId),
    ]);
  } else {
    await env.DB.prepare(`UPDATE movies SET title_en=COALESCE(?,title_en), description_en=COALESCE(?,description_en),
      description_ru=CASE WHEN description_ru IS NULL OR description_ru='' THEN ? ELSE description_ru END,
      release_year=COALESCE(release_year,?),tmdb_id=?,tmdb_media_type=?,genre_ids=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(optionalText(data.titleEn,"English title",160),optionalText(data.descriptionEn.slice(0,3000),"English description",3000),
        optionalText(data.description.slice(0,3000),"Russian description",3000),data.releaseYear,
        input.tmdbId,input.mediaType,JSON.stringify(data.genreIds),movieId).run();
  }
  return json({ movie: await getCatalogMovie(env,movieId), posterReplaced: Boolean(data.posterUrl) });
}

async function archiveTmdbPoster(env, movieId, url) {
  if (!url) return;
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!POSTER_TYPES.has(contentType)) return;
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_POSTER_BYTES) return;
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO movie_posters (movie_id, content_type, image) VALUES (?, ?, ?)
        ON CONFLICT(movie_id) DO UPDATE SET content_type=excluded.content_type,
        image=excluded.image, updated_at=CURRENT_TIMESTAMP
      `).bind(movieId, contentType, bytes),
      env.DB.prepare("UPDATE movies SET poster_path = ? WHERE id = ?").bind(`/api/posters/${movieId}`, movieId),
    ]);
  } catch (error) { console.warn("TMDB poster archival failed", error); }
}

async function findExistingMovie(env, input, excludedId = null) {
  // Read only the identity fields and never modify a matched movie automatically.
  const rows = await env.DB.prepare(
    "SELECT id, category, title_ru AS title, title_en AS titleEn, release_year AS releaseYear FROM movies WHERE category = ?"
  ).bind(input.category).all();
  return findDuplicateTitle(rows.results || [], input, excludedId);
}

async function createMovie(request, env) {
  const input = await readJson(request);
  const title = optionalText(input.title, "Title", 160);
  if (!title) throw new ValidationError("A title is required.");
  if (!MOVIE_CATEGORIES.has(input.category)) throw new ValidationError("The movie category is invalid.");

  const titleEn = optionalText(input.titleEn, "English title", 160);
  const description = optionalText(input.description, "Description", 3000);
  const descriptionEn = optionalText(input.descriptionEn, "English description", 3000);
  const releaseYear = input.releaseYear === null || input.releaseYear === "" || input.releaseYear === undefined
    ? null
    : Number(input.releaseYear);
  if (releaseYear !== null && (!Number.isInteger(releaseYear) || releaseYear < 1888 || releaseYear > 2200)) {
    throw new ValidationError("The release year is invalid.");
  }

  if (input.wantToWatch != null && typeof input.wantToWatch !== "boolean")
    throw new ValidationError("Invalid watchlist flag.");
  if (input.status !== "watched" && input.rating != null) throw new ValidationError("Unwatched content cannot be rated.");
  if (input.status === "watched" && input.category !== "series" && !input.lastWatchedAt)
    throw new ValidationError("A watched movie needs its viewing date.");
  const watchedSeries = input.status === "watched" && input.category === "series";
  if (watchedSeries) {
    if (!Number.isInteger(input.seasonNumber) || input.seasonNumber < 1 || input.seasonNumber > 200)
      throw new ValidationError("Choose the first recorded season (1–200).");
    const firstDay = validateViewingDay(input.startedAt);
    const finalDay = validateViewingDay(input.lastWatchedAt);
    if (finalDay < firstDay) throw new ValidationError("A series end date must not precede its start date.");
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
      throw new ValidationError("Rate the completed season from 1 to 5.");
  } else if (input.status === "watched" && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) {
    throw new ValidationError("A watched movie requires a 1–5 rating.");
  }
  if (input.status === "watched") validateWatchDate(input.lastWatchedAt);
  const existing = await findExistingMovie(env, {title, titleEn, category:input.category, releaseYear});
  if (existing) return json({error:"A title with this name, category and release year is already in your library.", duplicateId:existing.id, duplicateTitle:existing.title},409);
  const posterFromTmdb = tmdbPosterUrl(input.posterFromTmdb);
  let tmdbReference = null;
  if (Number.isSafeInteger(input.tmdbId) && input.tmdbId > 0
      && input.tmdbMediaType === tmdbMediaType(input.category)) {
    try {
      const details = await tmdbDetails(env, input.tmdbMediaType, input.tmdbId);
      const titleMatches = [details.title,details.titleEn].map(normalizeTitle)
        .some(name=>name && [title,titleEn].map(normalizeTitle).includes(name));
      if (titleMatches && (releaseYear == null || details.releaseYear === releaseYear))
        tmdbReference = {id:input.tmdbId,mediaType:input.tmdbMediaType,
          genreIds:details.genreIds.filter(n=>Number.isSafeInteger(n))};
    } catch (error) { console.warn("TMDB metadata unavailable; saved without genres",error?.message); }
  }
  const nextOrder = await env.DB.prepare(
    "SELECT COALESCE(MAX(collection_order), 0) + 1 AS value FROM movies",
  ).first();
  const insert = await env.DB.prepare(`
    INSERT INTO movies (
      category, title_ru, title_en, description_ru, description_en,
      poster_path, release_year, collection_order, tmdb_id, tmdb_media_type, genre_ids
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(input.category, title, titleEn, description, descriptionEn, posterFromTmdb || "/poster-placeholder.svg", releaseYear, Number(nextOrder?.value || 1),
    tmdbReference?.id ?? null, tmdbReference?.mediaType ?? null, JSON.stringify(tmdbReference?.genreIds || [])).run();

  const movieId = Number(insert.meta.last_row_id);

  // A series' first historical viewing is a completed, rated season inside a
  // completed cycle. Never create a fake film-level watch_history record for TV.
  if (watchedSeries) {
    try {
      const cycleResult = await env.DB.prepare(
        "INSERT INTO series_cycles(movie_id,started_at,ended_at,outcome) VALUES (?,?,?,'completed')"
      ).bind(movieId,input.startedAt,input.lastWatchedAt).run();
      const cycleId = Number(cycleResult.meta.last_row_id);
      const entryResult = await env.DB.prepare(
        "INSERT INTO season_viewings(movie_id,cycle_id,season_number,started_at,finished_at,rating) VALUES (?,?,?,?,?,?)"
      ).bind(movieId,cycleId,input.seasonNumber,input.startedAt,input.lastWatchedAt,input.rating).run();
      await registerRating(env,movieId,input.rating,"season",Number(entryResult.meta.last_row_id));
      await refreshViewingSummary(env,movieId);
    } catch (error) {
      // Compensating delete affects only the newly created row and cascades to its
      // new cycle, seasons and rating changes; existing collection stays untouched.
      await env.DB.prepare("DELETE FROM movies WHERE id=?").bind(movieId).run();
      throw error;
    }
  } else {
    const progressInput = {
      status: input.status === "watched" ? "watched" : "unwatched",
      rating: input.status === "watched" ? input.rating ?? null : null,
    };
    if (input.lastWatchedAt) progressInput.lastWatchedAt = input.lastWatchedAt;
    const normalized = normalizeProgressPatch(progressInput, {});
    await saveNormalizedProgress(env, movieId, normalized, new Date().toISOString());
    if (progressInput.rating != null) {
      await env.DB.prepare("UPDATE watch_history SET rating=? WHERE movie_id=? AND watched_at=?")
        .bind(progressInput.rating,movieId,normalized.value.lastWatchedAt).run();
      await refreshCurrentRating(env,movieId);
    }
  }
  if (input.wantToWatch === true) {
    await env.DB.prepare(`INSERT INTO member_progress(movie_id,member_id,wants_to_watch) VALUES (?,1,1)
      ON CONFLICT(movie_id,member_id) DO UPDATE SET wants_to_watch=1`).bind(movieId).run();
  }
  if (posterFromTmdb) await archiveTmdbPoster(env, movieId, posterFromTmdb);

  return json({ movie: await getCatalogMovie(env, movieId) }, 201);
}

async function ensurePosterTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS movie_posters (
      movie_id INTEGER PRIMARY KEY REFERENCES movies(id) ON DELETE CASCADE,
      content_type TEXT NOT NULL,
      image BLOB NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function uploadPoster(request, env, movieId) {
  const movie = await env.DB.prepare("SELECT id FROM movies WHERE id = ?").bind(movieId).first();
  if (!movie) return json({ error: "Movie not found." }, 404);

  const contentType = (request.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!POSTER_TYPES.has(contentType)) throw new ValidationError("The poster must be a JPEG, PNG, or WebP image.");
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_POSTER_BYTES) throw new ValidationError("The poster is too large.");
  const image = await request.arrayBuffer();
  if (!image.byteLength || image.byteLength > MAX_POSTER_BYTES) throw new ValidationError("The poster is too large.");

  await ensurePosterTable(env);
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO movie_posters (movie_id, content_type, image, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(movie_id) DO UPDATE SET
        content_type = excluded.content_type,
        image = excluded.image,
        updated_at = excluded.updated_at
    `).bind(movieId, contentType, image, new Date().toISOString()),
    env.DB.prepare("UPDATE movies SET poster_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(`/api/posters/${movieId}`, movieId),
  ]);

  return json({ poster: `/api/posters/${movieId}` });
}

async function getPoster(env, movieId) {
  const row = await env.DB.prepare(
    "SELECT content_type, image, updated_at FROM movie_posters WHERE movie_id = ?",
  ).bind(movieId).first();
  if (!row) return json({ error: "Poster not found." }, 404);
  const bytes = row.image instanceof ArrayBuffer ? row.image : Uint8Array.from(row.image);
  return new Response(bytes, {
    headers: {
      "content-type": row.content_type,
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}

async function getWatchHistory(env, movieId) {
  const movie = await env.DB.prepare("SELECT id FROM movies WHERE id = ?").bind(movieId).first();
  if (!movie) return json({ error: "Movie not found." }, 404);
  const events = await listViewingEvents(env, movieId);
  return json({ dates: events.map((event) => event.watchedAt), events });
}

async function resetProgress(env, movieId) {
  const movie = await env.DB.prepare("SELECT id FROM movies WHERE id = ?").bind(movieId).first();
  if (!movie) return json({ error: "Movie not found." }, 404);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM rating_changes WHERE movie_id = ?").bind(movieId),
    env.DB.prepare("DELETE FROM season_viewings WHERE movie_id = ?").bind(movieId),
    env.DB.prepare("DELETE FROM watch_history WHERE movie_id = ?").bind(movieId),
    env.DB.prepare("DELETE FROM movie_progress WHERE movie_id = ?").bind(movieId),
  ]);
  return json({ progress: mapProgress(null) });
}

async function listDismissedCatalogAlerts(env) {
  const results = await env.DB.prepare("SELECT alert_key AS alertKey FROM dismissed_catalog_alerts ORDER BY dismissed_at DESC LIMIT 1000").all();
  return (results.results || []).map((row) => row.alertKey);
}

async function dismissCatalogAlert(request, env) {
  const input = await readJson(request);
  if (typeof input.key !== "string" || input.key.length < 1 || input.key.length > 4096) {
    throw new ValidationError("Invalid catalog alert key.");
  }
  await env.DB.prepare(
    "INSERT OR IGNORE INTO dismissed_catalog_alerts(alert_key) VALUES (?)"
  ).bind(input.key).run();
  return json({dismissed:true});
}

async function exportData(env) {
  const [catalog, history] = await Promise.all([
    listCatalog(env),
    env.DB.prepare(
      "SELECT id, movie_id AS movieId, watched_at AS watchedAt, rating, created_at AS createdAt FROM watch_history ORDER BY watched_at DESC",
    ).all(),
  ]);
  const posterRows = await env.DB.prepare("SELECT movie_id, content_type, image FROM movie_posters").all();
  const ratingRows = await env.DB.prepare("SELECT id, movie_id AS movieId, source_type AS sourceType, source_id AS sourceId, rating, created_at AS createdAt FROM rating_changes ORDER BY id").all();
  const seasonEntries = await env.DB.prepare(
    "SELECT id, movie_id AS movieId, cycle_id AS cycleId, season_number AS seasonNumber, started_at AS startedAt, finished_at AS finishedAt, rating, created_at AS createdAt FROM season_viewings ORDER BY created_at"
  ).all();
  const cycleEntries = await env.DB.prepare(
    "SELECT id, movie_id AS movieId, started_at AS startedAt, ended_at AS endedAt, outcome, created_at AS createdAt FROM series_cycles ORDER BY id"
  ).all();
  return json({
    schemaVersion: 5,
    seriesCycles: cycleEntries.results,
    seasonViewings: seasonEntries.results,
    ratingChanges: ratingRows.results,
    dismissedCatalogAlerts: await listDismissedCatalogAlerts(env),
    exportedAt: new Date().toISOString(),
    movies: catalog,
    profiles: await listProfiles(env),
    watchHistory: history.results,
    watchAttendance: (await env.DB.prepare("SELECT watch_id AS watchId, member_id AS memberId FROM watch_attendance").all()).results,
    moviePosters: posterRows.results.map((row) => ({
      movieId: row.movie_id, contentType: row.content_type, base64: bytesToBase64(row.image),
    })),
    notice: "Restore requires this repository's /public/posters static assets for legacy images.",
  });
}


const MEMBER_IDS = new Set([1, 2]);

function assertMemberId(value) {
  const id = Number(value);
  if (!MEMBER_IDS.has(id)) throw new ValidationError("Invalid family profile.");
  return id;
}

function validateWatchDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError("Use YYYY-MM-DD for the viewing date.");
  }
  const date = new Date(value + "T12:00:00.000Z");
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ValidationError("Invalid viewing date.");
  }
  if (date.getTime() > Date.now() + 86_400_000) throw new ValidationError("Future viewing dates are not allowed.");
  return date.toISOString();
}

async function listProfiles(env) {
  const result = await env.DB.prepare("SELECT id, display_name AS name FROM family_profiles ORDER BY id").all();
  return result.results;
}

async function updateProfile(request, env, memberId) {
  const body = await readJson(request);
  if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 32) {
    throw new ValidationError("Name must contain 1–32 characters.");
  }
  await env.DB.prepare("UPDATE family_profiles SET display_name = ? WHERE id = ?")
    .bind(body.name.trim(), memberId).run();
  return json({ profiles: await listProfiles(env) });
}

async function updateMemberProgress(request, env, movieId, memberId) {
  const movie = await env.DB.prepare("SELECT id FROM movies WHERE id = ?").bind(movieId).first();
  if (!movie) return json({ error: "Movie not found." }, 404);
  const input = await readJson(request);
  const permitted = new Set(["rating", "isFavorite", "wantsToWatch", "notes"]);
  if (!input || typeof input !== "object" || Array.isArray(input)
      || Object.keys(input).some((key) => !permitted.has(key))) {
    throw new ValidationError("Invalid profile update.");
  }
  if ("rating" in input && input.rating !== null
      && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) {
    throw new ValidationError("Rating must be 1–5 or null.");
  }
  if ("isFavorite" in input && typeof input.isFavorite !== "boolean") {
    throw new ValidationError("Favorite must be true or false.");
  }
  if ("wantsToWatch" in input && typeof input.wantsToWatch !== "boolean") {
    throw new ValidationError("Watchlist must be true or false.");
  }
  if ("notes" in input && (typeof input.notes !== "string" || input.notes.length > 5000)) {
    throw new ValidationError("Notes must be under 5,000 characters.");
  }
  const old = await env.DB.prepare(
    "SELECT rating, is_favorite, wants_to_watch, notes FROM member_progress WHERE movie_id = ? AND member_id = ?",
  ).bind(movieId, memberId).first();
  const next = {
    rating: "rating" in input ? input.rating : (old?.rating ?? null),
    isFavorite: "isFavorite" in input ? input.isFavorite : Boolean(old?.is_favorite),
    wantsToWatch: "wantsToWatch" in input ? input.wantsToWatch : Boolean(old?.wants_to_watch),
    notes: "notes" in input ? input.notes : (old?.notes || ""),
  };
  await env.DB.prepare(`
    INSERT INTO member_progress (movie_id, member_id, rating, is_favorite, wants_to_watch, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(movie_id, member_id) DO UPDATE SET
      rating = excluded.rating, is_favorite = excluded.is_favorite,
      wants_to_watch = excluded.wants_to_watch, notes = excluded.notes, updated_at = excluded.updated_at
  `).bind(movieId, memberId, next.rating, next.isFavorite ? 1 : 0, next.wantsToWatch ? 1 : 0, next.notes, new Date().toISOString()).run();
  return json({ member: next });
}

function validateViewingRating(rating) {
  if (rating == null || rating === "") return null;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ValidationError("Viewing rating must be 1–5.");
  return rating;
}
function validateViewingDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) {
    throw new ValidationError("Invalid viewing date.");
  }
  return value;
}
async function refreshCurrentRating(env,movieId) {
  const result=await env.DB.prepare(`SELECT ${EFFECTIVE_RATING_SQL} AS rating FROM movies m WHERE m.id=?`).bind(movieId).first();
  await env.DB.prepare(`INSERT INTO movie_progress(movie_id,status,rating,updated_at) VALUES (?,'unwatched',?,?)
    ON CONFLICT(movie_id) DO UPDATE SET rating=excluded.rating,updated_at=excluded.updated_at`)
    .bind(movieId,result?.rating??null,new Date().toISOString()).run();
}
async function registerRating(env,movieId,rating,sourceType,sourceId=null) {
  if (!["watch","season","manual"].includes(sourceType)) throw new ValidationError("Unknown rating source.");
  await env.DB.prepare(`DELETE FROM rating_changes
    WHERE movie_id=? AND source_type=? AND source_id IS ?`)
    .bind(movieId,sourceType,sourceId).run();
  if (rating !== null) {
    await env.DB.prepare(`INSERT INTO rating_changes(movie_id,source_type,source_id,rating)
      VALUES (?,?,?,?)`).bind(movieId,sourceType,sourceId,rating).run();
  }
  await refreshCurrentRating(env,movieId);
}

async function listSeasonViewings(env,movieId) {
  const entries = await env.DB.prepare(`SELECT id, cycle_id AS cycleId, season_number AS seasonNumber,
    started_at AS startedAt, finished_at AS finishedAt, rating, created_at AS createdAt
    FROM season_viewings WHERE movie_id=? ORDER BY COALESCE(finished_at,started_at) DESC,started_at DESC,id DESC`)
    .bind(movieId).all();
  return entries.results;
}
async function listSeriesCycles(env,movieId) {
  const cycles = (await env.DB.prepare(`SELECT id, started_at AS startedAt, ended_at AS endedAt,
    outcome, created_at AS createdAt FROM series_cycles WHERE movie_id=?
    ORDER BY started_at DESC,id DESC`).bind(movieId).all()).results;
  const entries=await listSeasonViewings(env,movieId);
  return cycles.map(cycle=>{
    const seasons=entries.filter(entry=>entry.cycleId===cycle.id);
    return {...cycle,seasons,...averageRatedSeasons(seasons)};
  });
}
async function createSeriesCycle(env,movieId) {
  const movie=await env.DB.prepare("SELECT id FROM movies WHERE id=? AND category='series'").bind(movieId).first();
  if(!movie)return json({error:"Series not found."},404);
  const open=await env.DB.prepare("SELECT id FROM series_cycles WHERE movie_id=? AND outcome='watching'").bind(movieId).first();
  if(open)return json({error:"Finish the current viewing cycle first."},409);
  const today=new Date().toISOString().slice(0,10);
  await env.DB.prepare(`INSERT INTO series_cycles(movie_id,started_at,outcome)
    VALUES (?,?,'watching')`).bind(movieId,today).run();
  return json({cycles:await listSeriesCycles(env,movieId),movie:await getCatalogMovie(env,movieId)},201);
}
async function closeSeriesCycle(request,env,movieId,cycleId) {
  const input=await readJson(request);
  if(!["completed","stopped"].includes(input.outcome))throw new ValidationError("Invalid cycle outcome.");
  const cycle=await env.DB.prepare(`SELECT id FROM series_cycles
    WHERE id=? AND movie_id=? AND outcome='watching'`).bind(cycleId,movieId).first();
  if(!cycle)return json({error:"Active viewing cycle not found."},404);
  const existing=await env.DB.prepare(`SELECT COUNT(*) AS rated,
    MAX(COALESCE(finished_at,started_at)) AS latest FROM season_viewings
    WHERE cycle_id=? AND movie_id=? AND rating IS NOT NULL AND finished_at IS NOT NULL`)
    .bind(cycleId,movieId).first();
  if(!Number(existing?.rated))return json({error:"Rate at least one finished season before closing this cycle."},422);
  if(input.outcome==="completed") {
    const unfinished=await env.DB.prepare(`SELECT COUNT(*) AS total FROM season_viewings
      WHERE cycle_id=? AND movie_id=? AND finished_at IS NULL`).bind(cycleId,movieId).first();
    if(Number(unfinished?.total))return json({error:"Finish or remove unfinished seasons, or choose Stopped watching."},422);
  }
  // The cycle's calendar date is based on its actual last completed season, not
  // on when the user pressed "Done", so backdated cycles sort correctly.
  await env.DB.prepare(`UPDATE series_cycles SET outcome=?,ended_at=? WHERE id=? AND movie_id=?`)
    .bind(input.outcome,existing.latest,cycleId,movieId).run();
  await refreshCurrentRating(env,movieId);
  await refreshViewingSummary(env,movieId);
  return json({cycles:await listSeriesCycles(env,movieId),movie:await getCatalogMovie(env,movieId)});
}
async function cancelEmptySeriesCycle(env,movieId,cycleId) {
  const current=await env.DB.prepare(`SELECT id FROM series_cycles WHERE id=? AND movie_id=?
    AND outcome='watching'`).bind(cycleId,movieId).first();
  if(!current)return json({error:"Active cycle not found."},404);
  const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM season_viewings WHERE cycle_id=?")
    .bind(cycleId).first();
  if(Number(count.total))return json({error:"Delete season entries before cancelling the cycle."},409);
  await env.DB.prepare("DELETE FROM series_cycles WHERE id=?").bind(cycleId).run();
  return json({cycles:await listSeriesCycles(env,movieId),movie:await getCatalogMovie(env,movieId)});
}
async function saveSeasonViewing(request,env,movieId) {
  const movie=await env.DB.prepare("SELECT id FROM movies WHERE id=? AND category='series'").bind(movieId).first();
  if(!movie)return json({error:"Series not found."},404);
  const data=await readJson(request);
  const season=data.seasonNumber;
  if(!Number.isInteger(season)||season<1||season>200)throw new ValidationError("Season must be 1–200.");
  const start=validateViewingDay(data.startedAt);
  const finish=data.finishedAt?validateViewingDay(data.finishedAt):null;
  if(finish&&finish<start)throw new ValidationError("Finish date must not precede start.");
  const rating=validateViewingRating(data.rating);
  if(finish&&rating===null)throw new ValidationError("A finished season requires a rating.");
  if(!finish&&rating!==null)throw new ValidationError("Finish the season before rating it.");
  let cycleId=Number(data.cycleId);
  let entryId;
  if(data.id!=null) {
    const previous=await env.DB.prepare("SELECT id,cycle_id AS cycleId FROM season_viewings WHERE id=? AND movie_id=?")
      .bind(data.id,movieId).first();
    if(!previous)return json({error:"Season viewing not found."},404);
    cycleId=previous.cycleId;
    entryId=data.id;
  }
  const cycle=await env.DB.prepare("SELECT id,outcome FROM series_cycles WHERE id=? AND movie_id=?")
    .bind(cycleId,movieId).first();
  if(!cycle)return json({error:"Viewing cycle not found."},404);
  // Allow adding older completed seasons to a finished historical cycle.
  // A closed cycle must never contain an unfinished or unrated new season.
  if(!entryId&&cycle.outcome!=="watching"&&(!finish||rating===null))
    return json({error:"Historical finished cycles only accept completed, rated seasons."},422);
  if(entryId){
    await env.DB.prepare(`UPDATE season_viewings SET season_number=?,started_at=?,finished_at=?,rating=?
      WHERE id=? AND movie_id=?`).bind(season,start,finish,rating,entryId,movieId).run();
  }else{
    const result=await env.DB.prepare(`INSERT INTO season_viewings(movie_id,cycle_id,season_number,started_at,finished_at,rating)
      VALUES (?,?,?,?,?,?)`).bind(movieId,cycleId,season,start,finish,rating).run();
    entryId=result.meta.last_row_id;
  }
  // The cycle's start must reflect its historical first viewing, even when
  // users log older seasons long after creating the cycle.
  const earliest=await env.DB.prepare(`SELECT MIN(started_at) AS day FROM season_viewings
    WHERE cycle_id=?`).bind(cycleId).first();
  if(earliest?.day)await env.DB.prepare("UPDATE series_cycles SET started_at=? WHERE id=?")
    .bind(earliest.day,cycleId).run();
  await registerRating(env,movieId,rating,"season",entryId);
  // Editing a completed cycle recomputes its date from its actual entries.
  if(cycle.outcome!=="watching"){
    const last=await env.DB.prepare(`SELECT MAX(finished_at) AS day
      FROM season_viewings WHERE cycle_id=? AND finished_at IS NOT NULL AND rating IS NOT NULL`)
      .bind(cycleId).first();
    await env.DB.prepare("UPDATE series_cycles SET ended_at=? WHERE id=?")
      .bind(last?.day??start,cycleId).run();
    await refreshCurrentRating(env,movieId);
  }
  await refreshViewingSummary(env,movieId);
  return json({cycles:await listSeriesCycles(env,movieId),movie:await getCatalogMovie(env,movieId)});
}
async function removeSeasonViewing(env,movieId,entryId) {
  const old=await env.DB.prepare("SELECT id,cycle_id AS cycleId FROM season_viewings WHERE id=? AND movie_id=?")
    .bind(entryId,movieId).first();
  if(!old)return json({error:"Season viewing not found."},404);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM rating_changes WHERE movie_id=? AND source_type='season' AND source_id=?").bind(movieId,entryId),
    env.DB.prepare("DELETE FROM season_viewings WHERE id=? AND movie_id=?").bind(entryId,movieId)
  ]);
  const earliest=await env.DB.prepare(`SELECT MIN(started_at) AS day FROM season_viewings
    WHERE cycle_id=?`).bind(old.cycleId).first();
  if(earliest?.day)await env.DB.prepare("UPDATE series_cycles SET started_at=? WHERE id=?")
    .bind(earliest.day,old.cycleId).run();
  const latest=await env.DB.prepare(`SELECT MAX(finished_at) AS day FROM season_viewings
    WHERE cycle_id=? AND rating IS NOT NULL AND finished_at IS NOT NULL`).bind(old.cycleId).first();
  const cycle=await env.DB.prepare("SELECT outcome,started_at AS startedAt FROM series_cycles WHERE id=?").bind(old.cycleId).first();
  if(cycle&&cycle.outcome!=="watching")await env.DB.prepare("UPDATE series_cycles SET ended_at=? WHERE id=?")
    .bind(latest?.day??cycle.startedAt,old.cycleId).run();
  await refreshCurrentRating(env,movieId);
  await refreshViewingSummary(env,movieId);
  return json({cycles:await listSeriesCycles(env,movieId),movie:await getCatalogMovie(env,movieId)});
}
async function reviseWatchRating(request,env,movieId,entryId) {
  const data = await readJson(request);
  if (!Object.prototype.hasOwnProperty.call(data,"rating")) throw new ValidationError("Rating is required.");
  const rating = validateViewingRating(data.rating);
  const row = await env.DB.prepare("SELECT id FROM watch_history WHERE id=? AND movie_id=?").bind(entryId,movieId).first();
  if (!row) return json({error:"Viewing not found."},404);
  await env.DB.prepare("UPDATE watch_history SET rating=? WHERE id=?").bind(rating,entryId).run();
  await registerRating(env,movieId,rating,"watch",entryId);
  return json({events:await listViewingEvents(env,movieId),movie:await getCatalogMovie(env,movieId)});
}
async function refreshViewingSummary(env, movieId) {
  const last = await env.DB.prepare(
    "SELECT MAX(watched_at) AS latest, COUNT(*) AS total FROM watch_history WHERE movie_id = ?",
  ).bind(movieId).first();
  const seasons = await env.DB.prepare(
    "SELECT MAX(finished_at) AS latest, COUNT(*) AS total FROM season_viewings WHERE movie_id = ? AND finished_at IS NOT NULL",
  ).bind(movieId).first();
  const total = Number(last.total || 0) + Number(seasons.total || 0);
  const latest = [last.latest,seasons.latest].filter(Boolean).sort().at(-1) || null;
  const status = total ? "watched" : "unwatched";
  await env.DB.prepare(`
    INSERT INTO movie_progress (movie_id, status, last_watched_at, watch_count, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(movie_id) DO UPDATE SET status=excluded.status,
      last_watched_at=excluded.last_watched_at, watch_count=excluded.watch_count, updated_at=excluded.updated_at
  `).bind(movieId, status, latest, total, new Date().toISOString()).run();
}

async function listViewingEvents(env, movieId) {
  const watches = await env.DB.prepare(
    "SELECT id, watched_at AS watchedAt, rating FROM watch_history WHERE movie_id = ? ORDER BY watched_at DESC",
  ).bind(movieId).all();
  const attendance = await env.DB.prepare(
    "SELECT a.watch_id, a.member_id FROM watch_attendance a JOIN watch_history w ON w.id = a.watch_id WHERE w.movie_id = ?",
  ).bind(movieId).all();
  const viewers = new Map();
  for (const row of attendance.results) {
    if (!viewers.has(row.watch_id)) viewers.set(row.watch_id, []);
    viewers.get(row.watch_id).push(row.member_id);
  }
  return watches.results.map((entry) => ({
    id: entry.id, watchedAt: entry.watchedAt, rating: entry.rating, viewers: viewers.get(entry.id) || [],
  }));
}

async function addViewingEvent(request, env, movieId) {
  const movie = await env.DB.prepare("SELECT id FROM movies WHERE id = ?").bind(movieId).first();
  if (!movie) return json({ error: "Movie not found." }, 404);
  const body = await readJson(request);
  const watchedAt = validateWatchDate(body.date);
  const rating = validateViewingRating(body.rating);
  if (!Array.isArray(body.viewers) || body.viewers.length < 1 || body.viewers.length > 2) {
    throw new ValidationError("Choose at least one family member.");
  }
  const viewers = [...new Set(body.viewers.map(assertMemberId))];
  await env.DB.prepare("INSERT OR IGNORE INTO watch_history(movie_id, watched_at, rating) VALUES (?, ?, ?)").bind(movieId, watchedAt, rating).run();
  // Preserve the old event's rating when re-submitting an existing date.
  // A rating change can be made explicitly using the event-rating endpoint.
  const row = await env.DB.prepare(
    "SELECT id FROM watch_history WHERE movie_id = ? AND watched_at = ?",
  ).bind(movieId, watchedAt).first();
  await env.DB.batch(viewers.map((viewer) => env.DB.prepare(
    "INSERT OR IGNORE INTO watch_attendance(watch_id, member_id) VALUES (?, ?)",
  ).bind(row.id, viewer)));
  if (rating !== null) {
    await env.DB.prepare("UPDATE watch_history SET rating = ? WHERE id = ?").bind(rating,row.id).run();
  }
  // Even an unrated latest viewing supersedes a previously rated older date.
  await registerRating(env,movieId,rating,"watch",row.id);
  await refreshViewingSummary(env, movieId);
  return json({ events: await listViewingEvents(env, movieId), movie: await getCatalogMovie(env, movieId) }, 201);
}

async function deleteViewingEvent(env, movieId, eventId) {
  const existing = await env.DB.prepare("SELECT id FROM watch_history WHERE id=? AND movie_id=?").bind(eventId,movieId).first();
  if (!existing) return json({ error: "Viewing event not found." }, 404);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM rating_changes WHERE movie_id=? AND source_type='watch' AND source_id=?").bind(movieId,eventId),
    env.DB.prepare("DELETE FROM watch_history WHERE id=? AND movie_id=?").bind(eventId,movieId),
  ]);
  await refreshCurrentRating(env,movieId);
  await refreshViewingSummary(env, movieId);
  return json({ events: await listViewingEvents(env, movieId), movie: await getCatalogMovie(env, movieId) });
}

async function editMovie(request, env, movieId) {
  const old = await env.DB.prepare("SELECT id,category,release_year FROM movies WHERE id = ?").bind(movieId).first();
  if (!old) return json({ error: "Movie not found." }, 404);
  const input = await readJson(request);
  const title = optionalText(input.title, "Title", 160);
  if (!title) throw new ValidationError("Title is required.");
  if (!MOVIE_CATEGORIES.has(input.category)) throw new ValidationError("Invalid category.");
  const year = input.releaseYear === null || input.releaseYear === "" ? null : Number(input.releaseYear);
  if (year !== null && (!Number.isInteger(year) || year < 1888 || year > 2200)) {
    throw new ValidationError("Invalid release year.");
  }
  const titleEn = optionalText(input.titleEn, "English title", 160);
  const existing = await findExistingMovie(env, {title, titleEn, category:input.category, releaseYear:year}, movieId);
  if (existing) return json({error:"Another title with this name, category and release year already exists.", duplicateId:existing.id, duplicateTitle:existing.title},409);
  await env.DB.prepare(`
    UPDATE movies SET title_ru = ?, title_en = ?, category = ?,
      description_ru = ?, description_en = ?, release_year = ?,
      tmdb_id = CASE WHEN ? THEN NULL ELSE tmdb_id END,
      tmdb_media_type = CASE WHEN ? THEN NULL ELSE tmdb_media_type END,
      genre_ids = CASE WHEN ? THEN '[]' ELSE genre_ids END,
      updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(title, titleEn, input.category,
    optionalText(input.description, "Description", 3000), optionalText(input.descriptionEn, "English description", 3000), year,
    Number(old.category!==input.category || old.release_year!==year),
    Number(old.category!==input.category || old.release_year!==year),
    Number(old.category!==input.category || old.release_year!==year), movieId).run();
  return json({ movie: await getCatalogMovie(env, movieId) });
}

async function deleteMovie(env, movieId) {
  const result = await env.DB.prepare("DELETE FROM movies WHERE id = ?").bind(movieId).run();
  return result.meta.changes ? json({ deleted: true }) : json({ error: "Movie not found." }, 404);
}


async function readBackup(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BACKUP_BYTES) throw new ValidationError("Backup exceeds 30 MB.");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) {
    throw new ValidationError("Backup exceeds 30 MB.");
  }
  let snapshot;
  try { snapshot = JSON.parse(raw); }
  catch { throw new ValidationError("Backup must contain valid JSON."); }
  try { return { snapshot, summary: validateBackup(snapshot) }; }
  catch (error) {
    if (error instanceof BackupError) throw new ValidationError(error.message);
    throw error;
  }
}

async function restoreBackup(env, snapshot) {
  // One atomic D1 transaction. No existing rows are deleted until full validation passes.
  const statements = [
    "DELETE FROM dismissed_catalog_alerts", "DELETE FROM rating_changes", "DELETE FROM season_viewings", "DELETE FROM series_cycles", "DELETE FROM watch_attendance", "DELETE FROM watch_history", "DELETE FROM member_progress",
    "DELETE FROM movie_progress", "DELETE FROM movie_posters", "DELETE FROM movies",
  ].map((sql) => env.DB.prepare(sql));
  for (const key of snapshot.dismissedCatalogAlerts || []) {
    statements.push(env.DB.prepare("INSERT INTO dismissed_catalog_alerts(alert_key) VALUES (?)").bind(key));
  }
  for (const person of snapshot.profiles) {
    statements.push(env.DB.prepare("UPDATE family_profiles SET display_name = ? WHERE id = ?").bind(person.name.trim(), person.id));
  }
  const posterIds = new Set(snapshot.moviePosters.map(x => x.movieId));
  for (const movie of snapshot.movies) {
    const poster = movie.poster?.startsWith("/api/posters/") && !posterIds.has(movie.id) ? "/film-reel.png" : (movie.poster || "/film-reel.png");
    statements.push(env.DB.prepare(`
      INSERT INTO movies(id, category, title_ru, title_en, description_ru, description_en,
        poster_path, release_year, collection_order, tmdb_id, tmdb_media_type, genre_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(movie.id, movie.category, movie.title, movie.titleEn || null, movie.description || null,
      movie.descriptionEn || null, poster, movie.releaseYear ?? null, movie.collectionOrder,
      movie.tmdbId ?? null, movie.tmdbMediaType ?? null, JSON.stringify(movie.genreIds || [])));
    const p = movie.progress;
    statements.push(env.DB.prepare(`
      INSERT INTO movie_progress(movie_id, status, rating, is_favorite, last_watched_at, watch_count, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(movie.id, p.status, p.rating ?? null, p.isFavorite ? 1 : 0, p.lastWatchedAt || null,
      p.watchCount || 0, p.notes || "", p.updatedAt || new Date().toISOString()));
    for (const [memberId, m] of Object.entries(movie.members)) {
      statements.push(env.DB.prepare(`
        INSERT INTO member_progress(movie_id, member_id, rating, is_favorite, wants_to_watch, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(movie.id, Number(memberId), m.rating ?? null, m.isFavorite ? 1 : 0,
        m.wantsToWatch ? 1 : 0, m.notes || ""));
    }
  }
  for (const event of snapshot.watchHistory) {
    statements.push(env.DB.prepare(
      "INSERT INTO watch_history(id, movie_id, watched_at, rating, created_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(event.id, event.movieId, event.watchedAt, event.rating ?? null, event.createdAt || new Date().toISOString()));
  }
  const legacyCycleIds=new Map();
  if(snapshot.schemaVersion<5){
    for(const movie of snapshot.movies.filter(item=>item.category==="series")){
      const recorded=(snapshot.seasonViewings||[]).filter(entry=>entry.movieId===movie.id);
      if(!recorded.length)continue;
      const start=recorded.map(entry=>entry.startedAt).sort()[0];
      const end=recorded.map(entry=>entry.finishedAt||entry.startedAt).sort().at(-1);
      legacyCycleIds.set(movie.id,movie.id);
      statements.push(env.DB.prepare(`INSERT INTO series_cycles(id,movie_id,started_at,ended_at,outcome)
        VALUES (?,?,?,?,'completed')`).bind(movie.id,movie.id,start,end));
    }
  }
  for(const cycle of snapshot.seriesCycles||[]){
    statements.push(env.DB.prepare(`INSERT INTO series_cycles(id,movie_id,started_at,ended_at,outcome,created_at)
      VALUES (?,?,?,?,?,?)`).bind(cycle.id,cycle.movieId,cycle.startedAt,cycle.endedAt||null,
      cycle.outcome,cycle.createdAt||new Date().toISOString()));
  }
  for (const season of snapshot.seasonViewings || []) {
    statements.push(env.DB.prepare(
      "INSERT INTO season_viewings(id, movie_id, cycle_id, season_number, started_at, finished_at, rating, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(season.id, season.movieId, season.cycleId ?? legacyCycleIds.get(season.movieId) ?? null, season.seasonNumber, season.startedAt, season.finishedAt || null, season.rating ?? null,
      season.createdAt || new Date().toISOString()));
  }
  for (const change of snapshot.ratingChanges || []) {
    statements.push(env.DB.prepare(`INSERT INTO rating_changes(id,movie_id,source_type,source_id,rating,created_at)
      VALUES (?,?,?,?,?,?)`).bind(change.id,change.movieId,change.sourceType,change.sourceId ?? null,
       change.rating,change.createdAt || new Date().toISOString()));
  }
  if (snapshot.schemaVersion === 3) {
    // Legacy exports contain a current rating but no historical rating source.
    for (const movie of snapshot.movies) {
      if (movie.progress.rating != null) {
        statements.push(env.DB.prepare(`INSERT INTO rating_changes(movie_id,source_type,source_id,rating)
          VALUES (?,'manual',NULL,?)`).bind(movie.id,movie.progress.rating));
      }
    }
  }
  for (const viewer of snapshot.watchAttendance) {
    statements.push(env.DB.prepare(
      "INSERT INTO watch_attendance(watch_id, member_id) VALUES (?, ?)",
    ).bind(viewer.watchId, viewer.memberId));
  }
  for (const poster of snapshot.moviePosters) {
    statements.push(env.DB.prepare(
      "INSERT INTO movie_posters(movie_id, content_type, image) VALUES (?, ?, ?)",
    ).bind(poster.movieId, poster.contentType, base64ToBytes(poster.base64)));
  }
  await env.DB.batch(statements);
  return json({ restored: true, movies: snapshot.movies.length });
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  assertSameOrigin(request, url);

  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({ ok: true, database: Boolean(env.DB), accessKeyConfigured: Boolean(env.ACCESS_KEY) });
  }

  if (url.pathname === "/api/session" && request.method === "GET") {
    return json({ configured: Boolean(env.ACCESS_KEY), authenticated: await isAuthorized(request, env) });
  }

  if (url.pathname === "/api/session" && request.method === "POST") {
    if (!env.ACCESS_KEY) return json({ error: "The access key is not configured on the server." }, 503);
    const body = await readJson(request);
    const valid = typeof body.accessKey === "string" && await safeEqual(body.accessKey, env.ACCESS_KEY);
    if (!valid) return json({ error: "Incorrect access key." }, 401);
    const token = await expectedSession(env);
    return json({ authenticated: true }, 200, { "set-cookie": sessionCookie(token, request, 31_536_000) });
  }

  if (url.pathname === "/api/session" && request.method === "DELETE") {
    return json({ authenticated: false }, 200, { "set-cookie": sessionCookie("", request, 0) });
  }

  if (!env.DB) return json({ error: "The database is not configured." }, 503);

  // No family records, ratings, notes or viewing history are publicly readable.
  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);

  if (url.pathname === "/api/catalog" && request.method === "GET") {
    return json({ movies: await listCatalog(env), updatedAt: new Date().toISOString() });
  }
  if (url.pathname === "/api/profiles" && request.method === "GET") return json({ profiles: await listProfiles(env) });
  if (url.pathname === "/api/catalog/alerts/dismissed" && request.method === "GET")
    return json({keys:await listDismissedCatalogAlerts(env)});
  if (url.pathname === "/api/catalog/alerts/dismissed" && request.method === "POST")
    return dismissCatalogAlert(request,env);
  if (url.pathname === "/api/tmdb/search" && request.method === "GET") return searchTmdb(url, env);
  if (url.pathname === "/api/tmdb/genres" && request.method === "GET") return listTmdbGenres(env);
  if (url.pathname === "/api/tmdb/genres/unresolved" && request.method === "GET") return listUnresolvedTmdbGenres(env);
  if (url.pathname === "/api/tmdb/genres/backfill" && request.method === "POST") return backfillTmdbGenres(request, env);
  if (url.pathname === "/api/tmdb/suggestions" && request.method === "GET") return tmdbSuggestions(url, env);
  const tmdbApply = url.pathname.match(/^\/api\/movies\/(\d+)\/tmdb$/);
  if (tmdbApply && request.method === "POST") return applyTmdbMatch(request,env,Number(tmdbApply[1]));
  const profileMatch = url.pathname.match(/^\/api\/profiles\/(\d+)$/);
  if (profileMatch && request.method === "PUT") return updateProfile(request, env, assertMemberId(profileMatch[1]));

  const ratingMatch = url.pathname.match(/^\/api\/movies\/(\d+)\/rating$/);
  if (ratingMatch && request.method === "PATCH") return updateSharedRating(request, env, Number(ratingMatch[1]));
  const personalMatch = url.pathname.match(/^\/api\/movies\/(\d+)\/member\/(\d+)$/);
  if (personalMatch && request.method === "PATCH") return updateMemberProgress(request, env, Number(personalMatch[1]), assertMemberId(personalMatch[2]));

  const watchesMatch = url.pathname.match(/^\/api\/movies\/(\d+)\/watches$/);
  if (watchesMatch && request.method === "POST") return addViewingEvent(request, env, Number(watchesMatch[1]));
  const watchEventMatch = url.pathname.match(/^\/api\/movies\/(\d+)\/watches\/(\d+)$/);
  if (watchEventMatch && request.method === "DELETE") return deleteViewingEvent(env, Number(watchEventMatch[1]), Number(watchEventMatch[2]));

  const seasonsMatch = url.pathname.match(/^\/api\/movies\/(\d+)\/seasons$/);
  if (seasonsMatch && request.method === "GET") return json({cycles:await listSeriesCycles(env,Number(seasonsMatch[1]))});
  if (seasonsMatch && request.method === "POST") return saveSeasonViewing(request,env,Number(seasonsMatch[1]));
  const cyclesMatch=url.pathname.match(/^\/api\/movies\/(\d+)\/cycles$/);
  if(cyclesMatch&&request.method==="GET")return json({cycles:await listSeriesCycles(env,Number(cyclesMatch[1]))});
  if(cyclesMatch&&request.method==="POST")return createSeriesCycle(env,Number(cyclesMatch[1]));
  const cancelCycleMatch=url.pathname.match(/^\/api\/movies\/(\d+)\/cycles\/(\d+)$/);
  if(cancelCycleMatch&&request.method==="DELETE")
    return cancelEmptySeriesCycle(env,Number(cancelCycleMatch[1]),Number(cancelCycleMatch[2]));
  const closeCycleMatch=url.pathname.match(/^\/api\/movies\/(\d+)\/cycles\/(\d+)\/close$/);
  if(closeCycleMatch&&request.method==="POST")
    return closeSeriesCycle(request,env,Number(closeCycleMatch[1]),Number(closeCycleMatch[2]));
  const seasonEntryMatch = url.pathname.match(/^\/api\/movies\/(\d+)\/seasons\/(\d+)$/);
  if (seasonEntryMatch && request.method === "DELETE")
    return removeSeasonViewing(env,Number(seasonEntryMatch[1]),Number(seasonEntryMatch[2]));
  const watchRatingMatch = url.pathname.match(/^\/api\/movies\/(\d+)\/watches\/(\d+)\/rating$/);
  if (watchRatingMatch && request.method === "PATCH")
    return reviseWatchRating(request,env,Number(watchRatingMatch[1]),Number(watchRatingMatch[2]));
  const historyMatch = url.pathname.match(/^\/api\/movies\/(\d+)\/history$/);
  if (historyMatch && request.method === "GET") {
    return getWatchHistory(env, Number(historyMatch[1]));
  }

  const posterMatch = url.pathname.match(/^\/api\/posters\/(\d+)$/);
  if (posterMatch && request.method === "GET") {
    return getPoster(env, Number(posterMatch[1]));
  }

  if (url.pathname === "/api/export" && request.method === "GET") {
    return exportData(env);
  }
  if (url.pathname === "/api/import/preview" && request.method === "POST") {
    const { summary } = await readBackup(request);
    return json({ summary });
  }
  if (url.pathname === "/api/import" && request.method === "POST") {
    if (request.headers.get("x-confirm-restore") !== "REPLACE_ALL") {
      return json({ error: "Explicit restore confirmation is required." }, 400);
    }
    const { snapshot } = await readBackup(request);
    return restoreBackup(env, snapshot);
  }

  if (url.pathname === "/api/movies" && request.method === "POST") {
    return createMovie(request, env);
  }
  const movieMatch = url.pathname.match(/^\/api\/movies\/(\d+)$/);
  if (movieMatch && request.method === "PUT") return editMovie(request, env, Number(movieMatch[1]));
  if (movieMatch && request.method === "DELETE") return deleteMovie(env, Number(movieMatch[1]));

  const uploadPosterMatch = url.pathname.match(/^\/api\/movies\/(\d+)\/poster$/);
  if (uploadPosterMatch && request.method === "POST") {
    return uploadPoster(request, env, Number(uploadPosterMatch[1]));
  }

  const progressMatch = url.pathname.match(/^\/api\/movies\/(\d+)\/progress$/);
  if (progressMatch && request.method === "PATCH") {
    return updateProgress(request, env, Number(progressMatch[1]));
  }
  if (progressMatch && request.method === "DELETE") {
    return resetProgress(env, Number(progressMatch[1]));
  }

  return json({ error: "Not found." }, 404);
}

export default {
  async scheduled(controller, env) {
    // Cron is UTC. If the storage binding is absent, fail visibly without touching D1.
    const response = await exportData(env);
    if (!response.ok) throw new Error("Could not generate the backup export.");
    const report = await writeWeeklyBackup(env, async () => response.json(), new Date(controller.scheduledTime));
    console.log("Verified weekly catalog backup", { bytes: report.bytes, retained: report.retained, removed: report.removed });
  },
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof Response) return error;
      if (error instanceof ValidationError) return json({ error: error.message }, 400);
      console.error(error);
      return json({ error: "An unexpected server error occurred." }, 500);
    }
  },
};
