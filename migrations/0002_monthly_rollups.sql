CREATE TABLE planning_monthly_rollups (
  scope TEXT NOT NULL,
  month TEXT NOT NULL,
  version TEXT NOT NULL,
  data TEXT NOT NULL CHECK(json_valid(data)),
  PRIMARY KEY(scope, month)
);
