import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const page = await readFile(new URL("../app/page.js", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
test("iPhone date field cannot expand outside modal", () => {
  assert.match(css, /\.watchDate input\[type="date"\][^\n]*min-width: 0/);
});
test("compact list puts actions beside rather than over poster", () => {
  assert.match(page, /className="cardQuickActions"/);
  assert.match(css, /\.movieCardList \.cardQuickActions \{ grid-column: 3/);
  assert.match(css, /\.movieCardList \.posterFrame \{ grid-column: 1/);
});
test("mobile sorting dropdown uses full row", () => {
  assert.match(css, /\.toolbar > select \{ grid-column: 1 \/ -1/);
});
test("view deletion uses custom Russian buttons rather than browser confirm", () => {
  assert.match(page, /role="alertdialog"/);
  assert.match(page, />Отмена<\/button>/);
  assert.match(page, />Удалить<\/button>/);
  assert.doesNotMatch(page, /window\.confirm\(t\.family\.confirmRemoveWatch\)/);
});
