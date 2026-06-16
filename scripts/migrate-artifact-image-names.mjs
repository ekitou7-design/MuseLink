import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { syncImportedArtifactsToDb } from "../backend/api/db/syncImportedArtifacts.ts";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
const { db } = await import("../backend/api/db/client.ts");

const ROOT = process.cwd();
const STORE_PATH = path.join(ROOT, "data", "imported-artifacts.json");
const REPORT_PATH = path.join(ROOT, "data", "image-filename-migration-report.json");
const IMAGE_DIR = path.join(ROOT, "public", "artifact-images");
const THUMB_DIR = path.join(IMAGE_DIR, "thumbs");
const WEB_IMAGE_DIR = "/artifact-images";
const WEB_THUMB_DIR = "/artifact-images/thumbs";

function text(value) {
  if (value === null || value === undefined) return "";
  const normalized = String(value).trim();
  if (normalized === "undefined" || normalized === "null") return "";
  return normalized;
}

function artifactName(artifact) {
  return text(artifact.name || artifact.title || artifact["文物名称"] || artifact["名称"]);
}

function artifactMuseum(artifact) {
  return text(artifact.museum || artifact.museumName || artifact["博物馆"] || artifact["所属博物馆"]);
}

function artifactFileBase(id) {
  return text(id).replace(/[\\/]/g, "-");
}

function isArtifactImageUrl(value) {
  return /^\/artifact-images\/(?!thumbs\/).+/.test(text(value));
}

function isArtifactThumbUrl(value) {
  return /^\/artifact-images\/thumbs\/.+/.test(text(value));
}

function webUrlToPath(value) {
  const clean = text(value).split("?")[0];
  if (!clean.startsWith("/artifact-images/")) return "";
  return path.join(ROOT, "public", clean.replace(/^\//, ""));
}

function relativeReportPath(filePath) {
  if (!filePath) return "";
  return path.relative(ROOT, filePath);
}

async function pathExists(filePath) {
  if (!filePath) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readStore() {
  const raw = await fs.readFile(STORE_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  const artifacts = Array.isArray(parsed) ? parsed : Array.isArray(parsed.artifacts) ? parsed.artifacts : [];
  return { parsed, artifacts };
}

function collectUrlOwners(artifacts) {
  const owners = new Map();
  for (const artifact of artifacts) {
    const id = text(artifact?.id);
    if (!id) continue;
    for (const url of [artifact.localImageUrl, artifact.local_image_url, artifact.localThumbnailUrl, artifact.local_thumbnail_url]) {
      const clean = text(url);
      if (!clean) continue;
      const list = owners.get(clean) || [];
      list.push(id);
      owners.set(clean, list);
    }
  }
  return owners;
}

async function readDbImageRows() {
  try {
    const rows = await db.query(
      `select a.id, a.name, m.name as museum, a.local_image_url, a.local_thumbnail_url
       from artifacts a
       join museums m on m.id = a.museum_id`,
    );
    return { rows: rows.rows, error: "" };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : String(error) };
  }
}

function dbKey(name, museum) {
  return `${text(name)}\u0000${text(museum)}`;
}

function buildDbImageMap(rows) {
  const map = new Map();
  for (const row of rows) {
    map.set(dbKey(row.name, row.museum), {
      id: row.id,
      localImageUrl: text(row.local_image_url),
      localThumbnailUrl: text(row.local_thumbnail_url),
    });
  }
  return map;
}

async function updateDbImageUrls(artifact, newImageUrl, newThumbUrl) {
  const name = artifactName(artifact);
  const museum = artifactMuseum(artifact);
  if (!name || !museum) return { updated: false, error: "missing artifact name or museum for DB match" };

  try {
    const result = await db.query(
      `update artifacts
       set local_image_url = $3,
           local_thumbnail_url = $4,
           updated_at = now()
       where name = $1
         and museum_id in (select id from museums where name = $2)`,
      [name, museum, newImageUrl, newThumbUrl],
    );
    return { updated: (result.rowCount || 0) > 0, error: "" };
  } catch (error) {
    return { updated: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function migrateOneFile({ artifactId, oldUrl, newUrl, urlOwners, kind }) {
  if (!oldUrl) return { action: "skipped-empty", oldPath: "", newPath: "", error: "" };

  const oldPath = webUrlToPath(oldUrl);
  const newPath = webUrlToPath(newUrl);
  const oldExists = await pathExists(oldPath);
  if (!oldExists) {
    return {
      action: "failed",
      oldPath,
      newPath,
      error: `${kind} source file does not exist`,
    };
  }

  const targetOwners = (urlOwners.get(newUrl) || []).filter((ownerId) => ownerId !== artifactId);
  if (targetOwners.length > 0) {
    return {
      action: "failed",
      oldPath,
      newPath,
      error: `${kind} target is already referenced by another artifact: ${targetOwners.join(", ")}`,
    };
  }

  if (oldUrl === newUrl) {
    return { action: "already-target", oldPath, newPath, error: "" };
  }

  await fs.mkdir(path.dirname(newPath), { recursive: true });
  const targetExists = await pathExists(newPath);
  if (!targetExists) {
    await fs.copyFile(oldPath, newPath);
    return { action: "copied", oldPath, newPath, error: "" };
  }

  return { action: "target-exists", oldPath, newPath, error: "" };
}

async function main() {
  const startedAt = new Date().toISOString();
  await fs.mkdir(IMAGE_DIR, { recursive: true });
  await fs.mkdir(THUMB_DIR, { recursive: true });

  const { parsed, artifacts } = await readStore();
  const urlOwners = collectUrlOwners(artifacts);
  const dbRead = await readDbImageRows();
  const dbImages = buildDbImageMap(dbRead.rows);

  const entries = [];
  let imageCopied = 0;
  let thumbCopied = 0;
  let jsonUpdated = 0;
  let dbUpdated = 0;

  for (const artifact of artifacts) {
    const artifactId = text(artifact?.id);
    if (!artifactId) continue;

    const name = artifactName(artifact);
    const museum = artifactMuseum(artifact);
    const fileBase = artifactFileBase(artifactId);
    const newImageUrl = `${WEB_IMAGE_DIR}/${fileBase}.jpg`;
    const newThumbUrl = `${WEB_THUMB_DIR}/${fileBase}-thumb.jpg`;
    const oldImageUrl = text(artifact.localImageUrl || artifact.local_image_url);
    const oldThumbUrl = text(artifact.localThumbnailUrl || artifact.local_thumbnail_url);
    const dbImage = dbImages.get(dbKey(name, museum));

    const reportEntry = {
      artifactId,
      artifactName: name,
      oldImagePath: relativeReportPath(webUrlToPath(oldImageUrl)),
      newImagePath: relativeReportPath(webUrlToPath(newImageUrl)),
      oldThumbPath: relativeReportPath(webUrlToPath(oldThumbUrl)),
      newThumbPath: relativeReportPath(webUrlToPath(newThumbUrl)),
      status: "skipped",
      error: "",
      dbOldImagePath: relativeReportPath(webUrlToPath(dbImage?.localImageUrl || "")),
      dbOldThumbPath: relativeReportPath(webUrlToPath(dbImage?.localThumbnailUrl || "")),
    };

    const imageNeedsMigration = isArtifactImageUrl(oldImageUrl) && oldImageUrl !== newImageUrl;
    const thumbNeedsMigration = isArtifactThumbUrl(oldThumbUrl) && oldThumbUrl !== newThumbUrl;
    const imageAlreadyTarget = oldImageUrl === newImageUrl;
    const thumbAlreadyTarget = oldThumbUrl === newThumbUrl;

    if (!imageNeedsMigration && !thumbNeedsMigration && imageAlreadyTarget && thumbAlreadyTarget) {
      const dbResult = await updateDbImageUrls(artifact, newImageUrl, newThumbUrl);
      if (dbResult.updated) dbUpdated += 1;
      reportEntry.status = dbResult.error ? "already-target-db-failed" : "already-target";
      reportEntry.error = dbResult.error;
      entries.push(reportEntry);
      continue;
    }

    const imageResult = imageNeedsMigration
      ? await migrateOneFile({ artifactId, oldUrl: oldImageUrl, newUrl: newImageUrl, urlOwners, kind: "image" })
      : { action: imageAlreadyTarget ? "already-target" : "skipped-not-local", oldPath: webUrlToPath(oldImageUrl), newPath: webUrlToPath(newImageUrl), error: "" };
    const thumbResult = thumbNeedsMigration
      ? await migrateOneFile({ artifactId, oldUrl: oldThumbUrl, newUrl: newThumbUrl, urlOwners, kind: "thumbnail" })
      : { action: thumbAlreadyTarget ? "already-target" : "skipped-not-local", oldPath: webUrlToPath(oldThumbUrl), newPath: webUrlToPath(newThumbUrl), error: "" };

    const errors = [imageResult.error, thumbResult.error].filter(Boolean);
    if (errors.length > 0) {
      reportEntry.status = "failed";
      reportEntry.error = errors.join("; ");
      entries.push(reportEntry);
      continue;
    }

    const shouldUpdateImage = imageResult.action !== "skipped-empty" && imageResult.action !== "skipped-not-local";
    const shouldUpdateThumb = thumbResult.action !== "skipped-empty" && thumbResult.action !== "skipped-not-local";
    if (shouldUpdateImage) {
      artifact.localImageUrl = newImageUrl;
    }
    if (shouldUpdateThumb) {
      artifact.localThumbnailUrl = newThumbUrl;
    }

    if (shouldUpdateImage || shouldUpdateThumb) {
      jsonUpdated += 1;
      const dbResult = await updateDbImageUrls(
        artifact,
        text(artifact.localImageUrl || artifact.local_image_url),
        text(artifact.localThumbnailUrl || artifact.local_thumbnail_url),
      );
      if (dbResult.updated) dbUpdated += 1;
      if (dbResult.error) reportEntry.error = dbResult.error;
      if (imageResult.action === "copied") imageCopied += 1;
      if (thumbResult.action === "copied") thumbCopied += 1;
      reportEntry.status = dbResult.error ? "json-updated-db-failed" : "migrated";
    } else {
      reportEntry.status = "skipped";
    }

    entries.push(reportEntry);
  }

  const completedAt = new Date().toISOString();
  let dbSync = null;
  if (dbUpdated === 0 && !dbRead.error) {
    try {
      dbSync = await syncImportedArtifactsToDb(db);
      dbUpdated = (dbSync.inserted || 0) + (dbSync.updated || 0);
    } catch (error) {
      dbSync = { error: error instanceof Error ? error.message : String(error) };
    }
  }
  const failures = entries.filter((entry) => entry.status === "failed" || entry.status === "json-updated-db-failed" || entry.status === "already-target-db-failed");
  const report = {
    startedAt,
    completedAt,
    summary: {
      artifactCount: artifacts.length,
      imageCopied,
      thumbCopied,
      jsonUpdated,
      dbUpdated,
      failed: failures.length,
      dbReadError: dbRead.error,
      dbSync,
    },
    entries,
  };

  await fs.writeFile(STORE_PATH, `${JSON.stringify(parsed, null, 2)}\n`, "utf-8");
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log(JSON.stringify(report.summary, null, 2));
  if (failures.length > 0) {
    console.log(`Failures: ${failures.length}`);
    for (const failure of failures.slice(0, 20)) {
      console.log(`${failure.artifactId} ${failure.artifactName}: ${failure.error}`);
    }
  }

  if (typeof db.end === "function") {
    await db.end();
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  if (typeof db.end === "function") {
    await db.end();
  }
  process.exitCode = 1;
});
