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
  ensure(snapshot.schemaVersion === 3, "Only complete Movie Catalog v3 backups can be restored.");
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
    ensure(validId(event.id) && !eventIds.has(event.id) && movieIds.has(event.movieId)
      && validDate(event.watchedAt) && event.watchedAt, "Invalid viewing event.");
    eventIds.add(event.id);
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
  return { movies: snapshot.movies.length, views: snapshot.watchHistory.length, posters: snapshot.moviePosters.length };
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
