import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const page=await readFile(new URL("../app/page.js",import.meta.url),"utf8");
const worker=await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
test("routine family library hides obsolete bulk poster matching",()=>{
  assert.doesNotMatch(page,/PosterReviewPanel|posterReviewOpen|posterReviewLaunch|Подобрать оригинальные постеры и переводы/);
  assert.match(page,/collectionInfoStats/);
});
test("manual TMDB movie creation and editing remain available",()=>{
  assert.match(page,/\/api\/tmdb\/search/);
  assert.match(page,/function AddMovieModal/);
  assert.match(worker,/async function tmdbDetails/);
});
