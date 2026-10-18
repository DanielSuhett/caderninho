-- Incremental upgrade: preserve operations, receipts and financial identities.
ALTER TABLE items ADD COLUMN next_import_at TEXT;
ALTER TABLE items ADD COLUMN last_admitted_at TEXT;
ALTER TABLE items ADD COLUMN last_import_at TEXT;
-- Controlled pointer; keeping this free of a forward FK preserves D1 export order.
ALTER TABLE items ADD COLUMN cycle_id TEXT;
ALTER TABLE items ADD COLUMN notice_generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN last_notice_id TEXT;
ALTER TABLE items ADD COLUMN notice_claimed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN notice_consumed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN renormalize_generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE operations ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'durable';
ALTER TABLE operations ADD COLUMN compacted INTEGER NOT NULL DEFAULT 0;
-- Retain the unused legacy column for a code rollback during the transition.

-- Unknown history reserves a conservative window; new Items retain NULL.
UPDATE items SET last_admitted_at = COALESCE(
  (SELECT max(o.created_at) FROM operations o, json_each(o.input, '$.itemIds') i
   WHERE i.value=items.id AND o.kind IN ('sync','reconcile','webhook')),
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
);
UPDATE items SET next_import_at = strftime('%Y-%m-%dT%H:%M:%fZ',last_admitted_at,'+24 hours'),
  cycle_id = (SELECT o.id FROM operations o, json_each(o.input, '$.itemIds') i
    WHERE i.value=items.id AND o.kind IN ('sync','reconcile','webhook')
    ORDER BY o.created_at DESC LIMIT 1);
UPDATE items SET last_import_at=(SELECT max(o.updated_at) FROM operations o, json_each(o.input,'$.itemIds') i
  WHERE i.value=items.id AND o.kind IN ('sync','reconcile','webhook') AND o.status='completed' AND o.phase<>'error');
-- Unlinked legacy notices become one intention, never another Workflow.
UPDATE items SET notice_generation=1 WHERE EXISTS
  (SELECT 1 FROM inbox WHERE inbox.item_id=items.id AND processed_at IS NULL);
UPDATE inbox SET processed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE operation_id IS NULL AND processed_at IS NULL;

CREATE INDEX operations_active ON operations(status,execution_mode,dispatched,created_at);
CREATE INDEX operations_retention ON operations(updated_at,id)
  WHERE status<>'working' AND compacted=0;
CREATE INDEX inbox_retention ON inbox(processed_at,event_id)
  WHERE processed_at IS NOT NULL AND payload<>'{}';
UPDATE operations SET compacted=1 WHERE status<>'working'
  AND NOT EXISTS(SELECT 1 FROM checkpoints WHERE operation_id=operations.id)
  AND NOT EXISTS(SELECT 1 FROM page_commits WHERE operation_id=operations.id)
  AND NOT EXISTS(SELECT 1 FROM operation_targets WHERE operation_id=operations.id);

CREATE TABLE local_runs (
  operation_id TEXT PRIMARY KEY REFERENCES operations(id),
  expected_revision INTEGER NOT NULL CHECK(expected_revision>=0),
  active_rules TEXT,
  after_identity TEXT NOT NULL DEFAULT '[]',
  next_batch INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE local_receipts (
  operation_id TEXT NOT NULL REFERENCES operations(id),
  batch INTEGER NOT NULL,
  result TEXT NOT NULL CHECK(json_valid(result)),
  PRIMARY KEY(operation_id,batch)
);
