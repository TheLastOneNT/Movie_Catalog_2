import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server=await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
const page=await readFile(new URL("../app/page.js",import.meta.url),"utf8");

test("direct TMDB numeric IDs search both movie and TV namespaces",()=>{
  const start=server.indexOf("async function searchTmdb(");
  const end=server.indexOf("async function listTmdbGenres(",start);
  const search=server.slice(start,end);
  assert.match(search,/\["movie", "tv"\]/);
  assert.match(search,/Promise\.allSettled\(types\.map\(type=>tmdbDetails\(env,type,id\)\)\)/);
  assert.match(search,/types\[index\]==="tv"\?"series"/);
  assert.match(search,/const directId = query\.match/);
  assert.match(search,/tmdb:\(\?:\(tv\|movie\):\)\?/);
});
test("manual matcher keeps category safeguards and explains TV/movie mismatch",()=>{
  assert.match(page,/otherTypeFound/);
  assert.match(page,/тип не совпадает с категорией/);
  assert.match(page,/tmdb:tv:64480/);
  assert.match(page,/\{item.releaseYear\|\|"\?"\}/);
  assert.match(server,/tmdbMediaType\(existing.category\)!==input.mediaType/);
});
