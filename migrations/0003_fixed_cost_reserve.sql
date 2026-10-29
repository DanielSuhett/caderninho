CREATE TABLE planning_reserves (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

-- Category groups give way to a fixed-cost flag on each category.
UPDATE planning_categories
SET data = json_set(json_remove(data, '$.groupId'), '$.fixedCost', json('false'));
UPDATE planning_categories
SET data = json_set(data, '$.fixedCost', json('true'))
WHERE json_extract(data, '$.system') = 1
  AND instr(id, ':fixed:') > 0
  AND substr(id, instr(id, ':fixed:') + 7) IN (
    'aluguel', 'energia', 'faculdade', 'farmacia', 'financiamento', 'gas',
    'impostos-taxas', 'internet', 'mercado', 'saude-geral', 'seguro'
  );
DROP TABLE planning_category_groups;
UPDATE planning_revision SET revision = revision + 1;
