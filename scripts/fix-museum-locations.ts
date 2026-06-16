import { db } from "../backend/api/db/client";
import { ensureMuseumSchema, inferMuseumLocation } from "../backend/museum-normalizer";
import { listArtifactsFromDb } from "../backend/api/db/syncImportedArtifacts";
import { syncAiRagForArtifacts } from "../backend/ai-rag-data";
import { inferMuseumTypeByName } from "../src/constants/locationOptions";
import { bootstrapMuseumsData } from "../backend/api/db/bootstrapMuseumsData";

type MuseumRow = {
  id: number | string;
  name: string;
  province?: string | null;
  city?: string | null;
  type?: string | null;
};

function clean(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function needsLocation(row: MuseumRow) {
  const province = clean(row.province);
  const city = clean(row.city);
  return !province || province === "其他" || province === "未知地区" || !city || city === "未知地区";
}

function needsType(row: MuseumRow) {
  const type = clean(row.type);
  return !type || type === "其他";
}

async function main() {
  const sync = await bootstrapMuseumsData(db);
  if (!sync.skipped) {
    console.log(`已同步导入文物数据：${sync.importedCount} file rows, ${sync.inserted} inserted, ${sync.updated} updated`);
  }
  await ensureMuseumSchema(db);
  const museums = await db.query<MuseumRow>(`select id, name, province, city, type from museums order by name asc`);
  const filled: Array<{ name: string; province: string; city: string; source: string }> = [];
  const typed: Array<{ name: string; type: string }> = [];
  const unknown: string[] = [];

  for (const museum of museums.rows) {
    const inferredType = inferMuseumTypeByName(museum.name, museum.type);
    if (needsType(museum) && inferredType && inferredType !== "其他") {
      await db.query(`update museums set type=$2, updated_at=now() where id=$1`, [museum.id, inferredType]);
      typed.push({ name: museum.name, type: inferredType });
    }

    if (!needsLocation(museum)) continue;
    const inferred = inferMuseumLocation(museum.name);
    if (inferred.source === "unknown") {
      await db.query(`update museums set province=$2, city=$3, updated_at=now() where id=$1`, [
        museum.id,
        "其他",
        clean(museum.city) || "未知地区",
      ]);
      unknown.push(museum.name);
      continue;
    }

    await db.query(`update museums set province=$2, city=$3, updated_at=now() where id=$1`, [
      museum.id,
      inferred.province,
      inferred.city,
    ]);
    filled.push({
      name: museum.name,
      province: inferred.province,
      city: inferred.city,
      source: inferred.source,
    });
  }

  if (filled.length > 0 || typed.length > 0) {
    await syncAiRagForArtifacts(await listArtifactsFromDb(db));
  }

  console.log(`总博物馆数：${museums.rows.length}`);
  console.log(`已补全省市：${filled.length}`);
  console.log(`已修正类型：${typed.length}`);
  console.log(`仍为其他：${unknown.length}`);
  if (filled.length > 0) {
    console.log("\n补全列表：");
    filled.forEach((item) => {
      console.log(`- ${item.name} → ${item.province} / ${item.city} (${item.source})`);
    });
  }
  if (typed.length > 0) {
    console.log("\n类型修正列表：");
    typed.forEach((item) => {
      console.log(`- ${item.name} → ${item.type}`);
    });
  }
  if (unknown.length > 0) {
    console.log("\n仍无法判断：");
    unknown.forEach((name) => console.log(`- ${name}`));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end().catch(() => undefined);
  });
