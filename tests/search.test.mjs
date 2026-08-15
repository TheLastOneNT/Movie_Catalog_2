import test from "node:test";
import assert from "node:assert/strict";
import { matchesMovieQuery, normalizeSearchText } from "../lib/search.js";

test("normalizes Russian е and ё as the same letter", () => {
  assert.equal(normalizeSearchText("Крёстный отец"), "крестный отец");
  assert.equal(normalizeSearchText("КРЕСТНЫЙ ОТЕЦ"), "крестный отец");
});

test("matches Russian titles regardless of е or ё spelling", () => {
  const movie = { title: "Крёстный отец", titleEn: "The Godfather" };

  assert.equal(matchesMovieQuery(movie, "крестный отец"), true);
  assert.equal(matchesMovieQuery({ ...movie, title: "Крестный отец" }, "крёстный"), true);
});

test("matches either localized title", () => {
  const movie = { title: "Крёстный отец", titleEn: "The Godfather" };

  assert.equal(matchesMovieQuery(movie, "godfather"), true);
});
