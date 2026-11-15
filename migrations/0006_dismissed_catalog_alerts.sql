-- Shared, per-household dismissal of catalog warnings.
-- Apply after 0005 and before deploying the corresponding Worker.
-- Never deletes or modifies movie records or existing viewing history.
CREATE TABLE IF NOT EXISTS dismissed_catalog_alerts (
  alert_key TEXT PRIMARY KEY NOT NULL CHECK (length(alert_key) BETWEEN 1 AND 4096),
  dismissed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
