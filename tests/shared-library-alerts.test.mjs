import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
const page = await readFile(new URL("../app/page.js",import.meta.url),"utf8");
const backup = await readFile(new URL("../worker/backup.js",import.meta.url),"utf8");
const migration = await readFile(new URL("../migrations/0006_dismissed_catalog_alerts.sql",import.meta.url),"utf8");

test("additive table stores alert keys without touching movies or history",()=>{
  assert.match(migration,/CREATE TABLE IF NOT EXISTS dismissed_catalog_alerts/);
  assert.match(migration,/alert_key TEXT PRIMARY KEY/);
  assert.doesNotMatch(migration,/DELETE FROM|DROP TABLE|ALTER TABLE movies/i);
});

test("dismiss endpoints are guarded by the normal family session",()=>{
  const handle=worker.slice(worker.indexOf("async function handleApi("));
  const auth=handle.indexOf("if (!(await isAuthorized(request, env)))");
  const read=handle.indexOf('url.pathname === "/api/catalog/alerts/dismissed" && request.method === "GET"');
  const write=handle.indexOf('url.pathname === "/api/catalog/alerts/dismissed" && request.method === "POST"');
  assert.ok(auth > 0 && auth < read && auth < write);
  assert.match(worker,/INSERT OR IGNORE INTO dismissed_catalog_alerts/);
  assert.match(worker,/SELECT alert_key AS alertKey FROM dismissed_catalog_alerts/);
});

test("full backup round-trips shared dismissals and accepts older v5 exports",()=>{
  assert.match(worker,/dismissedCatalogAlerts: await listDismissedCatalogAlerts\(env\)/);
  assert.match(worker,/snapshot\.dismissedCatalogAlerts \|\| \[\]/);
  assert.match(worker,/"DELETE FROM dismissed_catalog_alerts"/);
  assert.match(backup,/snapshot\.dismissedCatalogAlerts !== undefined/);
  assert.match(backup,/!keys\.has\(key\)/);
});

test("browser refreshes shared warnings and waits for successful save",()=>{
  assert.match(page,/fetch\("\/api\/catalog\/alerts\/dismissed"/);
  assert.match(page,/if \(collectionInfoOpen && authState === "authenticated"/);
  assert.match(page,/if \(!response\.ok\) throw new Error\("Could not dismiss this warning."\)/);
  assert.match(page,/setDismissedLibraryAlerts\(\(current\)=>current\.includes\(key\)/);
  assert.doesNotMatch(page,/localStorage\.setItem\("movie-catalog-dismissed-alerts-v1"/);
});
