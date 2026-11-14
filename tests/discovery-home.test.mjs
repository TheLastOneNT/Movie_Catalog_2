import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const page = await readFile(new URL("../app/page.js",import.meta.url),"utf8");
const css = await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
test("top level header provides a dedicated info panel and one random action",()=>{
 assert.match(page,/collectionInfoButton/);
 assert.match(page,/collectionInfoOpen &&/);
 assert.match(page,/Что посмотрим\?/);
 assert.doesNotMatch(page,/className="catalogStats"/);
});
test("status dropdown retains only actionable filters",()=>{
 assert.doesNotMatch(page,/<option value="rewatch">/);
 assert.doesNotMatch(page,/<option value="rated">/);
 assert.doesNotMatch(page,/<option value="favorites">/);
 assert.match(page,/<option value="watchlist">/);
});
test("sort controls offer default, best rated and long unseen",()=>{
 assert.match(page, /<option value="random">\{language === "en" \? "Default order" : "Обычный порядок"\}<\/option>/);
 assert.match(page, /<option value="rating">\{language === "en" \? "Highest rated" : "Сначала лучшие"\}<\/option>/);
 assert.match(page, /<option value="oldest">\{language === "en" \? "Longest since watched" : "Давно не смотрели"\}<\/option>/);
 assert.doesNotMatch(page,/<option value="title">/);
 assert.doesNotMatch(page,/<option value="recent">/);
});
test("info panel includes film counts and has mobile layout",()=>{
 assert.match(page,/\{watchlistCount\}/);
 assert.doesNotMatch(page,/fiveStarCount/);
 assert.match(css,/\.collectionInfoStats/);
});
