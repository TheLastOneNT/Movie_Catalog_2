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


// A candidate pair is a warning, never proof of duplication.
// Stable IDs plus identity values let dismissed warnings reappear if either title changes.
export function findPotentialDuplicatePairs(candidates) {
  const groups = new Map();
  for (const movie of candidates) {
    if (!Number.isSafeInteger(movie.id) || !movie.category) continue;
    const year = movie.releaseYear == null || movie.releaseYear === "" ? "" : String(movie.releaseYear);
    const names = [...new Set([movie.title, movie.titleEn].map(normalizeTitle).filter(Boolean))];
    for (const name of names) {
      const groupKey = JSON.stringify([movie.category, year, name]);
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(movie);
    }
  }
  const pairs = new Map();
  for (const [groupKey, group] of groups) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const [first, second] = [group[i], group[j]].sort((a,b)=>a.id-b.id);
        const ids = `${first.id}:${second.id}`;
        if (!pairs.has(ids)) pairs.set(ids,{first,second,key:JSON.stringify([ids,first.category,first.releaseYear ?? null,
          [first.title,first.titleEn].map(normalizeTitle).sort(),
          [second.title,second.titleEn].map(normalizeTitle).sort()])});
      }
    }
  }
  return [...pairs.values()].sort((a,b)=>a.first.id-b.first.id || a.second.id-b.second.id);
}
