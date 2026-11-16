import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeGenreIds, matchesGenreFilter } from "../lib/genre-groups.js";

test("War & Politics (TV) and War (movie) share one War filter",()=>{
  assert.deepEqual(normalizeGenreIds([10752,10768]),[10752]);
  assert.equal(matchesGenreFilter([10768],"10752"),true);
  assert.equal(matchesGenreFilter([10752],"10768"),false);
});
test("Sci-Fi & Fantasy appears under sci-fi and fantasy, without duplicate mixed genre",()=>{
  assert.deepEqual(normalizeGenreIds([878,10765,14]),[878,14]);
  assert.equal(matchesGenreFilter([10765],"878"),true);
  assert.equal(matchesGenreFilter([10765],"14"),true);
  assert.deepEqual(normalizeGenreIds([10765]),[878,14]);
});
test("Action & Adventure distributes to both distinct, useful genre filters",()=>{
  assert.deepEqual(normalizeGenreIds([10759,28,12]),[28,12]);
  assert.equal(matchesGenreFilter([10759],"28"),true);
  assert.equal(matchesGenreFilter([10759],"12"),true);
});
test("Genre normalization tolerates old or absent metadata and preserves other genres",()=>{
  assert.deepEqual(normalizeGenreIds(undefined),[]);
  assert.deepEqual(normalizeGenreIds([0,"878",35,35,18,10768]),[35,18,10752]);
  assert.equal(matchesGenreFilter([], "all"),true);
  assert.equal(matchesGenreFilter([], "35"),false);
});
test("Catalog filters and genre tags use the same canonicalization",async()=>{
  const page=await readFile(new URL("../app/page.js",import.meta.url),"utf8");
  assert.match(page,/movies.flatMap\(movie=>normalizeGenreIds\(movie.genreIds\)\)/);
  assert.match(page,/matchesGenreFilter\(movie.genreIds, genre\)/);
  assert.match(page,/normalizeGenreIds\(selected.genreIds\)\.map\(id=>/);
});
