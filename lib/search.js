export function normalizeSearchText(value, locale = "ru-RU") {
  return String(value ?? "")
    .toLocaleLowerCase(locale)
    .replaceAll("ё", "е")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesMovieQuery(movie, query, locale = "ru-RU") {
  const normalizedQuery = normalizeSearchText(query, locale);
  if (!normalizedQuery) return true;

  return [movie.title, movie.titleEn]
    .filter(Boolean)
    .some((title) => normalizeSearchText(title, locale).includes(normalizedQuery));
}
