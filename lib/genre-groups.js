// TMDB uses different genre IDs for movies and TV shows.
// Combined TV genres should be searchable under each meaningful movie genre,
// rather than becoming duplicate entries in the household genre filter.
const GENRE_EQUIVALENTS = new Map([
  [10759, [28, 12]],    // Action & Adventure -> Action + Adventure
  [10765, [878, 14]],   // Sci-Fi & Fantasy -> Science Fiction + Fantasy
  [10768, [10752]],     // War & Politics -> War
]);

export function normalizeGenreIds(ids) {
  const normalized = new Set();
  for (const id of Array.isArray(ids) ? ids : []) {
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    for (const canonical of GENRE_EQUIVALENTS.get(id) || [id]) {
      normalized.add(canonical);
    }
  }
  return [...normalized];
}

export function matchesGenreFilter(ids, genre) {
  if (genre === "all") return true;
  const numericGenre = Number(genre);
  return Number.isSafeInteger(numericGenre) && normalizeGenreIds(ids).includes(numericGenre);
}
