import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const page = await readFile(new URL("../app/page.js", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");

test("one shared family rating is shown on cards and editable in details", () => {
  assert.match(page, /selected\.progress\.rating \|\| 0/);
  assert.match(page, /const rating = movie\.progress\.rating/);
  assert.match(page, /onChange=\{\(rating\) => updateSharedRating\(selected\.id,rating\)\}/);
  assert.doesNotMatch(page, /updateMember\(selected\.id, \{ rating \}/);
});
test("rating update does not change viewing history or statuses", () => {
  assert.match(worker, /async function updateSharedRating/);
  assert.match(worker, /await registerRating\(env,movieId,input\.rating,"manual"\)/);
  assert.match(worker, /ON CONFLICT\(movie_id\) DO UPDATE SET rating=excluded\.rating/);
  assert.match(worker, /ratingMatch && request\.method === "PATCH"/);
});
test("TMDB searches for artwork in the original language", () => {
  assert.match(worker, /original_language/);
  assert.match(worker, /image.iso_639_1 === originalLanguage/);
});
