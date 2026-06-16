import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const STORE_PATH = path.join(ROOT, "data", "imported-artifacts.json");
const REPORT_PATH = path.join(ROOT, "data", "artifact-image-naming-audit-report.json");
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

function artifactFileBase(id) {
  return text(id).replace(/[\\/]/g, "-");
}

function toPhysicalPath(webPath) {
  const clean = text(webPath).split("?")[0];
  if (!clean.startsWith("/artifact-images/")) return "";
  return path.join(ROOT, "public", clean.replace(/^\//, ""));
}

function toReportPath(physicalPath) {
  return physicalPath ? path.relative(ROOT, physicalPath) : "";
}

async function pathExists(physicalPath) {
  if (!physicalPath) return false;
  try {
    const stat = await fs.stat(physicalPath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function listFiles(folder) {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
}

async function readArtifacts() {
  const raw = await fs.readFile(STORE_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : Array.isArray(parsed.artifacts) ? parsed.artifacts : [];
}

function isJpgFileName(fileName) {
  return /\.jpg$/i.test(fileName);
}

function imageArtifactIdFromFileName(fileName) {
  return isJpgFileName(fileName) ? fileName.replace(/\.jpg$/i, "") : "";
}

function thumbArtifactIdFromFileName(fileName) {
  return /-thumb\.jpg$/i.test(fileName) ? fileName.replace(/-thumb\.jpg$/i, "") : "";
}

function hasCjk(value) {
  return /[\u3400-\u9fff]/.test(value);
}

function hasHashSuffix(baseName) {
  return /-[0-9a-f]{8}$/i.test(baseName);
}

function classifyNamingType(fileName, folder, artifactIds) {
  const baseName = folder === "thumbs" ? thumbArtifactIdFromFileName(fileName) : imageArtifactIdFromFileName(fileName);
  if (baseName && artifactIds.has(baseName)) return "artifactId 命名";
  if (/^WW-|^Ww-|^ww-/.test(baseName) || hasCjk(baseName)) return "中文名命名未引用";
  if (/^ncha-|^prohibited-export-/.test(baseName) || hasHashSuffix(baseName)) return "批次命名未引用";
  return "其他未知未引用";
}

function invalidReason(fileName, folder, artifactIds) {
  if (!isJpgFileName(fileName)) return "不是 .jpg 文件";
  const baseName = folder === "thumbs" ? thumbArtifactIdFromFileName(fileName) : imageArtifactIdFromFileName(fileName);
  if (!baseName) return folder === "thumbs" ? "缩略图文件名不是 {artifactId}-thumb.jpg" : "原图文件名不是 {artifactId}.jpg";
  if (!artifactIds.has(baseName)) return "文件名中的 artifactId 不存在于 data/imported-artifacts.json";
  return "";
}

function buildFileRecord(fileName, folder) {
  const filePath = folder === "thumbs"
    ? path.join("public", "artifact-images", "thumbs", fileName)
    : path.join("public", "artifact-images", fileName);
  return { filePath, fileName, folder };
}

async function main() {
  const artifacts = await readArtifacts();
  const artifactIds = new Set(artifacts.map((artifact) => text(artifact?.id)).filter(Boolean).map(artifactFileBase));

  const imageFiles = await listFiles(IMAGE_DIR);
  const thumbFiles = await listFiles(THUMB_DIR);

  const invalidNamedFiles = [];
  for (const fileName of imageFiles) {
    const reason = invalidReason(fileName, "images", artifactIds);
    if (reason) invalidNamedFiles.push({ ...buildFileRecord(fileName, "images"), reason });
  }
  for (const fileName of thumbFiles) {
    const reason = invalidReason(fileName, "thumbs", artifactIds);
    if (reason) invalidNamedFiles.push({ ...buildFileRecord(fileName, "thumbs"), reason });
  }

  const badReferences = [];
  const emptyLocalImageFields = [];
  const missingFiles = [];
  const referencedImages = new Set();
  const referencedThumbs = new Set();

  for (const artifact of artifacts) {
    const artifactId = text(artifact?.id);
    const fileBase = artifactFileBase(artifactId);
    const artifactLabel = artifactName(artifact);
    const expectedImage = `${WEB_IMAGE_DIR}/${fileBase}.jpg`;
    const expectedThumb = `${WEB_THUMB_DIR}/${fileBase}-thumb.jpg`;
    const imageValue = text(artifact?.localImageUrl);
    const thumbValue = text(artifact?.localThumbnailUrl);

    if (imageValue) referencedImages.add(imageValue);
    if (thumbValue) referencedThumbs.add(thumbValue);

    if (!imageValue) {
      emptyLocalImageFields.push({
        artifactId,
        artifactName: artifactLabel,
        field: "localImageUrl",
        expectedValue: expectedImage,
      });
    } else if (imageValue !== expectedImage) {
      badReferences.push({
        artifactId,
        artifactName: artifactLabel,
        field: "localImageUrl",
        value: imageValue,
        expectedValue: expectedImage,
        reason: "字段非空但未指向 /artifact-images/{artifactId}.jpg",
      });
    }
    if (!thumbValue) {
      emptyLocalImageFields.push({
        artifactId,
        artifactName: artifactLabel,
        field: "localThumbnailUrl",
        expectedValue: expectedThumb,
      });
    } else if (thumbValue !== expectedThumb) {
      badReferences.push({
        artifactId,
        artifactName: artifactLabel,
        field: "localThumbnailUrl",
        value: thumbValue,
        expectedValue: expectedThumb,
        reason: "字段非空但未指向 /artifact-images/thumbs/{artifactId}-thumb.jpg",
      });
    }

    const imagePhysicalPath = toPhysicalPath(imageValue);
    const thumbPhysicalPath = toPhysicalPath(thumbValue);
    if (imageValue && !(await pathExists(imagePhysicalPath))) {
      missingFiles.push({
        artifactId,
        artifactName: artifactLabel,
        field: "localImageUrl",
        value: imageValue,
        expectedPhysicalPath: toReportPath(imagePhysicalPath),
      });
      badReferences.push({
        artifactId,
        artifactName: artifactLabel,
        field: "localImageUrl",
        value: imageValue,
        expectedValue: expectedImage,
        reason: "字段非空但文件不存在",
      });
    }
    if (thumbValue && !(await pathExists(thumbPhysicalPath))) {
      missingFiles.push({
        artifactId,
        artifactName: artifactLabel,
        field: "localThumbnailUrl",
        value: thumbValue,
        expectedPhysicalPath: toReportPath(thumbPhysicalPath),
      });
      badReferences.push({
        artifactId,
        artifactName: artifactLabel,
        field: "localThumbnailUrl",
        value: thumbValue,
        expectedValue: expectedThumb,
        reason: "字段非空但文件不存在",
      });
    }
  }

  const orphanFiles = [];
  for (const fileName of imageFiles) {
    const webPath = `${WEB_IMAGE_DIR}/${fileName}`;
    if (referencedImages.has(webPath)) continue;
    orphanFiles.push({
      ...buildFileRecord(fileName, "images"),
      namingType: classifyNamingType(fileName, "images", artifactIds),
    });
  }
  for (const fileName of thumbFiles) {
    const webPath = `${WEB_THUMB_DIR}/${fileName}`;
    if (referencedThumbs.has(webPath)) continue;
    orphanFiles.push({
      ...buildFileRecord(fileName, "thumbs"),
      namingType: classifyNamingType(fileName, "thumbs", artifactIds),
    });
  }

  const validNamedImages = imageFiles.length - invalidNamedFiles.filter((file) => file.folder === "images").length;
  const validNamedThumbs = thumbFiles.length - invalidNamedFiles.filter((file) => file.folder === "thumbs").length;
  const missingReferencedImages = missingFiles.filter((file) => file.field === "localImageUrl").length;
  const missingReferencedThumbs = missingFiles.filter((file) => file.field === "localThumbnailUrl").length;
  const orphanImages = orphanFiles.filter((file) => file.folder === "images").length;
  const orphanThumbs = orphanFiles.filter((file) => file.folder === "thumbs").length;
  const dryRunSafeDeleteCandidates = orphanFiles
    .filter((file) => file.namingType !== "artifactId 命名")
    .map((file) => ({
      ...file,
      action: "dry-run-delete",
      reason: "孤儿文件且不是当前 artifactId 规范命名；本脚本只报告，不删除。",
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    sourceDirectories: {
      images: "public/artifact-images",
      thumbs: "public/artifact-images/thumbs",
      note: "dist is ignored because it is a build artifact.",
    },
    summary: {
      totalArtifacts: artifacts.length,
      totalImages: imageFiles.length,
      totalThumbs: thumbFiles.length,
      validNamedImages,
      validNamedThumbs,
      invalidNamedImages: imageFiles.length - validNamedImages,
      invalidNamedThumbs: thumbFiles.length - validNamedThumbs,
      referencedImages: referencedImages.size,
      referencedThumbs: referencedThumbs.size,
      missingReferencedImages,
      missingReferencedThumbs,
      artifactsWithoutLocalImages: new Set(emptyLocalImageFields.map((item) => item.artifactId)).size,
      emptyLocalImageFields: emptyLocalImageFields.length,
      orphanImages,
      orphanThumbs,
      dryRunSafeDeleteCandidates: dryRunSafeDeleteCandidates.length,
    },
    invalidNamedFiles,
    emptyLocalImageFields,
    badReferences,
    missingFiles,
    orphanFiles,
    dryRunCleanup: {
      mode: "dry-run",
      note: "这些是 orphanFiles 中看起来可以安全删除的旧命名图片；未执行删除、移动或重命名。",
      safeDeleteCandidates: dryRunSafeDeleteCandidates,
    },
  };

  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  const allUnified =
    report.summary.invalidNamedImages === 0 &&
    report.summary.invalidNamedThumbs === 0 &&
    badReferences.length === 0 &&
    missingFiles.length === 0;
  console.log(`图片命名是否全部统一: ${allUnified ? "是" : "否"}`);
  console.log(`不规范文件: ${invalidNamedFiles.length}`);
  console.log(`坏引用: ${badReferences.length}`);
  console.log(`孤儿图片: ${orphanFiles.length}`);
  console.log(`报告保存: ${path.relative(ROOT, REPORT_PATH)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
