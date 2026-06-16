import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const AUDIT_REPORT_PATH = path.join(ROOT, "data", "artifact-image-naming-audit-report.json");
const CLEANUP_REPORT_PATH = path.join(ROOT, "data", "artifact-image-cleanup-report.json");
const IMPORTED_ARTIFACTS_PATH = path.join(ROOT, "data", "imported-artifacts.json");
const IMAGE_ROOT = path.join(ROOT, "public", "artifact-images");
const THUMB_ROOT = path.join(IMAGE_ROOT, "thumbs");
const BACKUP_ROOT = path.join(ROOT, "data", "backups");
const APPLY = process.argv.includes("--apply");

function text(value) {
  if (value === null || value === undefined) return "";
  const normalized = String(value).trim();
  if (normalized === "undefined" || normalized === "null") return "";
  return normalized;
}

function timestamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function normalizeReportPath(filePath) {
  const normalized = text(filePath).replace(/\\/g, "/").replace(/^\/+/, "");
  return normalized;
}

function physicalPathFromReportPath(filePath) {
  return path.resolve(ROOT, normalizeReportPath(filePath));
}

function isInsideDir(filePath, dirPath) {
  const relative = path.relative(dirPath, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isAllowedImagePath(filePath) {
  if (!isInsideDir(filePath, IMAGE_ROOT)) return false;
  if (isInsideDir(filePath, THUMB_ROOT)) return true;
  return path.dirname(filePath) === IMAGE_ROOT;
}

function webPathFromReportPath(filePath) {
  const normalized = normalizeReportPath(filePath);
  if (normalized.startsWith("public/artifact-images/")) {
    return `/${normalized.replace(/^public\//, "")}`;
  }
  return "";
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function pathExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function readArtifacts() {
  const parsed = await readJson(IMPORTED_ARTIFACTS_PATH);
  return Array.isArray(parsed) ? parsed : Array.isArray(parsed.artifacts) ? parsed.artifacts : [];
}

function collectReferencedImageUrls(artifacts) {
  const urls = new Set();
  for (const artifact of artifacts) {
    const imageUrl = text(artifact?.localImageUrl);
    const thumbUrl = text(artifact?.localThumbnailUrl);
    if (imageUrl) urls.add(imageUrl);
    if (thumbUrl) urls.add(thumbUrl);
  }
  return urls;
}

function uniqueCandidates(candidates) {
  const seen = new Set();
  const unique = [];
  for (const candidate of candidates) {
    const filePath = normalizeReportPath(candidate?.filePath);
    if (!filePath || seen.has(filePath)) continue;
    seen.add(filePath);
    unique.push({ ...candidate, filePath });
  }
  return unique;
}

async function backupThenDelete(filePath, backupDir) {
  const relative = path.relative(ROOT, filePath);
  const backupPath = path.join(backupDir, relative);
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.copyFile(filePath, backupPath);
  await fs.unlink(filePath);
  return backupPath;
}

async function main() {
  const startedAt = new Date().toISOString();
  const auditReport = await readJson(AUDIT_REPORT_PATH);
  const candidates = uniqueCandidates(auditReport?.dryRunCleanup?.safeDeleteCandidates || []);
  const artifacts = await readArtifacts();
  const referencedUrls = collectReferencedImageUrls(artifacts);
  const backupDir = path.join(BACKUP_ROOT, `artifact-image-orphans-${timestamp()}`);
  const entries = [];

  let eligible = 0;
  let backedUp = 0;
  let deleted = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const physicalPath = physicalPathFromReportPath(candidate.filePath);
    const webPath = webPathFromReportPath(candidate.filePath);
    const reasons = [];

    if (!webPath) reasons.push("not an /artifact-images web path");
    if (!isAllowedImagePath(physicalPath)) reasons.push("outside public/artifact-images or thumbs");
    if (referencedUrls.has(webPath)) reasons.push("still referenced by localImageUrl/localThumbnailUrl");
    if (!(await pathExists(physicalPath))) reasons.push("file does not exist");

    if (reasons.length > 0) {
      skipped += 1;
      entries.push({
        ...candidate,
        webPath,
        physicalPath: path.relative(ROOT, physicalPath),
        status: "skipped",
        reason: reasons.join("; "),
      });
      continue;
    }

    eligible += 1;
    if (!APPLY) {
      entries.push({
        ...candidate,
        webPath,
        physicalPath: path.relative(ROOT, physicalPath),
        status: "dry-run",
        reason: "eligible; not deleted because --apply was not provided",
      });
      continue;
    }

    const backupPath = await backupThenDelete(physicalPath, backupDir);
    backedUp += 1;
    deleted += 1;
    entries.push({
      ...candidate,
      webPath,
      physicalPath: path.relative(ROOT, physicalPath),
      backupPath: path.relative(ROOT, backupPath),
      status: "deleted",
      reason: "",
    });
  }

  const report = {
    startedAt,
    completedAt: new Date().toISOString(),
    mode: APPLY ? "apply" : "dry-run",
    sourceAuditReport: path.relative(ROOT, AUDIT_REPORT_PATH),
    backupDir: APPLY ? path.relative(ROOT, backupDir) : "",
    summary: {
      candidates: candidates.length,
      eligible,
      skipped,
      backedUp,
      deleted,
      dryRun: !APPLY,
    },
    entries,
  };

  await fs.writeFile(CLEANUP_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log(`模式: ${report.mode}`);
  console.log(`候选文件: ${report.summary.candidates}`);
  console.log(`可清理: ${report.summary.eligible}`);
  console.log(`已备份: ${report.summary.backedUp}`);
  console.log(`已删除: ${report.summary.deleted}`);
  console.log(`跳过: ${report.summary.skipped}`);
  console.log(`报告保存: ${path.relative(ROOT, CLEANUP_REPORT_PATH)}`);
  if (!APPLY) {
    console.log("未传入 --apply，本次没有删除任何文件。");
  } else {
    console.log(`备份目录: ${report.backupDir}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
