-- Every record in an installation belongs to its owner.
DROP TRIGGER pluggy_application_immutable;
ALTER TABLE settings DROP COLUMN client_id_hash;
ALTER TABLE items DROP COLUMN resources;
ALTER TABLE items DROP COLUMN enabled;
