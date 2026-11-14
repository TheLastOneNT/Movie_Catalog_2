import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const worker = await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
const page = await readFile(new URL("../app/page.js",import.meta.url),"utf8");
const poster = await readFile(new URL("../public/poster-placeholder.svg",import.meta.url),"utf8");
test("TMDB search uses release year for films and original air year for series",()=>{
 assert.match(worker,/tmdbGet\(env, "search\/movie"/);
 assert.match(worker,/tmdbGet\(env, "search\/tv"/);
 assert.match(worker,/first_air_date_year: year/);
 assert.match(page,/params\.set\("year", String\(form\.releaseYear\)\)/);
});
test("TMDB IDs can recover an ambiguous short-titled film",()=>{
 assert.match(worker,/directId = query\.match/);
 assert.match(worker,/tmdbDetails\(env, "movie", id\)/);
});
test("missing original posters use locally stored multilingual-safe placeholder",()=>{
 assert.match(worker,/posterFromTmdb \|\| "\/poster-placeholder\.svg"/);
 assert.match(page,/match\.posterUrl \|\| "\/poster-placeholder\.svg"/);
 assert.match(poster,/<svg/);
 assert.match(poster,/NO ORIGINAL POSTER/);
});
