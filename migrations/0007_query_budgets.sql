-- Preserve the existing time range index while making ties deterministic without
-- sorting every audit row that shares a timestamp. No extra index per MCP call.
DROP INDEX mcp_audit_time;
CREATE INDEX mcp_audit_time ON mcp_audit(started_at DESC,id DESC);

-- Status is an equality filter before the history cursor and ordering columns.
-- Keep the existing person index for unfiltered per-person history.
CREATE INDEX sync_history_status ON sync_history(status,admitted_at DESC,id DESC);

-- Existing installations have already applied 0001: update their transaction
-- indexes here instead of changing the initial migration retroactively.
DROP INDEX transaction_status;
CREATE INDEX transaction_status ON transactions(status,date,account_id,id);
DROP INDEX transaction_category;
CREATE INDEX transaction_category ON transactions(category,date,account_id,id);
CREATE INDEX IF NOT EXISTS transaction_posted_totals ON transactions(direction,currency,date,account_id,amount_minor,category) WHERE status='POSTED';
