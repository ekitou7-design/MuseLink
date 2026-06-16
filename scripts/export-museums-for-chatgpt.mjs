import fs from "fs/promises";
import path from "path";
import { db } from "../backend/api/db/client.ts";
import { readImportedArtifactsForDb } from "../backend/api/db/syncImportedArtifacts.ts";
import {
  ensureMuseumExists,
  ensureMuseumSchema,
  seedBuiltInMuseumAliases,
} from "../backend/museum-normalizer.ts";
import { artifactMuseumRaw } from "../src/lib/dbDisplay.ts";

const OUTPUT_PATH = path.join(process.cwd(), "data", "museums-export-for-chatgpt.json");
const USE_PGMEM =
  process.env.USE_PGMEM === "true" ||
  process.env.USE_PGMEM === "1" ||
  (!process.env.DB_HOST && !process.env.DB_NAME);

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function bool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function toExportMuseum(row) {
  const name = text(row.name);
  const grade = text(row.grade);
  return {
    id: String(row.id),
    name,
    standard_name: name,
    normalized_name: text(row.normalized_name),
    aliases: Array.isArray(row.aliases) ? row.aliases.filter(Boolean) : [],
    province: text(row.province),
    city: text(row.city),
    type: text(row.type),
    level: text(row.level),
    grade,
    rating: grade,
    address: text(row.address),
    location: text(row.location),
    official_website: text(row.official_website),
    opening_hours: text(row.opening_hours),
    ticket_info: text(row.ticket_info),
    contact: text(row.contact),
    description: text(row.description),
    history: text(row.history),
    highlights: text(row.highlights),
    is_featured: bool(row.is_featured),
    artifact_count: Number(row.artifact_count || 0),
    cover_image_url: text(row.cover_image_url),
    cover_thumbnail_url: text(row.cover_thumbnail_url),
    local_cover_image_url: text(row.local_cover_image_url),
    local_cover_thumbnail_url: text(row.local_cover_thumbnail_url),
    storage_cover_image_url: text(row.storage_cover_image_url),
    storage_cover_thumbnail_url: text(row.storage_cover_thumbnail_url),
    image_url: text(row.image_url),
    image_source: text(row.image_source),
    source: text(row.source),
    created_by_import: bool(row.created_by_import),
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
  };
}

async function main() {
  const sourcePreparation = USE_PGMEM
    ? await prepareInMemoryMuseumsFromImportedArtifacts()
    : {
        mode: "postgres-read-only",
        note: "DB_HOST/DB_NAME is configured, so the script exports the existing museums table without bootstrapping or writing derived data.",
      };

  const result = await db.query(
    `select
       id, name, normalized_name, aliases, type, level, grade, province, city, address,
       official_website, description, history, highlights, opening_hours, ticket_info,
       contact, cover_image_url, cover_thumbnail_url, local_cover_image_url,
       local_cover_thumbnail_url, storage_cover_image_url, storage_cover_thumbnail_url,
       image_source, source, created_by_import, artifact_count, is_featured, location,
       image_url, created_at, updated_at
     from museums
     order by name asc`,
  );

  const museums = result.rows.map(toExportMuseum);
  const payload = {
    generated_at: new Date().toISOString(),
    data_source:
      "MuseLink backend museums table. Without DB_HOST/DB_NAME this script builds the same in-memory museum dictionary from data/imported-artifacts.json that the local admin backend uses.",
    source_preparation: sourcePreparation,
    total: museums.length,
    fields_note: {
      standard_name: "Project canonical museum name; currently the same value as name.",
      rating: "Alias exported from the real museums.grade field for ChatGPT completion convenience.",
    },
    museums,
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  console.log(`Exported ${museums.length} museums to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

async function prepareInMemoryMuseumsFromImportedArtifacts() {
  await ensureMuseumSchema(db);
  await seedBuiltInMuseumAliases(db);

  const artifacts = await readImportedArtifactsForDb();
  const artifactCounts = new Map();
  let resolved = 0;

  for (const artifact of artifacts) {
    const rawMuseumName = text(artifactMuseumRaw(artifact)) || "未归类博物馆";
    const museum = await ensureMuseumExists(db, rawMuseumName, artifact);
    const museumId = museum?.museum?.id;
    if (museumId === null || museumId === undefined) continue;
    resolved += 1;
    artifactCounts.set(String(museumId), (artifactCounts.get(String(museumId)) || 0) + 1);
  }

  await db.query(`update museums set artifact_count = 0`);
  for (const [museumId, count] of artifactCounts.entries()) {
    await db.query(`update museums set artifact_count=$2 where id=$1`, [museumId, count]);
  }

  return {
    mode: "pg-mem-from-imported-artifacts",
    imported_artifacts: artifacts.length,
    resolved_artifacts: resolved,
    museums_with_artifacts: artifactCounts.size,
    note: "No existing data files or database schema are modified; pg-mem changes are process-local only.",
  };
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end().catch(() => undefined);
  });
