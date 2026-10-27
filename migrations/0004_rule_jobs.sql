-- Rule imports and reapplications run as durable background jobs. Uploaded rules
-- stay in chunks so files of any size are processed in bounded native imports.
CREATE TABLE rule_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data))
);
CREATE INDEX rule_jobs_space ON rule_jobs(space_id, created_at);
CREATE TABLE rule_job_chunks (
  job_id TEXT NOT NULL REFERENCES rule_jobs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  rules TEXT NOT NULL CHECK (json_valid(rules)),
  result TEXT CHECK (result IS NULL OR json_valid(result)),
  PRIMARY KEY (job_id, seq)
);
