import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const page=await readFile(new URL("../app/page.js",import.meta.url),"utf8");
const worker=await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
const backup=await readFile(new URL("../worker/backup.js",import.meta.url),"utf8");
const migration=await readFile(new URL("../migrations/0007_tmdb_genres.sql",import.meta.url),"utf8");

test("movie title can be cleared with one accessible button",()=>{
 assert.match(page,/Очистить название/);
 assert.match(page,/update\("title",""\)/);
 assert.match(page,/setTmdbMatches\(\[\]\)/);
});
test("one period calendar selects start/end with direct month/year jumps",()=>{
 const calendar=page.slice(page.indexOf("function SeasonRangeCalendar("),page.indexOf("function SeasonTracker("));
 assert.match(calendar,/className="seasonRangeTrigger"/);
 assert.match(calendar,/className="seasonCalendarGrid"/);
 assert.match(calendar,/className="seasonCalendarJump"/);
 assert.match(calendar,/aria-label=\{en\?"Month":"Месяц"\}/);
 assert.match(calendar,/aria-label=\{en\?"Year":"Год"\}/);
 assert.match(calendar,/setStage\("end"\)/);
 assert.match(calendar,/onChange\(start,date\)/);
 assert.doesNotMatch(calendar,/seasonNativeDateRange/);
});
test("unmatched TMDB records are explicitly visible and genre types normalized",()=>{
 assert.match(worker,/async function listUnresolvedTmdbGenres/);
 assert.match(page,/unresolvedGenres.map\(movie/);
 assert.match(page,/nonGenreIds = new Set\(\[16, 99\]\)/);
 assert.match(page,/genreLabels/);
 assert.match(page,/cleanGenreLabel/);
});
test("watched series is supported with a real rated and dated season",()=>{
 const create=worker.slice(worker.indexOf("async function createMovie("),worker.indexOf("async function ensurePosterTable("));
 assert.match(create,/const watchedSeries = input.status === "watched" && input.category === "series"/);
 assert.match(create,/INSERT INTO series_cycles/);
 assert.match(create,/INSERT INTO season_viewings/);
 assert.match(create,/await registerRating/);
 assert.match(create,/await refreshViewingSummary/);
 assert.match(page,/<option value="watched">\{labels.catalog.watched\}<\/option>/);
 assert.match(page,/start=\{form.startedAt\} end=\{form.lastWatchedAt\}/);
 assert.match(page,/seasonNumber: form.category==="series"/);
});
test("two useful states plus reversible year and rating sorting",()=>{
 assert.match(page,/const statusOrder = \["watched"\]/);
 assert.match(page,/status === "watchlist"/);
 assert.match(page,/<option value="year">/);
 assert.match(page,/setSortDirection\(current=>current==="desc"\?"asc":"desc"\)/);
 assert.match(page,/if\(left==null\)return 1/);
});
test("genre collection is additive and includes old and future TMDB data",()=>{
 assert.match(migration,/ALTER TABLE movies ADD COLUMN genre_ids/);
 assert.doesNotMatch(migration,/DROP TABLE|DELETE FROM movies/);
 assert.match(worker,/tmdbReference.*null/);
 assert.match(worker,/async function backfillTmdbGenres/);
 assert.match(worker,/if\(viable.length!==1\)/);
 assert.match(worker,/tmdb_id IS NULL/);
 assert.match(page,/matchesGenreFilter\(movie.genreIds, genre\)/);
 assert.match(page,/\/api\/tmdb\/genres\/backfill/);
});
test("restorable JSON exports carry genre metadata while old exports remain valid",()=>{
 assert.match(worker,/genreIds:.*JSON.parse\(row.genre_ids/);
 assert.match(worker,/JSON.stringify\(movie.genreIds \|\| \[\]\)/);
 assert.match(backup,/movie.genreIds == null \|\|/);
});
