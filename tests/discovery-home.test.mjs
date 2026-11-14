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
 assert.match(page,/<option value="watchlist">/);
 assert.match(page,/<option value="favorites">/);
});
test("sort controls offer default, best rated and long unseen",()=>{
 assert.match(page,/<option value="random">Обычный порядок<\/option>/);
 assert.match(page,/<option value="rating">Сначала лучшие<\/option>/);
 assert.match(page,/<option value="oldest">Давно не смотрели<\/option>/);
 assert.doesNotMatch(page,/<option value="title">/);
 assert.doesNotMatch(page,/<option value="recent">/);
});
test("info panel includes film counts and has mobile layout",()=>{
 assert.match(page,/\{watchlistCount\}/);
 assert.match(css,/\.collectionInfoStats/);
});
