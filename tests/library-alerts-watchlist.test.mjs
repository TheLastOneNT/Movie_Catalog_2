import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { findPotentialDuplicatePairs } from "../lib/title-duplicates.js";

const movie = (id,title,year=1984,category="movies",titleEn="") => ({
  id,title,titleEn,releaseYear:year,category,poster:"/poster-placeholder.svg",
});

test("shows an existing exact-title collision as a single actionable pair", () => {
  const alerts=findPotentialDuplicatePairs([movie(8,"Дюна",1984,"movies","Dune"),movie(3,"Дюна",1984,"movies","Dune")]);
  assert.equal(alerts.length,1);
  assert.deepEqual([alerts[0].first.id,alerts[0].second.id],[3,8]);
  assert.ok(alerts[0].key);
});

test("pairs catch cross-language matches but do not flag remakes or distinct categories", () => {
  const alerts=findPotentialDuplicatePairs([
    movie(1,"Дюна",1984,"movies","Dune"),
    movie(2,"Dune",1984),
    movie(3,"Дюна",2021,"movies","Dune"),
    movie(4,"Dune",1984,"series"),
  ]);
  assert.equal(alerts.length,1);
  assert.deepEqual([alerts[0].first.id,alerts[0].second.id],[1,2]);
});

test("dismissals are stable until either record changes or disappears", () => {
  const a=movie(1,"Dune"),b=movie(2,"Dune");
  const original=findPotentialDuplicatePairs([a,b])[0].key;
  assert.equal(findPotentialDuplicatePairs([b,a])[0].key,original);
  assert.notEqual(findPotentialDuplicatePairs([a,{...b,titleEn:"Film"}])[0].key,original);
  assert.deepEqual(findPotentialDuplicatePairs([a]),[]);
});

test("multiple collisions produce each unordered pair once", () => {
  const alerts=findPotentialDuplicatePairs([movie(1,"Dune",1984,"movies","Дюна"),movie(2,"Dune",1984,"movies","Дюна"),movie(3,"Dune",1984,"movies","Дюна")]);
  assert.equal(alerts.length,3);
});

test("catalog has accessible watchlist badges in grid and list views",async()=>{
  const page=await readFile(new URL("../app/page.js",import.meta.url),"utf8");
  assert.match(page,/inWatchlist = !watched/);
  assert.match(page,/cardRatingBadge watchlist/);
  assert.match(page,/listRatingLabel watchlist/);
  assert.match(page,/libraryAlertDismiss/);
  assert.match(page,/movie-catalog-dismissed-alerts-v1/);
  assert.match(page,/onClick=\{\(\) => openAlertMovie\(movie.id\)\}/);
});
