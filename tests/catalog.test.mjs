import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMovieStatus, randomizeMovies, sortOldestWatched } from "../lib/catalog.js";

const movies = [
  { id: 1, progress: { lastWatchedAt: "2026-08-10T00:00:00.000Z" } },
  { id: 2, progress: { lastWatchedAt: null } },
  { id: 3, progress: { lastWatchedAt: "2025-01-01T00:00:00.000Z" } },
];

test("random order is stable for one seed and changes with another", () => {
  const largerCatalog = Array.from({ length: 20 }, (_, index) => ({ id: index + 1 }));
  const first = randomizeMovies(largerCatalog, 123).map((movie) => movie.id);
  assert.deepEqual(randomizeMovies(largerCatalog, 123).map((movie) => movie.id), first);
  assert.notDeepEqual(randomizeMovies(largerCatalog, 456).map((movie) => movie.id), first);
});

test("oldest watched order keeps never-watched titles first", () => {
  assert.deepEqual(sortOldestWatched(movies).map((movie) => movie.id), [2, 3, 1]);
});

test("legacy statuses are presented as unwatched", () => {
  assert.equal(normalizeMovieStatus("planned"), "unwatched");
  assert.equal(normalizeMovieStatus("watched"), "watched");
});
