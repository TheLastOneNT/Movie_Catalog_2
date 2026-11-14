import test from "node:test";import assert from "node:assert/strict";import {readFile} from "node:fs/promises";
const w=await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
const p=await readFile(new URL("../app/page.js",import.meta.url),"utf8");
const c=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
test("headline scores are computed from date-linked film and season viewings",()=>{
  const sql=w.slice(w.indexOf("const EFFECTIVE_RATING_SQL"),w.indexOf("function mapMovie("));
  assert.match(sql,/SELECT wh.rating FROM watch_history wh/);
  assert.match(sql,/ORDER BY substr\(wh.watched_at,1,10\) DESC/);
  assert.match(sql,/ROUND\(AVG\(latest.rating\),1\)/);
  assert.doesNotMatch(sql,/source_type='manual'/);
  assert.doesNotMatch(p,/updateSharedRating\(selected.id/);
});
test("new watched film saves initial rating on dated history entry",()=>{
  assert.match(w,/UPDATE watch_history SET rating=\? WHERE movie_id=\? AND watched_at=\?/);
  assert.match(w,/bind\(progressInput.rating,movieId,normalized.value.lastWatchedAt\)/);
  assert.doesNotMatch(w,/registerRating\(env,movieId,progressInput.rating,"manual"\)/);
});
test("new want-to-watch selection persists as household watchlist",()=>{
  assert.match(p,/<option value="watchlist">/);
  assert.match(p,/wantToWatch: form.status === "watchlist"/);
  assert.match(w,/input.wantToWatch === true/);
  assert.match(w,/member_progress\(movie_id,member_id,wants_to_watch\)/);
});
test("poster enlarges inside authenticated detail modal",()=>{
  assert.match(p,/className="modalPosterZoom"/);
  assert.match(p,/className="posterLightbox"/);
  assert.match(c,/\.posterLightbox \{ position:fixed;/);
});
test("create modal and both date fields use stable viewport layout",()=>{
  assert.match(p,/function ViewingDateField/);
  assert.match(p,/className="viewingDateFieldText"/);
  assert.match(c,/\.viewingDateField input\[type="date"\] \{ position:absolute;/);
  assert.match(c,/\.addMovieModal \{ width:100%; height:calc\(100dvh/);
});
