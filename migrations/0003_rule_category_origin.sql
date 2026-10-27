-- Preserve manual classifications while allowing automatic ones to be reapplied.
-- Existing overrides have unknown origin and remain protected.
DROP TRIGGER planning_apply_new_transaction_rules;
CREATE TRIGGER planning_apply_new_transaction_rules AFTER INSERT ON transactions
BEGIN
  INSERT OR IGNORE INTO planning_edits(id,data)
  SELECT NEW.id,json_object('id',NEW.id,'accountId',NEW.account_id,'manual',json('false'),'category',json_extract(data,'$.categoryId'),'categoryRuleId',rule.id)
  FROM planning_rules rule
  WHERE json_extract(data,'$.enabled')=1
    AND json_extract(data,'$.spaceId')=coalesce((SELECT json_extract(data,'$.spaceId') FROM planning_accounts WHERE id=NEW.account_id),'personal')
    AND (json_extract(data,'$.accountId') IS NULL OR json_extract(data,'$.accountId')=NEW.account_id)
    AND (json_extract(data,'$.direction') IS NULL OR json_extract(data,'$.direction')=NEW.direction)
    AND instr(lower(NEW.description),lower(json_extract(data,'$.text')))>0
    AND (json_extract(rule.data,'$.filter') IS NULL OR (
      (json_extract(rule.data,'$.filter.currency') IS NULL OR json_extract(rule.data,'$.filter.currency')=NEW.currency)
      AND EXISTS (
        SELECT 1 FROM json_each(rule.data,'$.filter.alternatives') alternative
        WHERE NOT EXISTS (
          WITH predicates AS (
            SELECT
              json_extract(condition.value,'$.field') AS field,
              json_extract(condition.value,'$.operator') AS operator,
              CASE WHEN json_extract(condition.value,'$.field')='description'
                THEN lower(json_extract(condition.value,'$.value'))
                ELSE json_extract(condition.value,'$.value') END AS expected,
              CASE json_extract(condition.value,'$.field')
                WHEN 'description' THEN lower(NEW.description)
                WHEN 'amount' THEN ltrim(NEW.amount_minor,'-')
                WHEN 'direction' THEN NEW.direction
                WHEN 'status' THEN NEW.status
                WHEN 'accountId' THEN NEW.account_id
                WHEN 'personId' THEN coalesce((
                  SELECT owner.person_id FROM connections connection
                  JOIN connection_owners owner ON owner.connection_id=connection.id
                  JOIN json_each(connection.accounts) account
                  WHERE account.key=NEW.account_id LIMIT 1
                ),'self')
                WHEN 'date' THEN NEW.date
              END AS actual
            FROM json_each(alternative.value,'$.conditions') condition
          )
          SELECT 1 FROM predicates WHERE coalesce(
            CASE WHEN field='amount' THEN
              actual IS NOT NULL AND CASE operator
                WHEN 'equals' THEN actual=expected
                WHEN 'gte' THEN length(actual)>length(expected)
                  OR (length(actual)=length(expected) AND actual>=expected)
                WHEN 'lte' THEN length(actual)<length(expected)
                  OR (length(actual)=length(expected) AND actual<=expected)
                ELSE 0 END
            ELSE CASE operator
              WHEN 'equals' THEN actual=expected
              WHEN 'contains' THEN instr(actual,expected)>0
              WHEN 'not_contains' THEN instr(actual,expected)=0
              WHEN 'starts_with' THEN substr(actual,1,length(expected))=expected
              WHEN 'gte' THEN actual>=expected
              WHEN 'lte' THEN actual<=expected
              ELSE 0 END
            END,0)=0
        )
      )
    ))
  ORDER BY (json_extract(data,'$.pack.id') IS NOT NULL),
    CAST(json_extract(data,'$.priority') AS INTEGER),id LIMIT 1;
END;
