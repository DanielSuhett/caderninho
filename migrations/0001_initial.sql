-- Initial schema for new installations. No historical upgrade path is retained.

PRAGMA foreign_keys=ON;

-- Tables

CREATE TABLE connections (
  id TEXT PRIMARY KEY,
  accounts TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(accounts)),
  import_id TEXT,
  import_status TEXT CHECK(import_status IN ('pending','running','succeeded','failed')),
  import_admitted_at TEXT,
  import_sequence INTEGER NOT NULL DEFAULT 0 CHECK(import_sequence>=0),
  import_checkpoint TEXT CHECK(import_checkpoint IS NULL OR json_valid(import_checkpoint)),
  import_error TEXT,
  last_success_at TEXT
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING','POSTED')),
  direction TEXT NOT NULL CHECK(direction IN ('DEBIT','CREDIT')),
  currency TEXT NOT NULL,
  amount_minor TEXT,
  description TEXT NOT NULL,
  category TEXT,
  identification TEXT CHECK(identification IS NULL OR json_valid(identification))
);

CREATE TABLE planning_revision (
  id INTEGER PRIMARY KEY CHECK(id=1),
  revision INTEGER NOT NULL CHECK(revision>=0)
);

CREATE TABLE planning_receipts (
  id TEXT PRIMARY KEY,
  digest TEXT NOT NULL,
  result TEXT NOT NULL CHECK(json_valid(result)),
  created_at TEXT NOT NULL
);

CREATE TABLE planning_spaces (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_accounts (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_cards (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_edits (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_categories (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_tags (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_rules (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_recurrences (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_installments (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_goals (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_contributions (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_investments (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_loans (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_schedules (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_billPayments (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_notifications (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_bills (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_accountDetails (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE planning_transactionDetails (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data))
);

CREATE TABLE people (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  photo TEXT
);

CREATE TABLE pluggy_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  person_id TEXT NOT NULL REFERENCES people(id),
  credential_ref TEXT,
  client_fingerprint TEXT UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1))
);

CREATE TABLE connection_owners (
  connection_id TEXT PRIMARY KEY NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES pluggy_profiles(id),
  person_id TEXT NOT NULL REFERENCES people(id),
  institution TEXT CHECK (institution IS NULL OR json_valid(institution))
);

CREATE TABLE sync_history (
  id TEXT PRIMARY KEY NOT NULL,
  connection_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  admitted_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending','running','succeeded','failed')),
  phase TEXT,
  sequence INTEGER NOT NULL CHECK(sequence>=0),
  error TEXT
);

CREATE TABLE mcp_audit (
  id TEXT PRIMARY KEY NOT NULL,
  started_at TEXT NOT NULL,
  client_id TEXT,
  model TEXT,
  tool TEXT,
  outcome TEXT NOT NULL CHECK(outcome IN ('success','failed','cancelled')),
  status INTEGER NOT NULL,
  input_bytes INTEGER NOT NULL CHECK(input_bytes>=0),
  output_bytes INTEGER NOT NULL CHECK(output_bytes>=0),
  duration_ms INTEGER NOT NULL CHECK(duration_ms>=0)
);

CREATE TABLE planning_category_groups (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL CHECK(json_valid(data))
);

-- Initial installation data

INSERT INTO planning_revision(id,revision) VALUES(1,0);

INSERT INTO planning_spaces(id,data) VALUES('personal','{"id":"personal","name":"Pessoal","icon":"wallet","color":"blue","type":"personal","monthStartDay":1,"budgetEnabled":false,"monthlyBudgetMinor":null,"currency":"BRL"}');

INSERT INTO planning_categories(id,data) VALUES('personal:expense','{"id":"personal:expense","spaceId":"personal","name":"Outras despesas","kind":"expense","hidden":true,"system":true,"limitMinor":null,"color":"#64748b","icon":"shopping","groupId":null}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:academia','{"color":"#db2777","groupId":"personal:group:bem-estar","hidden":false,"icon":"activity","id":"personal:fixed:academia","kind":"expense","limitMinor":null,"name":"Academia","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:aluguel','{"color":"#64748b","groupId":"personal:group:casa","hidden":false,"icon":"home","id":"personal:fixed:aluguel","kind":"expense","limitMinor":null,"name":"Aluguel","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:assinaturas','{"color":"#059669","groupId":"personal:group:lazer","hidden":false,"icon":"star","id":"personal:fixed:assinaturas","kind":"expense","limitMinor":null,"name":"Assinaturas","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:casa','{"color":"#64748b","groupId":"personal:group:casa","hidden":false,"icon":"home","id":"personal:fixed:casa","kind":"expense","limitMinor":null,"name":"Casa","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:casamento','{"color":"#be123c","groupId":"personal:group:compromissos","hidden":false,"icon":"heart","id":"personal:fixed:casamento","kind":"expense","limitMinor":null,"name":"Casamento","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:combustivel','{"color":"#2563eb","groupId":"personal:group:transporte","hidden":false,"icon":"car","id":"personal:fixed:combustivel","kind":"expense","limitMinor":null,"name":"Combustível","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:compras','{"color":"#0891b2","groupId":"personal:group:cotidiano","hidden":false,"icon":"shopping","id":"personal:fixed:compras","kind":"expense","limitMinor":null,"name":"Compras","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:corridas','{"color":"#2563eb","groupId":"personal:group:transporte","hidden":false,"icon":"car","id":"personal:fixed:corridas","kind":"expense","limitMinor":null,"name":"Corridas","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:cuidados-pessoais','{"color":"#db2777","groupId":"personal:group:bem-estar","hidden":false,"icon":"heart","id":"personal:fixed:cuidados-pessoais","kind":"expense","limitMinor":null,"name":"Cuidados Pessoais","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:cursos','{"color":"#7c3aed","groupId":"personal:group:educacao","hidden":false,"icon":"book","id":"personal:fixed:cursos","kind":"expense","limitMinor":null,"name":"Cursos","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:doacoes','{"color":"#be123c","groupId":"personal:group:compromissos","hidden":false,"icon":"gift","id":"personal:fixed:doacoes","kind":"expense","limitMinor":null,"name":"Doações","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:educacao-geral','{"color":"#7c3aed","groupId":"personal:group:educacao","hidden":false,"icon":"book","id":"personal:fixed:educacao-geral","kind":"expense","limitMinor":null,"name":"Educação Geral","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:energia','{"color":"#64748b","groupId":"personal:group:casa","hidden":false,"icon":"home","id":"personal:fixed:energia","kind":"expense","limitMinor":null,"name":"Energia","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:estacionamento-pedagio','{"color":"#2563eb","groupId":"personal:group:transporte","hidden":false,"icon":"car","id":"personal:fixed:estacionamento-pedagio","kind":"expense","limitMinor":null,"name":"Estacionamento e Pedágio","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:faculdade','{"color":"#7c3aed","groupId":"personal:group:educacao","hidden":false,"icon":"book","id":"personal:fixed:faculdade","kind":"expense","limitMinor":null,"name":"Faculdade","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:farmacia','{"color":"#db2777","groupId":"personal:group:bem-estar","hidden":false,"icon":"heart","id":"personal:fixed:farmacia","kind":"expense","limitMinor":null,"name":"Farmácia","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:financiamento','{"color":"#475569","groupId":"personal:group:financas","hidden":false,"icon":"money","id":"personal:fixed:financiamento","kind":"expense","limitMinor":null,"name":"Financiamento","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:gas','{"color":"#64748b","groupId":"personal:group:casa","hidden":false,"icon":"home","id":"personal:fixed:gas","kind":"expense","limitMinor":null,"name":"Gás","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:impostos-taxas','{"color":"#475569","groupId":"personal:group:financas","hidden":false,"icon":"money","id":"personal:fixed:impostos-taxas","kind":"expense","limitMinor":null,"name":"Impostos e Taxas","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:internet','{"color":"#64748b","groupId":"personal:group:casa","hidden":false,"icon":"home","id":"personal:fixed:internet","kind":"expense","limitMinor":null,"name":"Internet","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:investimentos','{"color":"#475569","groupId":"personal:group:financas","hidden":false,"icon":"money","id":"personal:fixed:investimentos","kind":"transfer","limitMinor":null,"name":"Investimentos","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:lanches','{"color":"#d97706","groupId":"personal:group:alimentacao","hidden":false,"icon":"utensils","id":"personal:fixed:lanches","kind":"expense","limitMinor":null,"name":"Lanches","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:lavanderia','{"color":"#0891b2","groupId":"personal:group:cotidiano","hidden":false,"icon":"home","id":"personal:fixed:lavanderia","kind":"expense","limitMinor":null,"name":"Lavanderia","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:lazer','{"color":"#059669","groupId":"personal:group:lazer","hidden":false,"icon":"star","id":"personal:fixed:lazer","kind":"expense","limitMinor":null,"name":"Lazer","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:manutencao','{"color":"#0891b2","groupId":"personal:group:cotidiano","hidden":false,"icon":"home","id":"personal:fixed:manutencao","kind":"expense","limitMinor":null,"name":"Manutenção","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:mercado','{"color":"#d97706","groupId":"personal:group:alimentacao","hidden":false,"icon":"shopping","id":"personal:fixed:mercado","kind":"expense","limitMinor":null,"name":"Mercado","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:odontologia','{"color":"#db2777","groupId":"personal:group:bem-estar","hidden":false,"icon":"heart","id":"personal:fixed:odontologia","kind":"expense","limitMinor":null,"name":"Odontologia","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:petshop','{"color":"#0891b2","groupId":"personal:group:cotidiano","hidden":false,"icon":"heart","id":"personal:fixed:petshop","kind":"expense","limitMinor":null,"name":"Petshop","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:restaurantes','{"color":"#d97706","groupId":"personal:group:alimentacao","hidden":false,"icon":"utensils","id":"personal:fixed:restaurantes","kind":"expense","limitMinor":null,"name":"Restaurantes","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:salario-renda','{"color":"#475569","groupId":"personal:group:financas","hidden":false,"icon":"briefcase","id":"personal:fixed:salario-renda","kind":"income","limitMinor":null,"name":"Salário e Renda","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:saude-geral','{"color":"#db2777","groupId":"personal:group:bem-estar","hidden":false,"icon":"heart","id":"personal:fixed:saude-geral","kind":"expense","limitMinor":null,"name":"Saúde Geral","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:fixed:seguro','{"color":"#be123c","groupId":"personal:group:compromissos","hidden":false,"icon":"heart","id":"personal:fixed:seguro","kind":"expense","limitMinor":null,"name":"Seguro","spaceId":"personal","system":true}');

INSERT INTO planning_categories(id,data) VALUES('personal:income','{"id":"personal:income","spaceId":"personal","name":"Outras receitas","kind":"income","hidden":true,"system":true,"limitMinor":null,"color":"#64748b","icon":"shopping","groupId":null}');

INSERT INTO planning_categories(id,data) VALUES('personal:transfer','{"id":"personal:transfer","spaceId":"personal","name":"Transferências","kind":"transfer","hidden":false,"system":true,"limitMinor":null,"color":"#475569","icon":"transfer","groupId":"personal:group:financas"}');

INSERT INTO people(id,name,photo) VALUES('self','Eu',NULL);

INSERT INTO pluggy_profiles(id,name,person_id,credential_ref,client_fingerprint,enabled) VALUES('default','Pluggy principal','self',NULL,NULL,1);

INSERT INTO planning_category_groups(id,data) VALUES('personal:group:alimentacao','{"color":"#d97706","icon":"utensils","id":"personal:group:alimentacao","name":"Alimentação","spaceId":"personal"}');

INSERT INTO planning_category_groups(id,data) VALUES('personal:group:bem-estar','{"color":"#db2777","icon":"heart","id":"personal:group:bem-estar","name":"Saúde e bem-estar","spaceId":"personal"}');

INSERT INTO planning_category_groups(id,data) VALUES('personal:group:casa','{"color":"#64748b","icon":"home","id":"personal:group:casa","name":"Casa","spaceId":"personal"}');

INSERT INTO planning_category_groups(id,data) VALUES('personal:group:compromissos','{"color":"#be123c","icon":"gift","id":"personal:group:compromissos","name":"Compromissos","spaceId":"personal"}');

INSERT INTO planning_category_groups(id,data) VALUES('personal:group:cotidiano','{"color":"#0891b2","icon":"shopping","id":"personal:group:cotidiano","name":"Cotidiano","spaceId":"personal"}');

INSERT INTO planning_category_groups(id,data) VALUES('personal:group:educacao','{"color":"#7c3aed","icon":"book","id":"personal:group:educacao","name":"Educação","spaceId":"personal"}');

INSERT INTO planning_category_groups(id,data) VALUES('personal:group:financas','{"color":"#475569","icon":"money","id":"personal:group:financas","name":"Finanças","spaceId":"personal"}');

INSERT INTO planning_category_groups(id,data) VALUES('personal:group:lazer','{"color":"#059669","icon":"star","id":"personal:group:lazer","name":"Lazer","spaceId":"personal"}');

INSERT INTO planning_category_groups(id,data) VALUES('personal:group:transporte','{"color":"#2563eb","icon":"car","id":"personal:group:transporte","name":"Transporte","spaceId":"personal"}');

-- Query indexes

CREATE INDEX transaction_date ON transactions(date,account_id,id);

CREATE INDEX transaction_account ON transactions(account_id,date,id);

CREATE INDEX connection_owner_person ON connection_owners(person_id,connection_id);

CREATE INDEX connection_owner_profile ON connection_owners(profile_id,connection_id);

CREATE INDEX sync_history_order ON sync_history(admitted_at DESC,id DESC);

CREATE INDEX sync_history_person ON sync_history(person_id,admitted_at DESC,id DESC);

CREATE INDEX mcp_audit_client ON mcp_audit(client_id,started_at DESC);

CREATE INDEX mcp_audit_time ON mcp_audit(started_at DESC,id DESC);

CREATE INDEX sync_history_status ON sync_history(status,admitted_at DESC,id DESC);

CREATE INDEX transaction_status ON transactions(status,date,account_id,id);

CREATE INDEX transaction_category ON transactions(category,date,account_id,id);

CREATE INDEX transaction_posted_totals ON transactions(direction,currency,date,account_id,amount_minor,category) WHERE status='POSTED';

-- Atomic publication, ownership and rule application

CREATE TRIGGER planning_connections_insert AFTER INSERT ON connections BEGIN UPDATE planning_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER planning_connections_update AFTER UPDATE ON connections BEGIN UPDATE planning_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER planning_connections_delete AFTER DELETE ON connections BEGIN UPDATE planning_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER planning_transactions_insert AFTER INSERT ON transactions BEGIN UPDATE planning_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER planning_transactions_update AFTER UPDATE ON transactions BEGIN UPDATE planning_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER planning_transactions_delete AFTER DELETE ON transactions BEGIN UPDATE planning_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER connection_default_owner AFTER INSERT ON connections
BEGIN
  INSERT INTO connection_owners(connection_id,profile_id,person_id)
  VALUES(NEW.id,'default','self');
END;

CREATE TRIGGER connection_owner_revision AFTER UPDATE ON connection_owners BEGIN UPDATE planning_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER people_revision AFTER UPDATE ON people BEGIN UPDATE planning_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER profile_revision AFTER UPDATE ON pluggy_profiles BEGIN UPDATE planning_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER profile_client_immutable BEFORE UPDATE OF client_fingerprint ON pluggy_profiles WHEN OLD.client_fingerprint IS NOT NULL AND NEW.client_fingerprint IS NOT OLD.client_fingerprint BEGIN SELECT RAISE(ABORT,'PROFILE_CLIENT_IMMUTABLE'); END;

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
