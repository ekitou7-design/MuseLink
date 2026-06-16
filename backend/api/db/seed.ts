import path from "path";
import dotenv from "dotenv";
import { db } from "./client";
import { ensureSeedArtifacts } from "./seedArtifacts";
import { ensureSeedMuseums } from "./seedMuseums";
import { migrateArtifactDetails } from "./migrateArtifactDetails";
import { upgradeArtifactsMuseumFk } from "./upgradeArtifactsMuseumFk";
import { listArtifactsFromDb, syncImportedArtifactsToDb } from "./syncImportedArtifacts";
import { syncAiRagForArtifacts } from "../../ai-rag-data";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  await upgradeArtifactsMuseumFk(db);
  await migrateArtifactDetails(db);
  const museums = await ensureSeedMuseums(db);
  console.log(`Seeded/updated provincial museums: ${museums.count}`);
  const result = await ensureSeedArtifacts(db);
  if (result.seeded) {
    console.log(`Seeded artifacts: ${result.count}`);
  } else {
    console.log("Artifacts already seeded. Skipping.");
  }
  const imported = await syncImportedArtifactsToDb(db);
  if (!imported.skipped) {
    console.log(`Synced imported artifacts: ${imported.importedCount} file rows, ${imported.inserted} inserted, ${imported.updated} updated`);
  }
  const aiRag = imported.skipped || !imported.aiRagSync
    ? await syncAiRagForArtifacts(await listArtifactsFromDb(db))
    : imported.aiRagSync;
  console.log(`Synced AI/RAG data: ${aiRag.coverage}, relations ${aiRag.relationCount}`);
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
