import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const STORE_PATH = path.join(ROOT, "data", "imported-artifacts.json");
const REPORT_PATH = path.join(ROOT, "data", "image-cache-report.json");
const IMAGE_DIR = path.join(ROOT, "public", "artifact-images");
const THUMB_DIR = path.join(IMAGE_DIR, "thumbs");
const WEB_IMAGE_DIR = "/artifact-images";
const WEB_THUMB_DIR = "/artifact-images/thumbs";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const BAD_URL_PATTERNS = [
  /placeholder/i,
  /example\.(com|org|net)/i,
  /ncha\.gov\.cn\/art\//i,
  /qikan\.cqvip\.com/i,
  /cflac\.org\.cn/i,
  /wenbao\.net/i,
];

function text(value) {
  return String(value ?? "").trim();
}

function isLocalImageUrl(url) {
  return text(url).startsWith(`${WEB_IMAGE_DIR}/`);
}

function isReliableRemoteImageUrl(url) {
  const value = text(url);
  if (!/^https?:\/\//i.test(value)) return false;
  if (BAD_URL_PATTERNS.some((pattern) => pattern.test(value))) return false;
  return true;
}

function safeBaseName(artifact, index) {
  const raw = text(artifact.id) || text(artifact.name) || text(artifact["文物名称"]) || `artifact-${index + 1}`;
  const safe = raw
    .normalize("NFKD")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  const hash = createHash("sha1").update(`${raw}-${index}`).digest("hex").slice(0, 8);
  return `${safe || "artifact"}-${hash}`;
}

function extensionFromContentType(contentType) {
  const type = text(contentType).toLowerCase();
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  return "";
}

function extensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).replace(".", "").toLowerCase();
    return IMAGE_EXTENSIONS.has(ext) ? (ext === "jpeg" ? "jpg" : ext) : "";
  } catch {
    return "";
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runSips(inputPath, outputPath) {
  return new Promise((resolve) => {
    const child = spawn("sips", ["-Z", "480", inputPath, "--out", outputPath], {
      stdio: "ignore",
    });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

async function writeFallbackThumbnail(inputPath, outputPath) {
  const resized = await runSips(inputPath, outputPath);
  if (!resized) {
    await fs.copyFile(inputPath, outputPath);
  }
}

async function downloadImage(url, targetPath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.IMAGE_CACHE_TIMEOUT_MS || 12000));
  let response;
  try {
    response = await fetch(url, {
      headers: {
        "user-agent": "MuseLink image cache/1.0 (+local development)",
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`Not an image: ${contentType || "unknown content-type"}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error("Empty image response");
  }
  await fs.writeFile(targetPath, buffer);
}

async function readStore() {
  const raw = await fs.readFile(STORE_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  const artifacts = Array.isArray(parsed) ? parsed : Array.isArray(parsed.artifacts) ? parsed.artifacts : [];
  return { parsed, artifacts };
}

async function writeStore(parsed, artifacts) {
  const next = Array.isArray(parsed)
    ? artifacts
    : {
        ...parsed,
        updatedAt: new Date().toISOString(),
        artifacts,
      };
  await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf-8");
}

async function main() {
  const { parsed, artifacts } = await readStore();
  await fs.mkdir(IMAGE_DIR, { recursive: true });
  await fs.mkdir(THUMB_DIR, { recursive: true });

  const byRemoteUrl = new Map();
  const failures = [];
  const successes = [];
  let skippedExisting = 0;
  let skippedNoRemote = 0;

  for (let index = 0; index < artifacts.length; index += 1) {
    const artifact = artifacts[index];
    const currentLocal = text(artifact.localImageUrl);
    const currentThumb = text(artifact.localThumbnailUrl);
    if (currentLocal && currentThumb && (await pathExists(path.join(ROOT, "public", currentLocal.replace(/^\//, ""))))) {
      skippedExisting += 1;
      continue;
    }

    const remoteUrl = text(artifact.externalImageUrl || artifact.originalImageUrl || artifact.imageUrl || artifact.image_url || artifact["图片链接"]);
    if (!isReliableRemoteImageUrl(remoteUrl) || isLocalImageUrl(remoteUrl)) {
      skippedNoRemote += 1;
      continue;
    }

    if (byRemoteUrl.has(remoteUrl)) {
      const cached = byRemoteUrl.get(remoteUrl);
      artifact.localImageUrl = cached.localImageUrl;
      artifact.localThumbnailUrl = cached.localThumbnailUrl;
      artifact.externalImageUrl = remoteUrl;
      skippedExisting += 1;
      continue;
    }

    const base = safeBaseName(artifact, index);
    const urlExt = extensionFromUrl(remoteUrl) || "jpg";
    let imagePath = path.join(IMAGE_DIR, `${base}.${urlExt}`);
    let thumbPath = path.join(THUMB_DIR, `${base}-thumb.${urlExt}`);
    let localImageUrl = `${WEB_IMAGE_DIR}/${path.basename(imagePath)}`;
    let localThumbnailUrl = `${WEB_THUMB_DIR}/${path.basename(thumbPath)}`;

    try {
      if (!(await pathExists(imagePath))) {
        await downloadImage(remoteUrl, imagePath);
        const content = await fs.readFile(imagePath);
        const signature = content.subarray(0, 12).toString("hex");
        const detectedExt =
          signature.startsWith("ffd8ff") ? "jpg" :
          signature.startsWith("89504e47") ? "png" :
          signature.startsWith("52494646") ? "webp" :
          signature.startsWith("47494638") ? "gif" :
          urlExt;

        if (detectedExt !== urlExt) {
          const correctedPath = path.join(IMAGE_DIR, `${base}.${detectedExt}`);
          await fs.rename(imagePath, correctedPath);
          imagePath = correctedPath;
          thumbPath = path.join(THUMB_DIR, `${base}-thumb.${detectedExt}`);
          localImageUrl = `${WEB_IMAGE_DIR}/${path.basename(imagePath)}`;
          localThumbnailUrl = `${WEB_THUMB_DIR}/${path.basename(thumbPath)}`;
        }
      } else {
        skippedExisting += 1;
      }

      if (!(await pathExists(thumbPath))) {
        await writeFallbackThumbnail(imagePath, thumbPath);
      }

      artifact.localImageUrl = localImageUrl;
      artifact.localThumbnailUrl = localThumbnailUrl;
      artifact.externalImageUrl = remoteUrl;
      byRemoteUrl.set(remoteUrl, { localImageUrl, localThumbnailUrl });
      successes.push({ id: artifact.id, name: artifact.name, remoteUrl, localImageUrl, localThumbnailUrl });
    } catch (error) {
      failures.push({
        id: artifact.id,
        name: artifact.name || artifact["文物名称"],
        imageUrl: remoteUrl,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await writeStore(parsed, artifacts);

  const report = {
    generatedAt: new Date().toISOString(),
    totalImageUrls: artifacts.filter((artifact) => isReliableRemoteImageUrl(artifact.externalImageUrl || artifact.originalImageUrl || artifact.imageUrl || artifact.image_url || artifact["图片链接"])).length,
    successCached: successes.length,
    failed: failures.length,
    skippedExisting,
    skippedNoRemote,
    outputDir: "public/artifact-images/",
    thumbnailDir: "public/artifact-images/thumbs/",
    failures,
  };
  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
