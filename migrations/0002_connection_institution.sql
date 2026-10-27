-- The authenticated proxy and the bank represented by a connection are distinct.
-- Existing connections stay unassigned until the owner identifies their bank.
ALTER TABLE connection_owners ADD COLUMN institution TEXT CHECK (institution IS NULL OR json_valid(institution));

DROP TRIGGER connection_default_owner;
CREATE TRIGGER connection_default_owner AFTER INSERT ON connections
BEGIN
  INSERT INTO connection_owners(connection_id,profile_id,person_id)
  VALUES(NEW.id,'default','self');
END;
