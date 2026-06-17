import fs from "fs/promises";
import path from "path";
import type { Request, RequestHandler, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { db } from "../db/client";
import { downloadImageBuffer } from "../lib/imageDownloader";
import type { ArtifactRow, MuseumRow } from "../models/types";
import { syncAiRagForArtifacts } from "../../ai-rag-data";
import { listArtifactsFromDb } from "../db/syncImportedArtifacts";
import {
  ensureMuseumSchema,
  findPossibleMuseumDuplicates,
  normalizeMuseumName,
  normalizedMuseumKey,
} from "../../museum-normalizer";
import {
  MUSEUM_GRADE_OPTIONS,
  MUSEUM_LEVEL_OPTIONS,
  MUSEUM_TYPE_OPTIONS,
  PROVINCE_OPTIONS,
  normalizeMuseumCity,
  normalizeMuseumGrade,
  normalizeMuseumLevel,
  normalizeMuseumProvince,
  normalizeMuseumType,
} from "../../../src/constants/locationOptions";

const MUSEUM_IMAGES_DIR = path.join(process.cwd(), "public", "museum-images");
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const multerMuseumCoverUpload = multer({
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

export const uploadMuseumCoverFile: RequestHandler = (req, res, next) => {
  multerMuseumCoverUpload(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
    return next();
  });
};

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function boolParam(value: unknown) {
  return value === "1" || value === "true" || value === true;
}

function optionalBoolParam(value: unknown): boolean | null {
  if (value === undefined || value === null || value === "") return null;
  if (value === "1" || value === "true" || value === true) return true;
  if (value === "0" || value === "false" || value === false) return false;
  return null;
}

function coverUrl(row: Record<string, unknown>) {
  return (
    text(row.storage_cover_thumbnail_url) ||
    text(row.local_cover_thumbnail_url) ||
    text(row.cover_thumbnail_url) ||
    text(row.storage_cover_image_url) ||
    text(row.local_cover_image_url) ||
    text(row.cover_image_url) ||
    text(row.image_url)
  );
}

function toCamelMuseum(row: Record<string, unknown>) {
  const aliases = Array.isArray(row.aliases) ? row.aliases : [];
  return {
    id: String(row.id),
    name: text(row.name),
    normalizedName: text(row.normalized_name),
    aliases,
    type: text(row.type),
    level: text(row.level),
    grade: text(row.grade),
    province: text(row.province),
    city: text(row.city),
    address: text(row.address),
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    officialWebsite: text(row.official_website),
    description: text(row.description),
    history: text(row.history),
    highlights: text(row.highlights),
    openingHours: text(row.opening_hours),
    ticketInfo: text(row.ticket_info),
    contact: text(row.contact),
    coverImageUrl: text(row.cover_image_url),
    coverThumbnailUrl: text(row.cover_thumbnail_url),
    localCoverImageUrl: text(row.local_cover_image_url),
    localCoverThumbnailUrl: text(row.local_cover_thumbnail_url),
    storageCoverImageUrl: text(row.storage_cover_image_url),
    storageCoverThumbnailUrl: text(row.storage_cover_thumbnail_url),
    imageSource: text(row.image_source),
    source: text(row.source),
    createdByImport: Boolean(row.created_by_import),
    artifactCount: Number(row.artifact_count || 0),
    isFeatured: Boolean(row.is_featured),
    hasCover: Boolean(coverUrl(row)),
    displayCoverUrl: coverUrl(row),
    location: text(row.location),
    imageUrl: coverUrl(row),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function toCamelAlias(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    museumId: String(row.museum_id),
    alias: text(row.alias),
    normalizedAlias: text(row.normalized_alias),
    source: text(row.source),
    confidence: Number(row.confidence || 0),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function toArtifactSummary(row: ArtifactRow) {
  return {
    id: String(row.id),
    name: row.name,
    dynasty: row.dynasty,
    museumId: String(row.museum_id),
    museum: row.museum,
    category: row.category || "",
    shortIntro: row.short_intro || "",
    description: row.description,
    imageUrl: row.image_url,
    image_url: row.image_url,
    localImageUrl: row.local_image_url || "",
    local_image_url: row.local_image_url || "",
    localThumbnailUrl: row.local_thumbnail_url || "",
    local_thumbnail_url: row.local_thumbnail_url || "",
    tags: row.tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function refreshMuseumArtifactCounts() {
  const counts = await db.query<{ museum_id: number | string; c: string }>(
    `select museum_id, count(id)::text as c from artifacts group by museum_id`,
  );
  await db.query(`update museums set artifact_count = 0`);
  for (const row of counts.rows) {
    await db.query(`update museums set artifact_count=$2 where id=$1`, [row.museum_id, Number(row.c) || 0]);
  }
}

async function syncAiRagAfterMuseumChange() {
  return syncAiRagForArtifacts(await listArtifactsFromDb(db));
}

function museumImagePaths(id: number) {
  const dir = path.join(MUSEUM_IMAGES_DIR, String(id));
  const thumbsDir = path.join(dir, "thumbs");
  return {
    dir,
    thumbsDir,
    imagePath: path.join(dir, "cover.jpg"),
    thumbPath: path.join(thumbsDir, "cover-thumb.jpg"),
    legacyThumbPath: path.join(thumbsDir, "cover.jpg"),
    localCoverImageUrl: `/museum-images/${id}/cover.jpg`,
    localCoverThumbnailUrl: `/museum-images/${id}/thumbs/cover-thumb.jpg`,
  };
}

async function addMuseumAliasKeys(museumId: number | string, aliases: string[]) {
  const row = await db.query<{ aliases?: string[] | null }>(`select aliases from museums where id=$1 limit 1`, [museumId]);
  const existing = Array.isArray(row.rows[0]?.aliases) ? row.rows[0]!.aliases! : [];
  const merged = Array.from(new Set([...existing, ...aliases].filter(Boolean)));
  await db.query(`update museums set aliases=$2, updated_at=now() where id=$1`, [museumId, merged]);
}

export async function listMuseums(req: Request, res: Response) {
  await ensureMuseumSchema(db);
  await refreshMuseumArtifactCounts();
  const page = Math.max(Number(req.query.page || 1) || 1, 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize || req.query.limit || 100) || 100, 1), 500);
  const offset = (page - 1) * pageSize;
  const search = text(req.query.q || req.query.search);
  const province = text(req.query.province);
  const city = text(req.query.city);
  const type = text(req.query.type);
  const grade = text(req.query.grade);
  const hasArtifacts = optionalBoolParam(req.query.hasArtifacts ?? req.query.withArtifacts);
  const createdByImport = optionalBoolParam(req.query.createdByImport);
  const hasCover = optionalBoolParam(req.query.hasCover);
  const onlyDuplicates = boolParam(req.query.suspectedDuplicate ?? req.query.duplicates);

  const params: unknown[] = [];
  const where: string[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  };

  if (search) {
    params.push(`%${search}%`, `%${search}%`);
    where.push(
      `(m.name ilike $${params.length - 1} or m.province ilike $${params.length - 1} or m.city ilike $${params.length - 1} or exists (select 1 from museum_aliases ma where ma.museum_id=m.id and ma.alias ilike $${params.length}))`,
    );
  }
  if (province) add(`m.province = ?`, province);
  if (city) add(`m.city = ?`, city);
  if (type) add(`m.type = ?`, type);
  if (grade) add(`m.grade = ?`, grade);
  if (hasArtifacts === true) where.push(`m.artifact_count > 0`);
  if (hasArtifacts === false) where.push(`m.artifact_count = 0`);
  if (createdByImport === true) where.push(`m.created_by_import = true`);
  if (createdByImport === false) where.push(`m.created_by_import = false`);
  if (hasCover === true) {
    where.push(`(coalesce(m.storage_cover_thumbnail_url, '') <> '' or coalesce(m.local_cover_thumbnail_url, '') <> '' or coalesce(m.cover_thumbnail_url, '') <> '' or coalesce(m.storage_cover_image_url, '') <> '' or coalesce(m.local_cover_image_url, '') <> '' or coalesce(m.cover_image_url, '') <> '' or coalesce(m.image_url, '') <> '')`);
  }
  if (hasCover === false) {
    where.push(`(coalesce(m.storage_cover_thumbnail_url, '') = '' and coalesce(m.local_cover_thumbnail_url, '') = '' and coalesce(m.cover_thumbnail_url, '') = '' and coalesce(m.storage_cover_image_url, '') = '' and coalesce(m.local_cover_image_url, '') = '' and coalesce(m.cover_image_url, '') = '' and coalesce(m.image_url, '') = '')`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const rows = await db.query<MuseumRow>(
    `select m.*
     from museums m
     ${whereSql}
     order by m.artifact_count desc, m.updated_at desc, m.name asc
     limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, pageSize, offset],
  );
  const countRows = await db.query<{ total: string }>(`select count(*)::text as total from museums m ${whereSql}`, params);
  const museums = rows.rows.map((row) => toCamelMuseum(row as unknown as Record<string, unknown>));
  const filteredMuseums = onlyDuplicates
    ? museums.filter((museum) => museums.some((candidate) => candidate.id !== museum.id && normalizedMuseumKey(candidate.name)?.includes(normalizedMuseumKey(museum.name) || "__never__")))
    : museums;

  res.json({
    museums: filteredMuseums,
    total: Number(countRows.rows[0]?.total || filteredMuseums.length),
    page,
    pageSize,
  });
}

export async function getMuseum(req: Request, res: Response) {
  await ensureMuseumSchema(db);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const museumRow = await db.query<MuseumRow>(`select * from museums where id = $1`, [id]);
  const museum = museumRow.rows[0];
  if (!museum) return res.status(404).json({ error: "Not found" });

  const aliases = await db.query(`select * from museum_aliases where museum_id = $1 order by confidence desc, alias asc`, [id]);
  const artifacts = await db.query<ArtifactRow>(
    `select a.id, a.name, a.dynasty, a.museum_id, m.name as museum, a.category, a.short_intro,
            a.description, a.image_url, a.local_image_url, a.local_thumbnail_url, a.tags, a.created_at, a.updated_at
     from artifacts a
     join museums m on m.id = a.museum_id
     where a.museum_id = $1
     order by a.id asc`,
    [id],
  );

  res.json({
    museum: toCamelMuseum(museum as unknown as Record<string, unknown>),
    aliases: aliases.rows.map((row) => toCamelAlias(row as Record<string, unknown>)),
    artifacts: artifacts.rows.map(toArtifactSummary),
    stats: { artifactCount: artifacts.rows.length },
  });
}

export async function updateMuseum(req: Request, res: Response) {
  await ensureMuseumSchema(db);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const name = normalizeMuseumName(body.name);
  if (!name) return res.status(400).json({ error: "name is required" });
  const normalizedName = normalizedMuseumKey(name);
  const rawProvince = text(body.province);
  const rawType = text(body.type);
  const rawGrade = text(body.grade);
  const rawLevel = text(body.level);
  if (rawProvince && !PROVINCE_OPTIONS.includes(rawProvince as (typeof PROVINCE_OPTIONS)[number])) {
    return res.status(400).json({ error: "province must be one of the standard province options" });
  }
  if (rawType && !MUSEUM_TYPE_OPTIONS.includes(rawType as (typeof MUSEUM_TYPE_OPTIONS)[number])) {
    return res.status(400).json({ error: "type must be one of the standard museum type options" });
  }
  if (rawGrade && !MUSEUM_GRADE_OPTIONS.includes(rawGrade as (typeof MUSEUM_GRADE_OPTIONS)[number])) {
    return res.status(400).json({ error: "grade must be one of the standard museum grade options" });
  }
  if (rawLevel && !MUSEUM_LEVEL_OPTIONS.includes(rawLevel as (typeof MUSEUM_LEVEL_OPTIONS)[number])) {
    return res.status(400).json({ error: "level must be one of the standard museum level options" });
  }
  const province = normalizeMuseumProvince(body.province) || null;
  const city = normalizeMuseumCity(province, body.city) || null;
  const type = normalizeMuseumType(body.type);
  const grade = normalizeMuseumGrade(body.grade);
  const level = normalizeMuseumLevel(body.level);

  const result = await db.query<MuseumRow>(
    `update museums
     set name=$2, normalized_name=$3, type=$4, level=$5, grade=$6, province=$7, city=$8,
         address=$9, official_website=$10, description=$11, history=$12, opening_hours=$13,
         ticket_info=$14, highlights=$15, contact=$16, is_featured=$17, location=$18, updated_at=now()
     where id=$1
     returning *`,
    [
      id,
      name,
      normalizedName,
      type,
      level,
      grade,
      province,
      city,
      text(body.address) || null,
      text(body.officialWebsite ?? body.official_website) || null,
      text(body.description),
      text(body.history),
      text(body.openingHours ?? body.opening_hours),
      text(body.ticketInfo ?? body.ticket_info),
      text(body.highlights),
      text(body.contact),
      Boolean(body.isFeatured ?? body.is_featured),
      [city, text(body.address)].filter(Boolean).join(" "),
    ],
  );
  const museum = result.rows[0];
  if (!museum) return res.status(404).json({ error: "Not found" });
  await db.query(`update artifacts set canonical_museum_name=$2, updated_at=now() where museum_id=$1`, [id, name]);
  const aiRagSync = await syncAiRagAfterMuseumChange();
  res.json({ museum: toCamelMuseum(museum as unknown as Record<string, unknown>), aiRagSync });
}

export async function uploadMuseumCover(req: Request, res: Response) {
  await ensureMuseumSchema(db);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  if (!req.file) return res.status(400).json({ error: "请先选择要上传的图片。" });

  try {
    res.json(await persistMuseumCoverBuffer(id, req.file.buffer, "local_upload"));
  } catch (error) {
    const status = error instanceof Error && error.message === "Not found" ? 404 : 400;
    res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

async function persistMuseumCoverBuffer(id: number, buffer: Buffer, imageSource: "local_upload" | "url_download") {
  const museum = await db.query(`select id from museums where id=$1 limit 1`, [id]);
  if (!museum.rows[0]) throw new Error("Not found");

  const { thumbsDir, imagePath, thumbPath, legacyThumbPath, localCoverImageUrl, localCoverThumbnailUrl } = museumImagePaths(id);
  await fs.mkdir(thumbsDir, { recursive: true });
  const image = sharp(buffer).rotate();
  await image.clone().jpeg({ quality: 92 }).toFile(imagePath);
  await image.clone().resize({ width: 640, height: 360, fit: "cover" }).jpeg({ quality: 84 }).toFile(thumbPath);
  await fs.rm(legacyThumbPath, { force: true }).catch(() => undefined);

  const result = await db.query<MuseumRow>(
    `update museums
     set local_cover_image_url=$2, local_cover_thumbnail_url=$3, cover_image_url=$2,
         cover_thumbnail_url=$3, image_url=$3, image_source=$4, updated_at=now()
     where id=$1
     returning *`,
    [id, localCoverImageUrl, localCoverThumbnailUrl, imageSource],
  );
  const aiRagSync = await syncAiRagAfterMuseumChange();
  return {
    museum: toCamelMuseum(result.rows[0] as unknown as Record<string, unknown>),
    localCoverImageUrl,
    localCoverThumbnailUrl,
    aiRagSync,
  };
}

export async function uploadMuseumCoverFromUrl(req: Request, res: Response) {
  await ensureMuseumSchema(db);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const imageUrl = text(req.body?.imageUrl);
  if (!imageUrl) return res.status(400).json({ error: "请先填写图片链接。" });

  try {
    const downloaded = await downloadImageBuffer(imageUrl, "museum-cover-url-download");
    res.json(await persistMuseumCoverBuffer(id, downloaded.buffer, "url_download"));
  } catch (error) {
    const status = error instanceof Error && error.message === "Not found" ? 404 : 400;
    res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function deleteMuseumCover(req: Request, res: Response) {
  await ensureMuseumSchema(db);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const result = await db.query<MuseumRow>(
    `update museums
     set local_cover_image_url='', local_cover_thumbnail_url='', cover_image_url='', cover_thumbnail_url='',
         image_url='', image_source='', updated_at=now()
     where id=$1`,
    [id],
  );
  if (!result.rowCount) return res.status(404).json({ error: "Not found" });
  const { imagePath, thumbPath, legacyThumbPath } = museumImagePaths(id);
  await fs.rm(imagePath, { force: true }).catch(() => undefined);
  await fs.rm(thumbPath, { force: true }).catch(() => undefined);
  await fs.rm(legacyThumbPath, { force: true }).catch(() => undefined);
  const aiRagSync = await syncAiRagAfterMuseumChange();
  res.json({ ok: true, aiRagSync });
}

export async function addMuseumAlias(req: Request, res: Response) {
  await ensureMuseumSchema(db);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const alias = normalizeMuseumName(req.body?.alias);
  const normalizedAlias = normalizedMuseumKey(alias);
  if (!alias || !normalizedAlias) return res.status(400).json({ error: "alias is required" });
  const confidence = Number(req.body?.confidence ?? 1);
  const existing = await db.query<{ id: number | string }>(`select id from museum_aliases where normalized_alias=$1 limit 1`, [normalizedAlias]);
  const result = existing.rows[0]
    ? await db.query(
      `update museum_aliases
       set museum_id=$2, alias=$3, source=$4, confidence=$5, updated_at=now()
       where id=$1
       returning *`,
      [existing.rows[0].id, id, alias, text(req.body?.source) || "admin", Number.isFinite(confidence) ? confidence : 1],
    )
    : await db.query(
      `insert into museum_aliases (museum_id, alias, normalized_alias, source, confidence)
       values ($1,$2,$3,$4,$5)
       returning *`,
      [id, alias, normalizedAlias, text(req.body?.source) || "admin", Number.isFinite(confidence) ? confidence : 1],
    );
  await addMuseumAliasKeys(id, [normalizedAlias]);
  const aiRagSync = await syncAiRagAfterMuseumChange();
  res.status(201).json({ alias: toCamelAlias(result.rows[0]), aiRagSync });
}

export async function deleteMuseumAlias(req: Request, res: Response) {
  await ensureMuseumSchema(db);
  const id = Number(req.params.id);
  const aliasId = Number(req.params.aliasId);
  if (!Number.isFinite(id) || !Number.isFinite(aliasId)) return res.status(400).json({ error: "Invalid id" });
  await db.query(`delete from museum_aliases where id=$1 and museum_id=$2`, [aliasId, id]);
  const aiRagSync = await syncAiRagAfterMuseumChange();
  res.json({ ok: true, aiRagSync });
}

export async function mergeMuseum(req: Request, res: Response) {
  await ensureMuseumSchema(db);
  const sourceId = Number(req.params.id);
  const targetId = Number(req.body?.targetMuseumId ?? req.body?.targetId);
  if (!Number.isFinite(sourceId) || !Number.isFinite(targetId) || sourceId === targetId) {
    return res.status(400).json({ error: "Invalid source/target museum id" });
  }
  const targetRows = await db.query<MuseumRow>(`select * from museums where id=$1 limit 1`, [targetId]);
  const sourceRows = await db.query<MuseumRow>(`select * from museums where id=$1 limit 1`, [sourceId]);
  const target = targetRows.rows[0];
  const source = sourceRows.rows[0];
  if (!target || !source) return res.status(404).json({ error: "Museum not found" });

  await db.query(
    `update artifacts
     set museum_id=$2, canonical_museum_name=$3, updated_at=now()
     where museum_id=$1`,
    [sourceId, targetId, target.name],
  );
  const sourceAliasKey = normalizedMuseumKey(source.name);
  if (sourceAliasKey) {
    const existingAlias = await db.query<{ id: number | string }>(`select id from museum_aliases where normalized_alias=$1 limit 1`, [sourceAliasKey]);
    if (existingAlias.rows[0]) {
      await db.query(`update museum_aliases set museum_id=$2, alias=$3, source='merge', confidence=1, updated_at=now() where id=$1`, [existingAlias.rows[0].id, targetId, source.name]);
    } else {
      await db.query(
        `insert into museum_aliases (museum_id, alias, normalized_alias, source, confidence)
         values ($1,$2,$3,'merge',1)`,
        [targetId, source.name, sourceAliasKey],
      );
    }
  }
  await db.query(`update museum_aliases set museum_id=$2, updated_at=now() where museum_id=$1`, [sourceId, targetId]);
  await addMuseumAliasKeys(targetId, [sourceAliasKey].filter(Boolean) as string[]);
  await db.query(`delete from museums where id=$1`, [sourceId]);
  await refreshMuseumArtifactCounts();
  const aiRagSync = await syncAiRagAfterMuseumChange();
  res.json({ ok: true, targetMuseumId: String(targetId), aiRagSync });
}

export async function listMuseumArtifacts(req: Request, res: Response) {
  await ensureMuseumSchema(db);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const search = text(req.query.search || req.query.q);
  const dynasty = text(req.query.dynasty || req.query.period);
  const category = text(req.query.category);
  const material = text(req.query.material);
  const params: unknown[] = [id];
  const where = [`a.museum_id = $1`];
  if (search) {
    params.push(`%${search}%`);
    where.push(`(a.name ilike $${params.length} or a.description ilike $${params.length})`);
  }
  if (dynasty) {
    params.push(`%${dynasty}%`);
    where.push(`a.dynasty ilike $${params.length}`);
  }
  if (category) {
    params.push(`%${category}%`);
    where.push(`a.category ilike $${params.length}`);
  }
  if (material) {
    params.push(`%${material}%`);
    where.push(`exists (
      select 1 from artifact_attributes aa
      where aa.artifact_id=a.id and aa.attribute_name='材质' and aa.attribute_value ilike $${params.length}
    )`);
  }
  const rows = await db.query<ArtifactRow>(
    `select a.id, a.name, a.dynasty, a.museum_id, m.name as museum, a.category, a.short_intro,
            a.description, a.image_url, a.local_image_url, a.local_thumbnail_url, a.tags, a.created_at, a.updated_at
     from artifacts a
     join museums m on m.id = a.museum_id
     where ${where.join(" and ")}
     order by a.id asc`,
    params,
  );
  res.json({ artifacts: rows.rows.map(toArtifactSummary), total: rows.rows.length });
}

export async function getMuseumDuplicates(req: Request, res: Response) {
  await ensureMuseumSchema(db);
  const name = text(req.query.name);
  if (!name) return res.json({ duplicates: [] });
  res.json({ duplicates: await findPossibleMuseumDuplicates(db, name) });
}
