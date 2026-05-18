import path from "path";
import dotenv from "dotenv";
import { db } from "./client";
import { ensureSeedArtifacts } from "./seedArtifacts";
import { ensureSeedMuseums } from "./seedMuseums";
import { upgradeArtifactsMuseumFk } from "./upgradeArtifactsMuseumFk";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  await upgradeArtifactsMuseumFk(db);
  const museums = await ensureSeedMuseums(db);
  console.log(`Seeded/updated provincial museums: ${museums.count}`);
  const result = await ensureSeedArtifacts(db);
  if (result.seeded) {
    console.log(`Seeded artifacts: ${result.count}`);
  } else {
    console.log("Artifacts already seeded. Skipping.");
  }
  await db.end();
  console.log("DB seed OK");
}

main().catch(async (err) => {
  console.error("DB seed failed:", err);
  try {
    await db.end();
  } catch {}
  process.exit(1);
});
