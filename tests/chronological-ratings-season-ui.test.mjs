import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
const page = await readFile(new URL("../app/page.js",import.meta.url),"utf8");
const css = await readFile(new URL("../app/globals.css",import.meta.url),"utf8");

test("films keep chronological latest viewing ratings",()=>{
  const start=worker.indexOf("const EFFECTIVE_RATING_SQL");
  const end=worker.indexOf("function mapMovie(",start);
  const sql=worker.slice(start,end);
  assert.match(sql,/ORDER BY substr\(wh\.watched_at,1,10\) DESC/);
  assert.match(sql,/SELECT wh.rating FROM watch_history wh/);
  assert.match(sql,/WHERE wh.movie_id=m.id/);
});
test("series average each season's most recent rated completed viewing",()=>{
  const sql=worker.slice(worker.indexOf("const EFFECTIVE_RATING_SQL"),worker.indexOf("function mapMovie("));
  assert.match(sql,/CASE WHEN m\.category='series' THEN/);
  assert.match(sql,/ROUND\(AVG\(latest\.rating\),1\)/);
  assert.match(sql,/sc.outcome IN \(\x27completed\x27,\x27stopped\x27\)/);
  assert.match(sql,/PARTITION BY sv.cycle_id,sv.season_number/);
  assert.match(sql,/latest\.ranking=1/);
});

test("season viewings are listed by dates rather than season number",()=>{
  assert.match(worker,/ORDER BY COALESCE\(finished_at,started_at\) DESC,started_at DESC,id DESC/);
});
test("watch history shows date and compact editable rating in same row",()=>{
  assert.equal((page.match(/className="watchEventLine"/g)||[]).length,2);
  assert.equal((page.match(/className="watchEventRatingSelect"/g)||[]).length,2);
  assert.doesNotMatch(page,/className="watchEventRating"><Stars/);
  assert.match(css,/\.historyPanel \.watchEventLine \{ display:flex;/);
});
test("series start/end and movie dates share the native iOS picker",()=>{
  const range=page.slice(page.indexOf("function SeasonRangeCalendar("),page.indexOf("function SeasonTracker("));
  assert.match(range,/className="seasonNativeDateRange"/);
  assert.equal((range.match(/<ViewingDateField/g)||[]).length,2);
  assert.match(css,/\.seasonNativeDateRange/);
  assert.doesNotMatch(range,/seasonCalendarGrid|changeMonth/);
  assert.doesNotMatch(page,/CompactDateField/);
});

test("season selector and compact history use one row",()=>{
  assert.match(page,/Array.from\(\{length:30\}/);
  assert.equal((page.match(/className="watchEventRatingSelect"/g)||[]).length,2);
});
