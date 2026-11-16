import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {averageRatedSeasons} from "../lib/series-cycles.js";
const server=await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
const ui=await readFile(new URL("../app/page.js",import.meta.url),"utf8");
const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
const migration=await readFile(new URL("../migrations/0005_series_cycles.sql",import.meta.url),"utf8");
const season=(id,seasonNumber,rating,finishedAt,startedAt=finishedAt)=>({id,seasonNumber,rating,finishedAt,startedAt});
test("five rated seasons of six count when a cycle is stopped",()=>{
 assert.deepEqual(averageRatedSeasons([
   season(1,1,1,"2026-01-05"),season(2,2,2,"2026-01-06"),season(3,3,2,"2026-01-07"),
   season(4,4,2,"2026-01-08"),season(5,5,3,"2026-01-09"),
   season(6,6,null,null,"2026-01-10")
 ]),{average:2,ratedSeasons:5});
});
test("latest rated rewatch per season counts once inside its own cycle",()=>{
 assert.deepEqual(averageRatedSeasons([
   season(1,1,3,"2026-01-10"),season(2,1,5,"2026-01-15"),
   season(3,2,4,"2026-01-12"),season(4,3,5,"2026-01-13"),
 ]),{average:4.7,ratedSeasons:3});
});
test("unfinished season contributes no rating, even if started",()=>{
 assert.deepEqual(averageRatedSeasons([season(5,2,null,null,"2026-02-03")]),
   {average:null,ratedSeasons:0});
});
test("server requires explicit cycle closure for headline rating",()=>{
 assert.match(server,/sc.outcome IN \('completed','stopped'\)/);
 assert.match(server,/async function closeSeriesCycle/);
 assert.match(server,/input.outcome/);
 assert.match(server,/Number\(existing\?\.rated\)/);
});
test("migration preserves old seasons under a single labelled legacy cycle",()=>{
 assert.match(migration,/CREATE TABLE series_cycles/);
 assert.match(migration,/ALTER TABLE season_viewings ADD COLUMN cycle_id/);
 assert.match(migration,/UPDATE season_viewings SET cycle_id=/);
 assert.doesNotMatch(migration,/DROP TABLE|DELETE FROM/);
});
test("UI groups dates per viewing cycle and offers two stop outcomes",()=>{
 assert.match(ui,/className="seriesCycle"/);
 assert.match(ui,/closeCycle\(cycle.id,"completed"\)/);
 assert.match(ui,/closeCycle\(cycle.id,"stopped"\)/);
});
test("one calendar widget serves both add and detail, with required add score",()=>{
 assert.match(ui,/function ViewingDateField/);
 assert.match(ui,/<input type="date" aria-label=\{label\}/);
 assert.match(ui,/Set the viewing date and rating before saving|Choose viewing date and rating/);
 assert.match(ui,/form.status==="watched" && \(!form.lastWatchedAt \|\| form.rating==null/);
 assert.match(ui,/form.category==="series" && \(!form.startedAt/);
 assert.match(css,/\.posterLightboxContent img \{ width:100%; max-width:100%; height:100%; max-height:calc\(100dvh - 58px\)/);
});
