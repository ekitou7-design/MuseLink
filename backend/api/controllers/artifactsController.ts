import type { Request, Response } from "express";
import { db } from "../db/client";
import { searchRelics } from "../db/relicSearch";
import type { ArtifactAttributeRow, ArtifactRow } from "../models/types";

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
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const rows = await db.query<ArtifactRow>(
    `select a.id, a.name, a.dynasty, a.museum_id, m.name as museum, a.description, a.image_url, a.tags, a.created_at
     from artifacts a
     join museums m on m.id = a.museum_id
     order by a.id asc
     limit $1`,
    [Number.isFinite(limit) ? limit : 100],
  );
  res.json({ artifacts: rows.rows });
}

export async function getArtifact(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const columns = await getArtifactColumns();
  const optionalSelect = OPTIONAL_ARTIFACT_COLUMNS.filter((column) => columns.has(column)).map(
    (column) => `a.${column} as ${column}`,
  );
  const row = await db.query<Record<string, unknown>>(
    `select a.id, a.name, a.dynasty, a.museum_id, m.name as museum, a.description, a.image_url, a.tags, a.created_at
       ${optionalSelect.length ? `, ${optionalSelect.join(", ")}` : ""}
     from artifacts a
     join museums m on m.id = a.museum_id
     where a.id = $1`,
    [id],
  );

  const artifact = row.rows[0];
  if (!artifact) return res.status(404).json({ error: "Not found" });

  let attributes: ArtifactAttributeRow[] = [];
  try {
    const attributeRows = await db.query<ArtifactAttributeRow>(
      `select id, artifact_id, attribute_group, attribute_name, attribute_value, sort_order, created_at, updated_at
       from artifact_attributes
       where artifact_id = $1
         and nullif(btrim(coalesce(attribute_value, '')), '') is not null
       order by sort_order asc, id asc`,
      [id],
    );
    attributes = attributeRows.rows;
  } catch {
    attributes = [];
  }

  res.json({ artifact: toArtifactDetail(artifact, attributes) });
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
