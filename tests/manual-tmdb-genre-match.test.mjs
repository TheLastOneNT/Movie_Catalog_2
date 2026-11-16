import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const worker=await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
const page=await readFile(new URL("../app/page.js",import.meta.url),"utf8");
const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");

test("family login guards genre match endpoint and route",()=>{
  const auth=worker.indexOf("if (!(await isAuthorized(request, env)))");
  const route=worker.indexOf("const genreMatch=url.pathname.match");
  assert.ok(auth>=0&&route>auth);
  assert.ok(worker.includes("tmdb-genres$/"));
});
test("manual genre binding changes no posters, film titles, history or ratings",()=>{
  const endpoint=worker.slice(worker.indexOf("async function matchTmdbGenresOnly("),worker.indexOf("async function applyTmdbMatch("));
  assert.match(endpoint,/tmdbMediaType\(existing.category\)!==input.mediaType/);
  assert.match(endpoint,/UPDATE movies/);
  assert.match(endpoint,/SET tmdb_id=\?,tmdb_media_type=\?,genre_ids=\?/);
  assert.doesNotMatch(endpoint,/DELETE|UPDATE watch_history|UPDATE movie_progress|INSERT INTO movie_posters|SET poster_path/);
});
test("unresolved movie modal allows choosing a verified TMDB result explicitly",()=>{
  assert.match(page,/function TmdbGenreMatcher/);
  assert.match(page,/!selected.tmdbId&&<TmdbGenreMatcher/);
  assert.match(page,/window.confirm\(prompt\)/);
  assert.match(page,/\/tmdb-genres/);
  assert.match(page,/onMatched\(data.movie\)/);
  assert.match(css,/\.tmdbGenreMatcherResults/);
});
