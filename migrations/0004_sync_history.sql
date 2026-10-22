-- Keep one durable row per admitted run. Updating progress never creates a new run.
CREATE TABLE sync_history(
 id TEXT PRIMARY KEY NOT NULL,
 connection_id TEXT NOT NULL,
 person_id TEXT NOT NULL,
 profile_id TEXT NOT NULL,
 admitted_at TEXT NOT NULL,
 finished_at TEXT,
 status TEXT NOT NULL CHECK(status IN ('pending','running','succeeded','failed')),
 phase TEXT,
 sequence INTEGER NOT NULL CHECK(sequence>=0),
 error TEXT,
 legacy INTEGER NOT NULL DEFAULT 0 CHECK(legacy IN (0,1))
);
CREATE INDEX sync_history_order ON sync_history(admitted_at DESC,id DESC);
CREATE INDEX sync_history_person ON sync_history(person_id,admitted_at DESC,id DESC);
INSERT INTO sync_history
 SELECT c.import_id,c.id,coalesce(o.person_id,'self'),coalesce(o.profile_id,'default'),c.import_admitted_at,
 CASE WHEN c.import_status='succeeded' THEN c.last_success_at ELSE NULL END,
 c.import_status,json_extract(c.import_checkpoint,'$.phase'),c.import_sequence,c.import_error,1
 FROM connections c LEFT JOIN connection_owners o ON o.connection_id=c.id
 WHERE c.import_id IS NOT NULL AND c.import_admitted_at IS NOT NULL AND c.import_status IS NOT NULL;
CREATE TRIGGER sync_history_progress AFTER UPDATE OF import_id,import_status,import_sequence,import_checkpoint,import_error ON connections
 WHEN NEW.import_id IS NOT NULL AND NEW.import_admitted_at IS NOT NULL AND NEW.import_status IS NOT NULL
 BEGIN
 INSERT INTO sync_history(id,connection_id,person_id,profile_id,admitted_at,finished_at,status,phase,sequence,error)
 VALUES(NEW.import_id,NEW.id,
 coalesce((SELECT person_id FROM connection_owners WHERE connection_id=NEW.id),'self'),
 coalesce((SELECT profile_id FROM connection_owners WHERE connection_id=NEW.id),'default'),
 NEW.import_admitted_at,CASE WHEN NEW.import_status IN ('succeeded','failed') THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END,
 NEW.import_status,json_extract(NEW.import_checkpoint,'$.phase'),NEW.import_sequence,NEW.import_error)
 ON CONFLICT(id) DO UPDATE SET finished_at=coalesce(sync_history.finished_at,excluded.finished_at),status=excluded.status,phase=excluded.phase,sequence=excluded.sequence,error=excluded.error;
 END;
