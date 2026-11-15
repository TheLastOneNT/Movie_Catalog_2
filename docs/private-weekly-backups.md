# Private weekly backups (Cloudflare R2)

This feature is **not live merely because this PR is merged**. Production deployment requires configuring R2 first.

## Initial activation (once)

1. Download and securely store a **manual full JSON export** from the authenticated catalog. It contains the D1 poster images and household viewing data. Never commit it.
2. In Cloudflare R2, create a **private** bucket named `movie-catalog-private-backups`. Do not enable an r2.dev/public domain or public bucket access.
3. Ensure the `BACKUP_BUCKET` binding in `wrangler.jsonc` points to that private bucket. Check the resource name matches exactly.
4. Apply pending D1 migrations in the correct order after taking a recovery point: `npm run db:migrate:remote`. Migration 0006 must exist before deploying a Worker that reads/writes shared warning acknowledgments. Validate 0004/0005 are installed in production first.
5. Run `npm run check` and `npx wrangler deploy --dry-run --outdir .wrangler-dry-run`. Then deploy only after checks pass.
6. Test the cron handler with a *local R2/D1 test environment* or a controlled scheduled invocation, verify the resulting object and its checksum, and download the snapshot to validate with the site's existing import preview.
7. Observe at least one successful production execution before considering backups active. Monitor Cloudflare Workers Observability/Cron trigger past events for failures. Failed schedules must be investigated. No automatic external notification has been configured.

## Behavior and guarantees

- Cron: `0 3 * * SUN` (03:00 UTC Sunday, 07:00 Asia/Tbilisi).
- Uses the same full v5 JSON export format as the in-app Export button, including posters and optional dismissed library alerts.
- Produces a private object `family-catalog/weekly/<timestamp>-<digest>.json`, retaining the **12 latest verified weekly snapshots**.
- SHA-256 and archive byte count are checked by reading back the full object before deleting any old archives.
- Fails closed if D1/R2 bindings are absent, data fails snapshot validation, the file exceeds 30 MB, or R2 read-back fails. No old archive is pruned in those cases.
- Retention is based on the number of objects, **not R2 lifecycle rules**; do not configure conflicting lifecycle deletion rules.
- This is an application-level JSON backup, **not** a raw SQLite/D1 snapshot. For disaster recovery of indexes/schema, retain a separate D1 backup/recovery point.
- A single R2 bucket in the same Cloudflare account is not an independent off-account disaster-recovery destination. Periodically download encrypted copies to a separate secure location.
- This feature does **not** upload secrets, credentials, cookies or tokens.
- If the archive grows beyond 30 MB, migrate to a streaming or multipart backup design before relying on it.
- No browser-facing API permits listing or downloading these snapshots. Restore is intentionally a manual reviewed action through the existing import preview.

## Restoration

1. Identify a dated, successfully verified R2 object.
2. Download it through an authorized Cloudflare administrator account.
3. Keep a separate manual export of the current database before replacing anything.
4. Validate the downloaded JSON with the authenticated `Import preview` feature; confirm schema compatibility and counts before a full restore.
5. Restore only after explicitly confirming the destructive replacement. Check movie, watch, ratings, season diary and poster data after recovery.
