-- Additive: existing principals, credentials and finance history remain untouched.
ALTER TABLE portal_sessions ADD COLUMN auth_version TEXT NOT NULL DEFAULT '';
CREATE TABLE login_attempts (
  id TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE mcp_receipts (
  id TEXT PRIMARY KEY,
  principal TEXT NOT NULL REFERENCES principals(id),
  client_id TEXT NOT NULL,
  received_at TEXT NOT NULL
);
CREATE INDEX mcp_receipts_owner ON mcp_receipts(principal);
