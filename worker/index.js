import { normalizeProgressPatch, ValidationError } from "./progress.js";

const SESSION_COOKIE = "movie_catalog_session";
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
    collectionOrder: row.collection_order,
    progress: {
      status: row.status || "unwatched",
      rating: row.rating,
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
    status: row?.status || "unwatched",
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
  const result = await env.DB.prepare(`
    SELECT
      m.id, m.category, m.title_ru, m.title_en, m.description_ru, m.description_en,
      m.poster_path, m.release_year, m.collection_order,
      p.status, p.rating, p.is_favorite, p.last_watched_at, p.watch_count,
      p.notes, p.updated_at AS progress_updated_at
    FROM movies m
    LEFT JOIN movie_progress p ON p.movie_id = m.id
    ORDER BY m.collection_order ASC
  `).all();

  return result.results.map(mapMovie);
}

async function updateProgress(request, env, movieId) {
  const movie = await env.DB.prepare("SELECT id FROM movies WHERE id = ?").bind(movieId).first();
  if (!movie) return json({ error: "Movie not found." }, 404);

  const currentRow = await getProgress(env, movieId);
  const current = mapProgress(currentRow);
  const input = await readJson(request);
  const normalized = normalizeProgressPatch(input, current);
  const now = new Date().toISOString();

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

  return json({ progress: mapProgress(await getProgress(env, movieId)) });
}

async function resetProgress(env, movieId) {
  const movie = await env.DB.prepare("SELECT id FROM movies WHERE id = ?").bind(movieId).first();
  if (!movie) return json({ error: "Movie not found." }, 404);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM watch_history WHERE movie_id = ?").bind(movieId),
    env.DB.prepare("DELETE FROM movie_progress WHERE movie_id = ?").bind(movieId),
  ]);
  return json({ progress: mapProgress(null) });
}

async function exportData(env) {
  const [catalog, history] = await Promise.all([
    listCatalog(env),
    env.DB.prepare(
      "SELECT movie_id AS movieId, watched_at AS watchedAt, created_at AS createdAt FROM watch_history ORDER BY watched_at DESC",
    ).all(),
  ]);
  return json({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    movies: catalog,
    watchHistory: history.results,
  });
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

  if (url.pathname === "/api/catalog" && request.method === "GET") {
    return json({ movies: await listCatalog(env), updatedAt: new Date().toISOString() });
  }

  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);

  if (url.pathname === "/api/export" && request.method === "GET") {
    return exportData(env);
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
