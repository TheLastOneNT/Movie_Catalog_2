// Match exact titles after harmless Unicode, case, punctuation and whitespace variations.
// Keep the category and release year as distinct identity fields: remakes may share names.
export function normalizeTitle(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/g, " ").trim()
    : "";
}

export function findDuplicateTitle(candidates, incoming, excludedId = null) {
  const names = [incoming.title, incoming.titleEn].map(normalizeTitle).filter(Boolean);
  if (!names.length) return null;
  const year = incoming.releaseYear == null || incoming.releaseYear === "" ? null : Number(incoming.releaseYear);
  return candidates.find((movie) => {
    if (movie.id === excludedId || movie.category !== incoming.category) return false;
    const candidateYear = movie.releaseYear == null || movie.releaseYear === "" ? null : Number(movie.releaseYear);
    if (candidateYear !== year) return false;
    return [movie.title, movie.titleEn].some((title) => names.includes(normalizeTitle(title)));
  }) || null;
}
