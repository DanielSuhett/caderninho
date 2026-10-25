import { and, eq, isNull } from "drizzle-orm";

import { database } from "../../database";
import { connectionOwners, people, pluggyProfiles } from "../../schema";
import type { HouseholdRepository } from "../entity";
export function createHouseholdRepository(
  binding: D1Database,
): HouseholdRepository {
  const db = database(binding);
  return {
    async assign(connectionId, personId) {
      await db
        .update(connectionOwners)
        .set({ personId })
        .where(eq(connectionOwners.connectionId, connectionId));
    },
    async bindDefault(fingerprint) {
      await db
        .update(pluggyProfiles)
        .set({ clientFingerprint: fingerprint })
        .where(
          and(
            eq(pluggyProfiles.id, "default"),
            isNull(pluggyProfiles.clientFingerprint),
          ),
        )
        .run();
      const profile = await db
        .select()
        .from(pluggyProfiles)
        .where(eq(pluggyProfiles.id, "default"))
        .get();
      if (profile?.clientFingerprint !== fingerprint) {
        throw new Error("APPLICATION_CHANGE_REQUIRES_NEW_PROFILE");
      }
    },
    getProfile(id) {
      return db
        .select()
        .from(pluggyProfiles)
        .where(eq(pluggyProfiles.id, id))
        .get();
    },
    async person(row) {
      await db
        .insert(people)
        .values(row)
        .onConflictDoUpdate({ set: { name: row.name }, target: people.id })
        .run();
    },
    async profile(row, person) {
      const profile = db
        .insert(pluggyProfiles)
        .values(row)
        .onConflictDoUpdate({
          set: {
            clientFingerprint: row.clientFingerprint,
            credentialRef: row.credentialRef,
            enabled: row.enabled,
            name: row.name,
          },
          target: pluggyProfiles.id,
        });
      if (person) {
        await db.batch([db.insert(people).values(person), profile]);
        return;
      }
      await profile.run();
    },
    async read() {
      const [persons, profiles, owners] = await db.batch([
        db.select().from(people),
        db.select().from(pluggyProfiles),
        db.select().from(connectionOwners),
      ]);
      return { owners, people: persons, profiles };
    },
  };
}
