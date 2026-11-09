-- Travel becomes a fixed category in every space. Provider travel labels move
-- from Lazer to Viagens, so the revision bump also discards cached rollups.
INSERT INTO planning_categories(id, data)
SELECT
  s.id || ':fixed:viagens',
  json_object(
    'color', '#059669',
    'fixedCost', json('false'),
    'hidden', json('false'),
    'icon', 'plane',
    'id', s.id || ':fixed:viagens',
    'kind', 'expense',
    'limitMinor', NULL,
    'name', 'Viagens',
    'spaceId', s.id,
    'system', json('true')
  )
FROM planning_spaces s
WHERE NOT EXISTS (
  SELECT 1 FROM planning_categories c WHERE c.id = s.id || ':fixed:viagens'
);
UPDATE planning_revision SET revision = revision + 1;
