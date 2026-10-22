CREATE TABLE planning_revision(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL CHECK(revision>=0));
INSERT INTO planning_revision VALUES(1,0);
CREATE TABLE planning_receipts(id TEXT PRIMARY KEY, digest TEXT NOT NULL, result TEXT NOT NULL CHECK(json_valid(result)), created_at TEXT NOT NULL);
CREATE TABLE planning_spaces(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_accounts(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_cards(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_edits(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_categories(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_tags(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_rules(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_recurrences(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_installments(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_goals(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_contributions(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_investments(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_loans(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_schedules(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_billPayments(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_notifications(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_bills(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_accountDetails(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE TABLE planning_transactionDetails(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
INSERT INTO planning_spaces VALUES('personal','{"id":"personal","name":"Pessoal","icon":"wallet","color":"blue","type":"personal","monthStartDay":1,"budgetEnabled":false,"monthlyBudgetMinor":null,"currency":"BRL"}');
INSERT INTO planning_categories VALUES('personal:expense','{"id": "personal:expense", "spaceId": "personal", "name": "Outras despesas", "kind": "expense", "hidden": false, "system": true, "limitMinor": null}');
INSERT INTO planning_categories VALUES('personal:income','{"id": "personal:income", "spaceId": "personal", "name": "Outras receitas", "kind": "income", "hidden": false, "system": true, "limitMinor": null}');
INSERT INTO planning_categories VALUES('personal:transfer','{"id": "personal:transfer", "spaceId": "personal", "name": "Transferências", "kind": "transfer", "hidden": false, "system": true, "limitMinor": null}');
CREATE TRIGGER planning_connections_insert AFTER INSERT ON connections BEGIN UPDATE planning_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER planning_connections_update AFTER UPDATE ON connections BEGIN UPDATE planning_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER planning_connections_delete AFTER DELETE ON connections BEGIN UPDATE planning_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER planning_transactions_insert AFTER INSERT ON transactions BEGIN UPDATE planning_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER planning_transactions_update AFTER UPDATE ON transactions BEGIN UPDATE planning_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER planning_transactions_delete AFTER DELETE ON transactions BEGIN UPDATE planning_revision SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER planning_apply_new_transaction_rules AFTER INSERT ON transactions
BEGIN
  INSERT OR IGNORE INTO planning_edits(id,data)
  SELECT NEW.id,json_object('id',NEW.id,'accountId',NEW.account_id,'manual',json('false'),'category',json_extract(data,'$.categoryId'))
  FROM planning_rules
  WHERE json_extract(data,'$.enabled')=1
    AND json_extract(data,'$.spaceId')=coalesce((SELECT json_extract(data,'$.spaceId') FROM planning_accounts WHERE id=NEW.account_id),'personal')
    AND (json_extract(data,'$.accountId') IS NULL OR json_extract(data,'$.accountId')=NEW.account_id)
    AND (json_extract(data,'$.direction') IS NULL OR json_extract(data,'$.direction')=NEW.direction)
    AND instr(lower(NEW.description),lower(json_extract(data,'$.text')))>0
  ORDER BY CAST(json_extract(data,'$.priority') AS INTEGER),id LIMIT 1;
END;
