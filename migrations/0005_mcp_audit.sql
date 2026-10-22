CREATE TABLE mcp_audit (
 id TEXT PRIMARY KEY NOT NULL,
 started_at TEXT NOT NULL,
 client_id TEXT,
 model TEXT,
 tool TEXT,
 outcome TEXT NOT NULL CHECK(outcome IN ('success','failed','cancelled')),
 status INTEGER NOT NULL,
 input_bytes INTEGER NOT NULL CHECK(input_bytes>=0),
 output_bytes INTEGER NOT NULL CHECK(output_bytes>=0),
 duration_ms INTEGER NOT NULL CHECK(duration_ms>=0)
);
CREATE INDEX mcp_audit_time ON mcp_audit(started_at DESC);
CREATE INDEX mcp_audit_client ON mcp_audit(client_id,started_at DESC);
