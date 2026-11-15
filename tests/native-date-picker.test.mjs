import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const page=await readFile(new URL("../app/page.js",import.meta.url),"utf8");
const css=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
test("add and detail share the actual native date input, not month-only navigation",()=>{
  const start=page.indexOf("function ViewingDateField(");
  const end=page.indexOf("function AddMovieModal(",start);
  const field=page.slice(start,end);
  assert.match(field,/<input type="date"/);
  assert.match(field,/onChange=\{\(event\)=>onChange\(event.target.value\)\}/);
  assert.doesNotMatch(field,/changeMonth|navigate\(|seasonCalendarGrid|monthIndex/);
  assert.match(page,/language=\{language\} max=\{todayLocal\(\)\}/);
  assert.match(page,/language=\{labels.locale==="en-US"\?"en":"ru"\}/);
});
test("native date input fits stable full-width shell on iPhone",()=>{
  assert.match(css,/\.viewingDateField input\[type="date"\] \{ position:absolute;/);
  assert.match(css,/\.viewingDateField \{ position:relative; display:flex; width:100%; max-width:100%; min-width:0;/);
});
