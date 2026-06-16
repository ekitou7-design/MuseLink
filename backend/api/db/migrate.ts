import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { db } from "./client";
import { migrateArtifactDetails } from "./migrateArtifactDetails";
import { upgradeArtifactsMuseumFk } from "./upgradeArtifactsMuseumFk";
import { ensureMuseumSchema, seedBuiltInMuseumAliases } from "../../museum-normalizer";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  if (process.env.USE_PGMEM === "true" || process.env.USE_PGMEM === "1") {
    console.log("USE_PGMEM enabled: schema is applied automatically on startup. Skipping migrate.");
    await db.end();
    return;
  }
  const schemaPath = path.join(process.cwd(), "backend", "api", "db", "schema.sql");
  const sql = await fs.readFile(schemaPath, "utf-8");
  await db.query(sql);
  const up = await upgradeArtifactsMuseumFk(db);
  if (up.migrated) {
    console.log("DB migrate: upgraded artifacts.museum → museum_id + museums");
  }
  await ensureMuseumSchema(db);
  await seedBuiltInMuseumAliases(db);
  await migrateArtifactDetails(db);
  await db.end();
  console.log("DB migrate OK");
}

main().catch(async (err) => {
  console.error("DB migrate failed:", err);
  try {
    await db.end();
  } catch {}
  process.exit(1);
});
