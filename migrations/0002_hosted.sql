-- Additive only: existing finance, history and manually registered users are preserved.
CREATE TABLE pluggy_credentials (
  principal TEXT PRIMARY KEY REFERENCES principals(id),
  client_id_hash TEXT NOT NULL,
  manual_sync_after TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  reconcile_after TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  envelope TEXT NOT NULL CHECK(json_valid(envelope)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  next_sync_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX pluggy_credentials_due ON pluggy_credentials(enabled, next_sync_at);
CREATE TABLE portal_logins (
  id TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  verifier TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE portal_sessions (
  id TEXT PRIMARY KEY,
  principal TEXT NOT NULL REFERENCES principals(id),
  csrf TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX portal_sessions_expiry ON portal_sessions(expires);

CREATE TRIGGER pluggy_application_immutable BEFORE UPDATE OF client_id_hash ON pluggy_credentials
WHEN NEW.client_id_hash <> OLD.client_id_hash
BEGIN SELECT RAISE(ABORT, 'APPLICATION_CHANGE_REQUIRES_MIGRATION'); END;
CREATE TRIGGER hosted_item_limit BEFORE INSERT ON items
WHEN (SELECT COUNT(*) FROM items WHERE principal=NEW.principal) >= 10
AND NOT EXISTS(SELECT 1 FROM items WHERE principal=NEW.principal AND id=NEW.id)
BEGIN SELECT RAISE(ABORT, 'ITEM_LIMIT'); END;
