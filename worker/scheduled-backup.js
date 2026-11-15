// Private Cloudflare R2 snapshot rotation for the family catalog.
// No public endpoint, no shared access key in the archive, no production writes to D1.
const PREFIX = "family-catalog/weekly/";
const RETAIN = 12;
const MAX_ARCHIVE_BYTES = 30_000_000;
const encoder = new TextEncoder();

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function archiveSha256(bytes) {
  return hex(await crypto.subtle.digest("SHA-256", bytes));
}

async function listAllBackups(bucket) {
  const objects = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix: PREFIX, ...(cursor ? {cursor} : {}), limit: 1000 });
    objects.push(...page.objects);
    if (page.truncated && !page.cursor) throw new Error("R2 backup listing returned no continuation cursor.");
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
}

export async function writeWeeklyBackup(env, exportSnapshot, now = new Date()) {
  if (!env.DB) throw new Error("Backup cancelled: D1 binding is missing.");
  if (!env.BACKUP_BUCKET) throw new Error("Backup cancelled: private R2 bucket is not configured.");

  // The existing export includes viewing history, seasons, profiles, ratings, poster BLOBs.
  // Check compatibility with the existing validated JSON restore format before any storage write.
  const snapshot = await exportSnapshot();
  const validation = await import("./backup.js");
  validation.validateBackup(snapshot);
  const raw = JSON.stringify(snapshot);
  const bytes = encoder.encode(raw);
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error("Backup exceeds the supported 30 MB JSON restore limit.");

  const digest = await archiveSha256(bytes);
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const key = `${PREFIX}${stamp}-${digest.slice(0, 12)}.json`;
  const existing = await env.BACKUP_BUCKET.head(key);
  if (existing) {
    // Never silently overwrite a prior snapshot.
    throw new Error("Backup key already exists; the previous snapshot was preserved.");
  }
  await env.BACKUP_BUCKET.put(key, bytes, {
    httpMetadata: { contentType: "application/json" },
    customMetadata: {sha256: digest, schemaVersion: String(snapshot.schemaVersion)},
  });

  // Read back the actual stored bytes and verify content, not just successful HTTP status.
  const saved = await env.BACKUP_BUCKET.get(key);
  if (!saved) throw new Error("R2 snapshot verification failed: stored object not found.");
  const savedBytes = await saved.arrayBuffer();
  if (savedBytes.byteLength !== bytes.byteLength || await archiveSha256(savedBytes) !== digest) {
    throw new Error("R2 snapshot verification failed: checksum or size mismatch; retention was NOT applied.");
  }

  // Only after verifying the new snapshot do we prune the oldest snapshots.
  const objects = await listAllBackups(env.BACKUP_BUCKET);
  const ordered = objects.sort((a, b) => b.key.localeCompare(a.key));
  const stale = ordered.slice(RETAIN);
  for (const item of stale) await env.BACKUP_BUCKET.delete(item.key);
  return { key, bytes: bytes.byteLength, sha256: digest, retained: ordered.length - stale.length, removed: stale.length };
}
