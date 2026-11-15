import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { findDuplicateTitle, normalizeTitle } from "../lib/title-duplicates.js";

const movies = [
  {id:1,title:"Тёмный рыцарь",titleEn:"The Dark Knight",category:"movies",releaseYear:2008},
  {id:2,title:"Дюна",titleEn:"Dune",category:"movies",releaseYear:1984},
  {id:3,title:"Дюна",titleEn:"Dune",category:"movies",releaseYear:2021},
];

test("Unicode normalization, case and harmless punctuation cannot evade duplicate matching", () => {
  assert.equal(normalizeTitle(" THE—DARK  KNIGHT! "), "the dark knight");
  assert.equal(normalizeTitle("Ｆｉｌｍ"), "film");
  assert.equal(findDuplicateTitle(movies,{title:"the dark knight",category:"movies",releaseYear:2008})?.id,1);
  assert.equal(findDuplicateTitle(movies,{title:"  ТЁМНЫЙ  РЫЦАРЬ",category:"movies",releaseYear:2008})?.id,1);
});

test("different release years and categories remain distinct", () => {
  assert.equal(findDuplicateTitle(movies,{title:"Dune",category:"movies",releaseYear:2021})?.id,3);
  assert.equal(findDuplicateTitle(movies,{title:"Dune",category:"movies",releaseYear:2024}),null);
  assert.equal(findDuplicateTitle(movies,{title:"Dune",category:"series",releaseYear:2021}),null);
});

test("editing the same title is allowed, editing into a duplicate is rejected", () => {
  assert.equal(findDuplicateTitle(movies,{title:"Dune",category:"movies",releaseYear:2021},3),null);
  assert.equal(findDuplicateTitle(movies,{title:"Dune",category:"movies",releaseYear:2021},2)?.id,3);
});

test("API rejects duplicate titles before insert/update with 409", async () => {
  const worker=await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
  const create=worker.slice(worker.indexOf("async function createMovie("),worker.indexOf("async function ensurePosterTable("));
  const edit=worker.slice(worker.indexOf("async function editMovie("),worker.indexOf("async function deleteMovie("));
  assert.match(create,/findExistingMovie/);
  assert.match(create,/duplicateId:existing.id/);
  assert.ok(create.indexOf("if (existing)") < create.indexOf("INSERT INTO movies"));
  assert.match(edit,/findExistingMovie/);
  assert.ok(edit.indexOf("if (existing)") < edit.indexOf("UPDATE movies SET"));
});
