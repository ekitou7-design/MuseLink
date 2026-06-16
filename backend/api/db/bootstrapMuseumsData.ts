import type { Pool } from "pg";
import { migrateArtifactDetails } from "./migrateArtifactDetails";
import { upgradeArtifactsMuseumFk } from "./upgradeArtifactsMuseumFk";
import { syncImportedArtifactsToDb } from "./syncImportedArtifacts";
import { ensureMuseumSchema, seedBuiltInMuseumAliases } from "../../museum-normalizer";

type DbLike = Pick<Pool, "query" | "end">;

export async function bootstrapMuseumsData(db: DbLike) {
  await upgradeArtifactsMuseumFk(db);
  await ensureMuseumSchema(db);
  await seedBuiltInMuseumAliases(db);
  await migrateArtifactDetails(db);
  return syncImportedArtifactsToDb(db);
}
