import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const worker=await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
const page=await readFile(new URL("../app/page.js",import.meta.url),"utf8");
const backup=await readFile(new URL("../worker/backup.js",import.meta.url),"utf8");
const migration=await readFile(new URL("../migrations/0004_season_viewings.sql",import.meta.url),"utf8");
test("additive D1 migration keeps legacy watch records",()=>{
 assert.match(migration,/ALTER TABLE watch_history ADD COLUMN rating/);
 assert.match(migration,/CREATE TABLE season_viewings/);
 assert.doesNotMatch(migration,/DROP TABLE|DELETE FROM/);
});
test("movie watch accepts a rating per occurrence and preserves history",()=>{
 assert.match(worker,/const rating = validateViewingRating\(body.rating\)/);
 assert.match(worker,/INSERT OR IGNORE INTO watch_history\(movie_id, watched_at, rating\)/);
 assert.match(worker,/async function reviseWatchRating/);
 assert.match(page,/updateWatchRating\(event.id,rating\)/);
});
test("series record supports season and period with rating",()=>{
 assert.match(worker,/season_number AS seasonNumber/);
 assert.match(worker,/finished_at AS finishedAt/);
 assert.match(worker,/if \(!finish && rating !== null\)/);
 assert.match(page,/function SeasonTracker/);
 assert.match(page,/seasonNumber,startedAt,finishedAt:finishedAt \|\| null,rating:/);
});
test("v4 backup includes per-viewing ratings and season history",()=>{
 assert.match(worker,/schemaVersion: 4/);
 assert.match(worker,/ratingChanges: ratingRows.results/);
 assert.match(worker,/refreshCurrentRating/);
 assert.match(worker,/seasonViewings: seasonEntries.results/);
 assert.match(worker,/watched_at, rating, created_at/);
 assert.match(worker,/DELETE FROM season_viewings/);
 assert.match(backup,/schemaVersion === 4/);
});
