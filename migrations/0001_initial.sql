PRAGMA foreign_keys=ON;
CREATE TABLE connections(id TEXT PRIMARY KEY,accounts TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(accounts)),import_id TEXT,import_status TEXT CHECK(import_status IN ('pending','running','succeeded','failed')),import_admitted_at TEXT,import_sequence INTEGER NOT NULL DEFAULT 0 CHECK(import_sequence>=0),import_checkpoint TEXT CHECK(import_checkpoint IS NULL OR json_valid(import_checkpoint)),import_error TEXT,last_success_at TEXT);
CREATE TRIGGER connection_limit BEFORE INSERT ON connections WHEN (SELECT count(*) FROM connections)>=10 AND NOT EXISTS(SELECT 1 FROM connections WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'ITEM_LIMIT'); END;
CREATE TABLE transactions(id TEXT PRIMARY KEY NOT NULL,account_id TEXT NOT NULL,date TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('PENDING','POSTED')),direction TEXT NOT NULL CHECK(direction IN ('DEBIT','CREDIT')),currency TEXT NOT NULL,amount_minor TEXT,description TEXT NOT NULL,category TEXT);
CREATE INDEX transaction_date ON transactions(date,account_id,id);
CREATE INDEX transaction_account ON transactions(account_id,date,id);
CREATE INDEX transaction_status ON transactions(status,date);
CREATE INDEX transaction_category ON transactions(category);
