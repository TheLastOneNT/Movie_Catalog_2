// Strict, versioned backups: validating the entire snapshot BEFORE the D1 transaction.
export const MAX_BACKUP_BYTES = 30_000_000;
const CATEGORIES = new Set(["movies", "series", "cartoons", "documentaries"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class BackupError extends Error {
  constructor(message) { super(message); this.name = "BackupError"; }
}
function ensure(condition, message) { if (!condition) throw new BackupError(message); }
function validString(value, max) { return typeof value === "string" && value.length <= max; }
function validRating(value) { return value == null || (Number.isInteger(value) && value >= 1 && value <= 5); }
function validDate(value) { return value == null || (typeof value === "string" && !Number.isNaN(Date.parse(value))); }
function validId(value) { return Number.isSafeInteger(value) && value > 0; }

export function validateBackup(snapshot) {
  ensure(snapshot && typeof snapshot === "object" && !Array.isArray(snapshot), "Invalid backup file.");
  ensure([3,4,5].includes(snapshot.schemaVersion), "Only Movie Catalog v3/v4/v5 backups can be restored.");
  if (snapshot.schemaVersion >= 4) {
    ensure(Array.isArray(snapshot.seasonViewings) && snapshot.seasonViewings.length <= 20000, "Invalid season viewing history.");
    ensure(Array.isArray(snapshot.ratingChanges) && snapshot.ratingChanges.length <= 40000, "Invalid rating history.");
  }
  if(snapshot.schemaVersion === 5) ensure(Array.isArray(snapshot.seriesCycles) && snapshot.seriesCycles.length <= 20000, "Invalid series cycles.");
  if (snapshot.dismissedCatalogAlerts !== undefined) {
    ensure(Array.isArray(snapshot.dismissedCatalogAlerts) && snapshot.dismissedCatalogAlerts.length <= 1000,
      "Invalid dismissed catalog alerts.");
    const keys = new Set();
    for (const key of snapshot.dismissedCatalogAlerts) {
      ensure(typeof key === "string" && key.length >= 1 && key.length <= 4096 && !keys.has(key),
        "Invalid or duplicate dismissed catalog alert key.");
      keys.add(key);
    }
  }
  ensure(Array.isArray(snapshot.movies) && snapshot.movies.length <= 2000, "Invalid movie collection.");
  ensure(Array.isArray(snapshot.profiles) && snapshot.profiles.length === 2, "Missing family profiles.");
  ensure(Array.isArray(snapshot.watchHistory) && snapshot.watchHistory.length <= 20000, "Invalid viewing history.");
  ensure(Array.isArray(snapshot.watchAttendance) && snapshot.watchAttendance.length <= 40000, "Invalid viewing attendees.");
  ensure(Array.isArray(snapshot.moviePosters) && snapshot.moviePosters.length <= 2000, "Missing poster backup data.");
  const movieIds = new Set(), eventIds = new Set(), posterIds = new Set();
  for (const profile of snapshot.profiles) {
    ensure((profile.id === 1 || profile.id === 2) && validString(profile.name, 32) && profile.name.trim(), "Invalid family profile.");
  }
  ensure(new Set(snapshot.profiles.map(x => x.id)).size === 2, "Two different family profiles are required.");
  for (const movie of snapshot.movies) {
    ensure(validId(movie.id) && !movieIds.has(movie.id), "Invalid/duplicate movie ID.");
    movieIds.add(movie.id);
    ensure(CATEGORIES.has(movie.category), "Invalid movie category.");
    ensure(validString(movie.title, 160) && movie.title.trim(), "Invalid movie title.");
    ensure(movie.titleEn == null || validString(movie.titleEn, 160), "Invalid English title.");
    ensure(movie.description == null || validString(movie.description, 3000), "Invalid movie description.");
    ensure(movie.descriptionEn == null || validString(movie.descriptionEn, 3000), "Invalid English description.");
    ensure(movie.poster == null || validString(movie.poster, 2048), "Invalid movie poster path.");
    ensure(movie.releaseYear == null || (Number.isInteger(movie.releaseYear) && movie.releaseYear >= 1888 && movie.releaseYear <= 2200), "Invalid movie release year.");
    ensure(Number.isInteger(movie.collectionOrder) && movie.collectionOrder >= 0, "Invalid movie position.");
    ensure(movie.tmdbId == null || (Number.isSafeInteger(movie.tmdbId) && movie.tmdbId > 0),
      "Invalid TMDB identifier.");
    ensure(movie.tmdbMediaType == null || ["movie","tv"].includes(movie.tmdbMediaType),
      "Invalid TMDB media type.");
    ensure(movie.genreIds == null || (Array.isArray(movie.genreIds) && movie.genreIds.length <= 40
      && movie.genreIds.every(id=>Number.isSafeInteger(id) && id > 0)),
      "Invalid movie genres.");
    const progress = movie.progress;
    ensure(progress && ["unwatched", "watched"].includes(progress.status), "Invalid viewing status.");
    ensure(validRating(progress.rating) && typeof progress.isFavorite === "boolean" && validDate(progress.lastWatchedAt)
      && validString(progress.notes, 5000), "Invalid shared progress.");
    ensure(movie.members && typeof movie.members === "object", "Missing personal movie data.");
    for (const [id, member] of Object.entries(movie.members)) {
      ensure(id === "1" || id === "2", "Invalid family member data.");
      ensure(validRating(member.rating) && typeof member.isFavorite === "boolean"
        && typeof member.wantsToWatch === "boolean" && validString(member.notes, 5000), "Invalid personal progress.");
    }
  }
  for (const event of snapshot.watchHistory) {
    ensure(snapshot.schemaVersion === 3 || validRating(event.rating), "Invalid viewing rating.");
    ensure(validId(event.id) && !eventIds.has(event.id) && movieIds.has(event.movieId)
      && validDate(event.watchedAt) && event.watchedAt, "Invalid viewing event.");
    eventIds.add(event.id);
  }
  const cycleIds = new Set();
  const cycleMovies = new Map();
  const openCycles = new Set();
  for(const cycle of snapshot.seriesCycles||[]) {
    ensure(validId(cycle.id) && !cycleIds.has(cycle.id) && movieIds.has(cycle.movieId),"Invalid cycle ID.");
    cycleIds.add(cycle.id);cycleMovies.set(cycle.id,cycle.movieId);
    ensure(typeof cycle.startedAt==="string" && /^\d{4}-\d{2}-\d{2}$/.test(cycle.startedAt),"Invalid cycle start.");
    ensure(["watching","completed","stopped"].includes(cycle.outcome),"Invalid cycle outcome.");
    if(cycle.outcome==="watching"){
      ensure(cycle.endedAt==null && !openCycles.has(cycle.movieId),"Invalid active cycle.");
      openCycles.add(cycle.movieId);
    }else ensure(typeof cycle.endedAt==="string" && /^\d{4}-\d{2}-\d{2}$/.test(cycle.endedAt),"Invalid cycle end.");
  }
  const seasonIds = new Set();
  for (const season of (snapshot.seasonViewings || [])) {
    ensure(validId(season.id) && !seasonIds.has(season.id) && movieIds.has(season.movieId), "Invalid season viewing ID.");
    seasonIds.add(season.id);
    if(snapshot.schemaVersion === 5) ensure(cycleMovies.get(season.cycleId)===season.movieId,"Orphan cycle season.");
    ensure(Number.isInteger(season.seasonNumber) && season.seasonNumber >= 1 && season.seasonNumber <= 200,
      "Invalid season number.");
    ensure(typeof season.startedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(season.startedAt) &&
      (!season.finishedAt || (typeof season.finishedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(season.finishedAt) &&
        season.finishedAt >= season.startedAt)) && validRating(season.rating) &&
      (season.finishedAt || season.rating == null), "Invalid season viewing period.");
  }
  const changeIds = new Set();
  for (const change of (snapshot.ratingChanges || [])) {
    ensure(validId(change.id) && !changeIds.has(change.id) && movieIds.has(change.movieId), "Invalid rating history ID.");
    changeIds.add(change.id);
    ensure(["manual","watch","season"].includes(change.sourceType) && validRating(change.rating)
      && change.rating != null && (change.sourceId == null || validId(change.sourceId)), "Invalid rating change.");
    if (change.sourceType === "watch") ensure(eventIds.has(change.sourceId), "Orphan viewing rating.");
    if (change.sourceType === "season") ensure(seasonIds.has(change.sourceId), "Orphan season rating.");
    if (change.sourceType === "manual") ensure(change.sourceId == null, "Invalid manual rating.");
  }
  for (const attendee of snapshot.watchAttendance) {
    ensure(eventIds.has(attendee.watchId) && (attendee.memberId === 1 || attendee.memberId === 2), "Invalid viewing attendee.");
  }
  for (const poster of snapshot.moviePosters) {
    ensure(movieIds.has(poster.movieId) && !posterIds.has(poster.movieId), "Invalid/duplicate poster.");
    posterIds.add(poster.movieId);
    ensure(IMAGE_TYPES.has(poster.contentType) && typeof poster.base64 === "string"
      && /^[A-Za-z0-9+/]*={0,2}$/.test(poster.base64) && poster.base64.length <= 2_100_000, "Invalid poster data.");
  }
  return { movies: snapshot.movies.length, views: snapshot.watchHistory.length, seasons: (snapshot.seasonViewings || []).length, posters: snapshot.moviePosters.length };
}

export function bytesToBase64(data) {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 16384) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 16384));
  }
  return btoa(binary);
}

export function base64ToBytes(value) {
  const raw = atob(value);
  return Uint8Array.from(raw, c => c.charCodeAt(0)).buffer;
}
