import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, inArray, isNull, like, not } from "drizzle-orm";
import { inviteCodes, people, premiumPeople, intents } from "../src/lib/db/schema";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const { SEED_PERSON_IDS } = await import("../src/lib/people-seed.ids.ts");
  const { invalidatePeopleCache } = await import("../src/lib/people-store.server.ts");
  const { seedPool } = await import("../src/lib/intents.ts");
  const { intentIndexFromIntent } = await import("../src/lib/intent-index.ts");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  const SEED_CODES = ["KINDRED2026", "WELCOME", "FRIENDS"];
  for (const code of SEED_CODES) {
    const existing = await db.select().from(inviteCodes).where(eq(inviteCodes.code, code)).limit(1);
    if (existing.length === 0) {
      await db.insert(inviteCodes).values({
        code,
        createdBy: "seed",
        usedBy: null,
        usedAt: null,
      });
      console.log("seeded invite", code);
    } else {
      console.log("invite exists", code);
    }
  }

  // Sample member profiles are from other cities. This product keeps Hong Kong
  // activity wishes, so those profiles are removed instead of refreshed.
  const removedPeople = SEED_PERSON_IDS.length
    ? await db.delete(people).where(inArray(people.id, [...SEED_PERSON_IDS])).returning({ id: people.id })
    : [];
  const removedPremium = SEED_PERSON_IDS.length
    ? await db
        .delete(premiumPeople)
        .where(inArray(premiumPeople.id, [...SEED_PERSON_IDS]))
        .returning({ id: premiumPeople.id })
    : [];
  console.log(`removed ${removedPeople.length} sample people, ${removedPremium.length} premium copies`);
  invalidatePeopleCache();

  const seedIntents = seedPool();
  for (const intent of seedIntents) {
    const idx = intentIndexFromIntent(intent);
    await db
      .insert(intents)
      .values({
        id: intent.id,
        ownerId: intent.ownerId,
        userId: null,
        data: intent as unknown as Record<string, unknown>,
        kind: idx.kind,
        cityId: idx.cityId,
        status: idx.status,
        whenTier: idx.whenTier,
        levelTier: idx.levelTier,
      })
      .onConflictDoUpdate({
        target: intents.id,
        set: {
          data: intent as unknown as Record<string, unknown>,
          ownerId: intent.ownerId,
          kind: idx.kind,
          cityId: idx.cityId,
          status: idx.status,
          whenTier: idx.whenTier,
          levelTier: idx.levelTier,
        },
      });
  }
  console.log(`seeded ${seedIntents.length} intents`);

  // Activity data for this product is Hong Kong only.
  const removedShanghai = await db
    .delete(intents)
    .where(like(intents.id, "elder:sh-%"))
    .returning({ id: intents.id });
  const removedOtherCities = await db
    .delete(intents)
    .where(and(isNull(intents.userId), not(like(intents.id, "elder:%"))))
    .returning({ id: intents.id });
  const removedNonHk = await client`
    delete from intents
    where coalesce(data->>'city_zh', '') not like '%香港%'
      and coalesce(data->>'city', '') not ilike '%hong kong%'
    returning id
  `;
  console.log(
    `removed ${removedShanghai.length} Shanghai examples, ${removedOtherCities.length} non-Hong Kong sample wishes, ${removedNonHk.length} wishes outside Hong Kong`,
  );

  await client.end();
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
