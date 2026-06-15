import fs from "fs/promises";
import path from "path";
import dns from "dns/promises";
import net from "net";
import type { Request, RequestHandler, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { db } from "../db/client";
import { searchRelics } from "../db/relicSearch";
import { getArtifactFromDb, listArtifactsFromDb } from "../db/syncImportedArtifacts";
import type { ArtifactAttributeRow } from "../models/types";

const ARTIFACT_IMAGES_DIR = path.join(process.cwd(), "public", "artifact-images");
const ARTIFACT_THUMBS_DIR = path.join(ARTIFACT_IMAGES_DIR, "thumbs");
const IMPORTED_ARTIFACTS_PATH = path.join(process.cwd(), "data", "imported-artifacts.json");
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_DOWNLOAD_BYTES = 10 * 1024 * 1024;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 12000;

const multerArtifactImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("仅支持 jpg/jpeg/png/webp 图片。"));
      return;
    }
    cb(null, true);
  },
}).single("image");

export const uploadArtifactImageFile: RequestHandler = (req, res, next) => {
  multerArtifactImageUpload(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
    return next();
  });
};

const BASE_ARTIFACT_COLUMNS = new Set([
  "id",
  "name",
  "dynasty",
  "museum_id",
  "description",
  "image_url",
  "tags",
  "created_at",
]);

const OPTIONAL_ARTIFACT_COLUMNS = [
  "category",
  "short_intro",
  "source_url",
  "updated_at",
  "local_image_url",
  "local_thumbnail_url",
  "material",
  "size",
  "dimensions",
  "level",
  "remark",
  "remarks",
  "note",
] as const;

async function getArtifactColumns() {
  try {
    const result = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'artifacts'`,
    );
    const columns = new Set(result.rows.map((row) => row.column_name));
    return columns.size > 0 ? columns : BASE_ARTIFACT_COLUMNS;
  } catch {
    return BASE_ARTIFACT_COLUMNS;
  }
}

function isBlank(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized === "" || normalized === "undefined" || normalized === "null";
  }
  return false;
}

function isBlankAttributeValue(value: unknown) {
  if (isBlank(value)) return true;
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized === "未知" || normalized === "暂无信息";
  }
  return false;
}

function text(value: unknown) {
  return isBlank(value) ? "" : String(value);
}

function cleanText(value: unknown) {
  return text(value).trim();
}

function artifactImageFileBase(id: string) {
  return id.replace(/[\\/]/g, "-");
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

function isPrivateAddress(address: string) {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

async function assertSafeImageUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("图片链接格式无效。");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("图片链接必须是 http 或 https。");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("不允许下载 localhost 图片链接。");
  }

  const literalFamily = net.isIP(hostname);
  if (literalFamily && isPrivateAddress(hostname)) {
    throw new Error("不允许下载内网或本机图片链接。");
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("不允许下载解析到内网或本机地址的图片链接。");
  }

  return parsed.toString();
}

async function readImageResponseBody(response: globalThis.Response) {
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_DOWNLOAD_BYTES) {
    throw new Error("图片不能超过 10MB。");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_DOWNLOAD_BYTES) throw new Error("图片不能超过 10MB。");
    return Buffer.from(arrayBuffer);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_IMAGE_DOWNLOAD_BYTES) {
      throw new Error("图片不能超过 10MB。");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function downloadImageBuffer(rawUrl: string) {
  let currentUrl = await assertSafeImageUrl(rawUrl);

  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_DOWNLOAD_TIMEOUT_MS);
    try {
      const response = await fetch(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "image/jpeg,image/png,image/webp,image/*;q=0.8" },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("图片链接重定向无效。");
        currentUrl = await assertSafeImageUrl(new URL(location, currentUrl).toString());
        continue;
      }

      if (!response.ok) {
        throw new Error(`下载图片失败：${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const mimeType = contentType.split(";")[0]?.trim().toLowerCase() || "";
      if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType) && mimeType !== "image/jpg") {
        throw new Error("图片链接仅支持 jpg/jpeg/png/webp 图片。");
      }

      return { buffer: await readImageResponseBody(response), sourceImageUrl: currentUrl };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("下载图片超时。");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("图片链接重定向次数过多。");
}

async function ensureArtifactImageColumns() {
  await db.query(`alter table artifacts add column if not exists local_image_url text not null default ''`);
  await db.query(`alter table artifacts add column if not exists local_thumbnail_url text not null default ''`);
  await db.query(`alter table artifacts add column if not exists updated_at timestamptz not null default now()`);
}

async function readImportedArtifactsStore() {
  const raw = await fs.readFile(IMPORTED_ARTIFACTS_PATH, "utf-8");
  const parsed = JSON.parse(raw) as { artifacts?: unknown[] } | unknown[];
  const artifacts = Array.isArray(parsed) ? parsed : Array.isArray(parsed.artifacts) ? parsed.artifacts : [];
  return { parsed, artifacts };
}

function artifactName(record: Record<string, unknown>) {
  return firstText(record, ["name", "名称", "title"]);
}

function artifactMuseum(record: Record<string, unknown>) {
  return firstText(record, ["museumName", "museum", "所属博物馆", "博物馆", "馆藏单位", "收藏单位", "馆名"]);
}

async function findImportedArtifact(id: string) {
  try {
    const { artifacts } = await readImportedArtifactsStore();
    for (const rawArtifact of artifacts) {
      if (!rawArtifact || typeof rawArtifact !== "object" || Array.isArray(rawArtifact)) continue;
      const artifact = rawArtifact as Record<string, unknown>;
      if (String(artifact.id ?? "") === id) return artifact;
    }
  } catch {
    return null;
  }
  return null;
}

async function findDbArtifact(id: string) {
  try {
    return await getArtifactFromDb(db, id);
  } catch {
    return null;
  }
}

async function updateImportedArtifactsImageUrls(
  id: string,
  localImageUrl: string,
  localThumbnailUrl: string,
  existingArtifact?: Record<string, unknown>,
  sourceImageUrl?: string,
) {
  try {
    const { parsed, artifacts } = await readImportedArtifactsStore();
    const expectedName = existingArtifact ? artifactName(existingArtifact) : "";
    const expectedMuseum = existingArtifact ? artifactMuseum(existingArtifact) : "";
    let updated = false;

    for (const rawArtifact of artifacts) {
      if (!rawArtifact || typeof rawArtifact !== "object" || Array.isArray(rawArtifact)) continue;
      const artifact = rawArtifact as Record<string, unknown>;
      const idMatches = String(artifact.id ?? "") === id;
      const nameMatches = expectedName && artifactName(artifact) === expectedName;
      const museumMatches = expectedMuseum && artifactMuseum(artifact) === expectedMuseum;
      if (!idMatches && !(nameMatches && museumMatches)) continue;
      artifact.localImageUrl = localImageUrl;
      artifact.localThumbnailUrl = localThumbnailUrl;
      if (sourceImageUrl) {
        artifact.imageUrl = sourceImageUrl;
        artifact.image_url = sourceImageUrl;
      }
      updated = true;
      break;
    }

    if (!updated) return false;
    await fs.writeFile(IMPORTED_ARTIFACTS_PATH, `${JSON.stringify(parsed, null, 2)}\n`, "utf-8");
    return true;
  } catch {
    return false;
  }
}

async function updateDbArtifactImageUrls(
  id: string,
  localImageUrl: string,
  localThumbnailUrl: string,
  existingArtifact: Record<string, unknown>,
  sourceImageUrl?: string,
) {
  try {
    await ensureArtifactImageColumns();
    const byId = await db.query(
      `update artifacts
       set local_image_url=$2,
           local_thumbnail_url=$3,
           image_url=coalesce($4, image_url),
           updated_at=now()
       where id::text=$1`,
      [id, localImageUrl, localThumbnailUrl, sourceImageUrl || null],
    );
    if ((byId.rowCount || 0) > 0) return true;

    const name = artifactName(existingArtifact);
    const museum = artifactMuseum(existingArtifact);
    if (!name || !museum) return false;

    const byIdentity = await db.query(
      `update artifacts a
       set local_image_url=$3,
           local_thumbnail_url=$4,
           image_url=coalesce($5, image_url),
           updated_at=now()
       from museums m
       where a.museum_id = m.id and a.name = $1 and m.name = $2`,
      [name, museum, localImageUrl, localThumbnailUrl, sourceImageUrl || null],
    );
    return (byIdentity.rowCount || 0) > 0;
  } catch {
    return false;
  }
}

function firstText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = cleanText(record[key]);
    if (value) return value;
  }
  return "";
}

function normalizeStringTags(tags: unknown) {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => {
        if (tag && typeof tag === "object" && !Array.isArray(tag)) {
          return cleanText((tag as Record<string, unknown>).name);
        }
        return cleanText(tag);
      })
      .filter(Boolean);
  }

  if (typeof tags === "string") {
    return tags
      .split(/[,，、\n]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeAttributeRows(attributes: unknown) {
  const rows: { group: string; name: string; value: string; order: number }[] = [];
  const add = (group: unknown, name: unknown, value: unknown, order: unknown) => {
    const attributeName = cleanText(name);
    const attributeValue = cleanText(value);
    if (!attributeName || !attributeValue) return;
    const parsedOrder = Number(order);
    rows.push({
      group: cleanText(group) || "基础信息",
      name: attributeName,
      value: attributeValue,
      order: Number.isFinite(parsedOrder) ? parsedOrder : rows.length + 1,
    });
  };

  if (Array.isArray(attributes)) {
    for (const rawGroup of attributes) {
      if (!rawGroup || typeof rawGroup !== "object") continue;
      const group = rawGroup as Record<string, unknown>;
      if (Array.isArray(group.items)) {
        group.items.forEach((rawItem, index) => {
          const item = rawItem && typeof rawItem === "object" ? (rawItem as Record<string, unknown>) : {};
          add(group.group ?? group.attribute_group, item.name ?? item.attribute_name, item.value ?? item.attribute_value, item.sortOrder ?? item.sort_order ?? index + 1);
        });
      } else {
        add(group.group ?? group.attribute_group, group.name ?? group.attribute_name, group.value ?? group.attribute_value, group.sortOrder ?? group.sort_order);
      }
    }
  }

  return rows;
}

function normalizeArtifactPayload(body: unknown) {
  const record = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const name = firstText(record, ["name", "名称"]);
  const museum = firstText(record, ["museumName", "museum", "所属博物馆", "博物馆", "馆藏单位", "收藏单位", "馆名"]) || "未归类博物馆";
  const dynasty = firstText(record, ["dynasty", "period", "era", "朝代", "时代", "年代"]) || "暂无信息";
  const category = firstText(record, ["category", "类别", "类型"]);
  const shortIntro = firstText(record, ["shortIntro", "short_intro", "一句话简介", "简介"]);
  const description = firstText(record, ["description", "desc", "介绍", "描述"]) || shortIntro || name;
  const imageUrl = firstText(record, ["imageUrl", "image_url", "image", "图片", "图片链接"]);
  const sourceUrl = firstText(record, ["sourceUrl", "source_url", "来源链接", "数据来源"]);
  const tags = normalizeStringTags(record.tags ?? record["标签"]);
  const attributes = normalizeAttributeRows(record.attributes);

  return { name, museum, dynasty, category, shortIntro, description, imageUrl, sourceUrl, tags, attributes };
}

async function getMuseumId(name: string) {
  await db.query(`insert into museums (name) values ($1) on conflict (name) do nothing`, [name]);
  const result = await db.query<{ id: number | string }>(`select id from museums where name = $1 limit 1`, [name]);
  return result.rows[0]?.id;
}

async function writeAttributeRows(artifactId: string | number, rows: ReturnType<typeof normalizeAttributeRows>) {
  await db.query(`delete from artifact_attributes where artifact_id = $1`, [artifactId]);
  for (const row of rows) {
    await db.query(
      `insert into artifact_attributes (artifact_id, attribute_group, attribute_name, attribute_value, sort_order)
       values ($1,$2,$3,$4,$5)`,
      [artifactId, row.group, row.name, row.value, row.order],
    );
  }
}

function normalizeTags(tags: unknown) {
  const rawTags = Array.isArray(tags)
    ? tags
    : typeof tags === "string"
      ? tags.replace(/[{}"]/g, "").split(",")
      : [];

  return rawTags
    .map((tag) => {
      if (tag && typeof tag === "object" && !Array.isArray(tag)) {
        const record = tag as Record<string, unknown>;
        return { type: text(record.type) || "文化标签", name: text(record.name) };
      }
      return { type: "文化标签", name: text(tag).trim() };
    })
    .filter((tag) => tag.name && tag.name !== "暂无信息");
}

async function persistArtifactImageBuffer(
  id: string,
  buffer: Buffer,
  existing: Record<string, unknown>,
  sourceImageUrl?: string,
) {
  const artifactId = String(existing.id || id);
  const fileBase = artifactImageFileBase(artifactId);
  const localImageUrl = `/artifact-images/${fileBase}.jpg`;
  const localThumbnailUrl = `/artifact-images/thumbs/${fileBase}-thumb.jpg`;
  const imagePath = path.join(ARTIFACT_IMAGES_DIR, `${fileBase}.jpg`);
  const thumbPath = path.join(ARTIFACT_THUMBS_DIR, `${fileBase}-thumb.jpg`);

  await fs.mkdir(ARTIFACT_IMAGES_DIR, { recursive: true });
  await fs.mkdir(ARTIFACT_THUMBS_DIR, { recursive: true });

  const image = sharp(buffer).rotate();
  await image.clone().jpeg({ quality: 92 }).toFile(imagePath);
  await image
    .clone()
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(thumbPath);

  const dbUpdated = await updateDbArtifactImageUrls(id, localImageUrl, localThumbnailUrl, existing, sourceImageUrl);
  const jsonUpdated = await updateImportedArtifactsImageUrls(
    id,
    localImageUrl,
    localThumbnailUrl,
    existing,
    sourceImageUrl,
  );
  const artifact = (await findDbArtifact(id)) || existing;

  return {
    ok: true,
    source: dbUpdated ? "database" : "imported-artifacts-json",
    artifact,
    artifactName: artifactName(existing),
    imageUrl: sourceImageUrl || cleanText(existing.imageUrl ?? existing.image_url),
    sourceImageUrl: sourceImageUrl || "",
    localImageUrl,
    localThumbnailUrl,
    originalPath: localImageUrl,
    thumbnailPath: localThumbnailUrl,
    dbUpdated,
    importedArtifactsUpdated: jsonUpdated,
  };
}

function addAttribute(
  groups: Map<string, { order: number; items: { name: string; value: string; order: number }[] }>,
  groupRaw: unknown,
  nameRaw: unknown,
  valueRaw: unknown,
  orderRaw: unknown,
) {
  if (isBlank(nameRaw) || isBlankAttributeValue(valueRaw)) return;
  const group = text(groupRaw) || "基础信息";
  const name = text(nameRaw);
  const value = text(valueRaw);
  const parsed = Number(orderRaw);
  const order = Number.isFinite(parsed) ? parsed : 0;
  const existing = groups.get(group) || { order, items: [] };
  existing.order = Math.min(existing.order, order);
  existing.items.push({ name, value, order });
  groups.set(group, existing);
}

function buildAttributeGroups(attributeRows: ArtifactAttributeRow[], artifact: Record<string, unknown>) {
  const groups = new Map<string, { order: number; items: { name: string; value: string; order: number }[] }>();

  for (const row of attributeRows) {
    addAttribute(groups, row.attribute_group, row.attribute_name, row.attribute_value, row.sort_order);
  }

  if (groups.size === 0) {
    addAttribute(groups, "基础信息", "材质", artifact.material, 1);
    addAttribute(groups, "基础信息", "尺寸", artifact.size || artifact.dimensions, 2);
    addAttribute(groups, "基础信息", "等级", artifact.level, 3);
    addAttribute(groups, "其他信息", "备注", artifact.remark || artifact.remarks || artifact.note, 4);
  }

  return Array.from(groups.entries())
    .map(([group, entry]) => ({
      group,
      order: entry.order,
      items: entry.items
        .sort((a, b) => a.order - b.order)
        .map((item) => ({ name: item.name, value: item.value })),
    }))
    .filter((group) => group.items.length > 0)
    .sort((a, b) => a.order - b.order)
    .map(({ group, items }) => ({ group, items }));
}

function toArtifactDetail(row: Record<string, unknown>, attributes: ArtifactAttributeRow[]) {
  const museumName = text(row.museum);
  const dynasty = text(row.dynasty);
  const imageUrl = text(row.image_url);
  const localImageUrl = text(row.local_image_url);
  const localThumbnailUrl = text(row.local_thumbnail_url);
  const sourceUrl = text(row.source_url);

  return {
    ...row,
    id: String(row.id),
    name: text(row.name),
    museumName,
    museum: museumName,
    dynasty,
    period: dynasty,
    category: text(row.category),
    localImageUrl,
    local_image_url: localImageUrl,
    localThumbnailUrl,
    local_thumbnail_url: localThumbnailUrl,
    imageUrl,
    image_url: imageUrl,
    shortIntro: text(row.short_intro),
    description: text(row.description),
    sourceUrl,
    source_url: sourceUrl,
    attributes: buildAttributeGroups(attributes, row),
    tags: normalizeTags(row.tags),
  };
}

export async function listArtifacts(req: Request, res: Response) {
  const limit = Math.min(Math.max(Number(req.query.limit || 5000) || 5000, 1), 10000);
  const keyword = typeof req.query.q === "string" ? req.query.q.trim() : "";

  if (keyword) {
    const artifacts = await searchRelics(db, { keyword, limit });
    return res.json({ source: "database", total: artifacts.length, artifacts });
  }

  const artifacts = await listArtifactsFromDb(db, limit);
  res.json({ source: "database", total: artifacts.length, artifacts });
}

export async function getArtifact(req: Request, res: Response) {
  const id = String(req.params.id || "");
  const artifact = await getArtifactFromDb(db, id);
  if (!artifact) return res.status(404).json({ error: "Not found" });
  res.json({ source: "database", artifact });
}

export async function searchArtifacts(req: Request, res: Response) {
  const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
  const limit = Math.min(Number(req.query.limit || 100), 500);
  if (!keyword) {
    return res.status(400).json({ error: "请输入搜索内容" });
  }

  const artifacts = await searchRelics(db, {
    keyword,
    limit: Number.isFinite(limit) ? limit : 100,
  });
  res.json({
    keyword,
    total: artifacts.length,
    artifacts,
    relics: artifacts,
  });
}

export async function ragSearchArtifacts(req: Request, res: Response) {
  const q = typeof req.body?.q === "string" ? req.body.q.trim() : "";
  const limitRaw = Number(req.body?.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(120, Math.max(1, limitRaw)) : 40;

  if (!q) {
    return res.status(400).json({ error: "q is required" });
  }

  const artifacts = await searchRelics(db, { keyword: q, limit });
  const artifactIds = artifacts.map((artifact) => artifact.id);

  res.json({
    mode: "database-keyword",
    artifactIds,
    keywordArtifactIds: artifactIds,
    semanticArtifactIds: [] as string[],
  });
}

export async function createArtifact(req: Request, res: Response) {
  try {
    const payload = normalizeArtifactPayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ error: "name is required" });
    }

    const museumId = await getMuseumId(payload.museum);
    if (museumId == null) {
      return res.status(400).json({ error: "museum is invalid" });
    }

    const inserted = await db.query<{ id: number | string }>(
      `insert into artifacts (name, dynasty, museum_id, category, short_intro, description, image_url, source_url, tags)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning id`,
      [
        payload.name,
        payload.dynasty,
        museumId,
        payload.category,
        payload.shortIntro,
        payload.description,
        payload.imageUrl,
        payload.sourceUrl,
        payload.tags,
      ],
    );

    const id = inserted.rows[0]?.id;
    if (id == null) {
      return res.status(500).json({ error: "Failed to create artifact" });
    }

    await writeAttributeRows(id, payload.attributes);
    const artifact = await getArtifactFromDb(db, String(id));
    return res.status(201).json({ source: "database", artifact });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function updateArtifact(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "");
    const existing = await getArtifactFromDb(db, id);
    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    const payload = normalizeArtifactPayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ error: "name is required" });
    }

    const museumId = await getMuseumId(payload.museum);
    if (museumId == null) {
      return res.status(400).json({ error: "museum is invalid" });
    }

    await db.query(
      `update artifacts
       set name=$2, dynasty=$3, museum_id=$4, category=$5, short_intro=$6,
           description=$7, image_url=$8, source_url=$9, tags=$10, updated_at=now()
       where id::text=$1`,
      [
        id,
        payload.name,
        payload.dynasty,
        museumId,
        payload.category,
        payload.shortIntro,
        payload.description,
        payload.imageUrl,
        payload.sourceUrl,
        payload.tags,
      ],
    );

    await writeAttributeRows(id, payload.attributes);
    const artifact = await getArtifactFromDb(db, id);
    return res.json({ source: "database", artifact });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function uploadArtifactImage(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "");
    const dbArtifact = await findDbArtifact(id);
    const importedArtifact = await findImportedArtifact(id);
    const existing = (dbArtifact || importedArtifact) as Record<string, unknown> | null;
    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "请先选择要上传的图片。" });
    }

    return res.json(await persistArtifactImageBuffer(id, req.file.buffer, existing));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function uploadArtifactImageFromUrl(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "");
    const imageUrl = cleanText(req.body?.imageUrl);
    if (!imageUrl) {
      return res.status(400).json({ error: "请先填写图片链接。" });
    }

    const dbArtifact = await findDbArtifact(id);
    const importedArtifact = await findImportedArtifact(id);
    const existing = (dbArtifact || importedArtifact) as Record<string, unknown> | null;
    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    const downloaded = await downloadImageBuffer(imageUrl);
    return res.json(await persistArtifactImageBuffer(id, downloaded.buffer, existing, downloaded.sourceImageUrl));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function deleteArtifact(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "");
    const existing = await getArtifactFromDb(db, id);
    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    await db.query(`delete from exhibition_items where artifact_id::text = $1`, [id]);
    await db.query(`delete from likes where target_type = 'artifact' and target_id::text = $1`, [id]);
    await db.query(`delete from artifacts where id::text = $1`, [id]);
    return res.json({ ok: true, id });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
