import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const worker = await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
const page = await readFile(new URL("../app/page.js",import.meta.url),"utf8");
test("TMDB title and description are fetched separately for Russian and English",()=>{
  assert.match(worker, /language: "ru-RU"/);
  assert.match(worker, /language: "en-US"/);
  assert.match(worker, /descriptionEn: en.overview \|\| ""/);
  assert.match(worker, /titleEn: getTitle\(en\)/);
});
test("English descriptions persist on create and edit",()=>{
  assert.match(worker, /const descriptionEn = optionalText\(input.descriptionEn/);
  assert.match(worker, /description_ru = \?, description_en = \?/);
  assert.match(page, /descriptionEn: match.descriptionEn \|\| ""/);
  assert.match(page, /value=\{form.descriptionEn \|\| ""\}/);
});
test("poster proposals require a separate explicit user action before writing",()=>{
  const previews = worker.slice(worker.indexOf("async function tmdbSuggestions("),worker.indexOf("async function applyTmdbMatch("));
  assert.doesNotMatch(previews,/UPDATE movies|INSERT INTO movie_posters|DELETE FROM movies/);
  assert.match(page, /backupConfirmed/);
  assert.match(page, /selected.length/);
  assert.match(page, /\/api\/tmdb\/suggestions/);
});
test("existing movie update retains shared viewing progress and Russian titles",()=>{
  const apply = worker.slice(worker.indexOf("async function applyTmdbMatch("),worker.indexOf("async function archiveTmdbPoster("));
  assert.doesNotMatch(apply,/UPDATE movie_progress|DELETE FROM watch_history|title_ru\s*=/);
  assert.match(apply,/title_en/);
  assert.match(apply,/description_en/);
});
test("language selection uses local storage and keeps both interfaces available",()=>{
  assert.match(page, /savedLanguage === "en" \? "en" : "ru"/);
  assert.match(page, /onClick=\{\(\) => changeLanguage\("en"\)\}/);
  assert.match(page, /onClick=\{\(\) => changeLanguage\("ru"\)\}/);
});
