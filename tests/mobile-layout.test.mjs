import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.js", import.meta.url), "utf8");
const manifest = await readFile(new URL("../app/manifest.js", import.meta.url), "utf8");

test("iPhone standalone layout respects safe areas", () => {
  assert.match(css, /--safe-top:\s*env\(safe-area-inset-top/);
  assert.match(css, /\.modalBackdrop\s*\{[^}]*var\(--safe-top\)/s);
  assert.match(layout, /statusBarStyle:\s*"black"/);
});

test("mobile posters stay inside their section", () => {
  assert.match(css, /\.modalPoster\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.modalPoster img\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(css, /\.modalInfo\s*\{[^}]*background:\s*#111114/s);
});

test("the PWA uses the padded application icon", () => {
  assert.match(layout, /apple:\s*"\/app-icon-v2\.png"/);
  assert.match(manifest, /src:\s*"\/app-icon-v2\.png"/);
});
