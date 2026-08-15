export function normalizeMovieStatus(status) {
  return status === "watched" ? "watched" : "unwatched";
}

function shuffleRank(id, seed) {
  let value = (Number(id) ^ seed) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function randomizeMovies(movies, seed) {
  return [...movies].sort((left, right) => {
    const difference = shuffleRank(left.id, seed) - shuffleRank(right.id, seed);
    return difference || left.id - right.id;
  });
}

export function sortOldestWatched(movies) {
  return [...movies].sort((left, right) => {
    const leftDate = left.progress.lastWatchedAt || "";
    const rightDate = right.progress.lastWatchedAt || "";
    return leftDate.localeCompare(rightDate) || left.id - right.id;
  });
}
