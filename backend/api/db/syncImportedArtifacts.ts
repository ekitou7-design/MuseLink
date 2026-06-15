import fs from "fs/promises";
import path from "path";
import type { Artifact, ArtifactAttributeGroup, ArtifactTag } from "../../../src/types";
import {
  artifactCategoryRaw,
  artifactDescriptionRaw,
  artifactDimensionsRaw,
  artifactEraRaw,
  artifactImageUrlRaw,
  artifactLevelRaw,
  artifactMaterialRaw,
  artifactMuseumRaw,
  artifactNameRaw,
  artifactOriginRaw,
  artifactRemarksRaw,
} from "../../../src/lib/dbDisplay";

export type DbQuery = {
  query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
};

type ImportedStore = {
  artifacts?: Artifact[];
};

type ArtifactRow = {
  id: number | string;
  name: string;
  dynasty: string;
  museum_id: number | string;
  museum: string;
  category?: string | null;
  short_intro?: string | null;
  description: string;
  image_url: string;
  local_image_url?: string | null;
  local_thumbnail_url?: string | null;
  source_url?: string | null;
  tags: string[] | null;
  created_at?: string;
  updated_at?: string;
};

type AttributeRow = {
  artifact_id: number | string;
  attribute_group: string;
  attribute_name: string;
  attribute_value: string;
  sort_order: number;
};

const IMPORTED_ARTIFACTS_PATH = path.join(process.cwd(), "data", "imported-artifacts.json");

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  const normalized = String(value).trim();
  if (normalized === "undefined" || normalized === "null") return "";
  return normalized;
}

function tagText(tag: ArtifactTag): string {
  if (typeof tag === "string") return tag;
  return text(tag.name || [tag.type, tag.name].filter(Boolean).join(" "));
}

function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags.map((tag) => (typeof tag === "object" && tag !== null ? tagText(tag as ArtifactTag) : text(tag))).filter(Boolean);
  }
  if (typeof tags === "string") {
    return tags.split(/[,，、]/).map(text).filter(Boolean);
  }
  return [];
}

function normalizeImportedArtifacts(artifacts: Artifact[]) {
  const seen = new Set<string>();
  const normalized: Artifact[] = [];

  for (const artifact of artifacts) {
    const name = text(artifactNameRaw(artifact));
    const museum = text(artifactMuseumRaw(artifact)) || "未归类博物馆";
    if (!name) continue;
    const key = text(artifact.id) || `${name}::${museum}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ ...artifact, name, museum });
  }

  return normalized;
}

export async function readImportedArtifactsForDb() {
  try {
    const raw = await fs.readFile(IMPORTED_ARTIFACTS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as ImportedStore | Artifact[];
    const artifacts = Array.isArray(parsed) ? parsed : Array.isArray(parsed.artifacts) ? parsed.artifacts : [];
    return normalizeImportedArtifacts(artifacts);
  } catch {
    return [];
  }
}

async function getArtifactColumns(db: DbQuery) {
  try {
    const result = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'artifacts'`,
    );
    return new Set(result.rows.map((row) => row.column_name));
  } catch {
    return new Set<string>();
  }
}

function attributeItemsFromArtifact(artifact: Artifact): AttributeRow[] {
  const rows: AttributeRow[] = [];
  const add = (group: string, name: string, value: unknown, sortOrder: number) => {
    const clean = text(value);
    if (!clean || clean === "未知" || clean === "暂无信息") return;
    rows.push({
      artifact_id: "",
      attribute_group: group,
      attribute_name: name,
      attribute_value: clean,
      sort_order: sortOrder,
    });
  };

  add("基础信息", "材质", artifactMaterialRaw(artifact), 1);
  add("基础信息", "尺寸", artifactDimensionsRaw(artifact), 2);
  add("基础信息", "等级", artifactLevelRaw(artifact), 3);
  add("基础信息", "出土地/来源", artifactOriginRaw(artifact), 4);
  add("其他信息", "备注", artifactRemarksRaw(artifact), 5);

  const attributes = (artifact as unknown as { attributes?: ArtifactAttributeGroup[] }).attributes;
  if (Array.isArray(attributes)) {
    attributes.forEach((group, groupIndex) => {
      if (!Array.isArray(group.items)) return;
      group.items.forEach((item, itemIndex) => {
        add(text(group.group) || "扩展信息", text(item.name), item.value, 20 + groupIndex * 100 + itemIndex);
      });
    });
  }

  return rows;
}

async function upsertAttributeRows(db: DbQuery, artifactId: number | string, rows: AttributeRow[]) {
  await db.query(`delete from artifact_attributes where artifact_id = $1`, [artifactId]);
  for (const row of rows) {
    await db.query(
      `insert into artifact_attributes (artifact_id, attribute_group, attribute_name, attribute_value, sort_order)
       values ($1,$2,$3,$4,$5)`,
      [artifactId, row.attribute_group, row.attribute_name, row.attribute_value, row.sort_order],
    );
  }
}

async function findExistingArtifactId(db: DbQuery, name: string, museumId: number | string) {
  const result = await db.query<{ id: number | string }>(
    `select id from artifacts where name = $1 and museum_id = $2 order by id asc limit 1`,
    [name, museumId],
  );
  return result.rows[0]?.id;
}

export async function syncImportedArtifactsToDb(db: DbQuery) {
  const artifacts = await readImportedArtifactsForDb();
  if (artifacts.length === 0) {
    return { importedCount: 0, inserted: 0, updated: 0, skipped: true };
  }

  const columns = await getArtifactColumns(db);
  const canWriteSourceUrl = columns.has("source_url");
  const canWriteLocalImageUrl = columns.has("local_image_url");
  const canWriteLocalThumbnailUrl = columns.has("local_thumbnail_url");
  let inserted = 0;
  let updated = 0;

  for (const artifact of artifacts) {
    const name = text(artifactNameRaw(artifact));
    const museum = text(artifactMuseumRaw(artifact)) || "未归类博物馆";
    const dynasty = text(artifactEraRaw(artifact)) || "暂无信息";
    const category = text(artifactCategoryRaw(artifact));
    const shortIntro = text(artifact.shortIntro || (artifact as any).short_intro);
    const description = text(artifactDescriptionRaw(artifact)) || shortIntro || name;
    const imageUrl = text(artifactImageUrlRaw(artifact));
    const localImageUrl = text((artifact as any).localImageUrl || (artifact as any).local_image_url);
    const localThumbnailUrl = text((artifact as any).localThumbnailUrl || (artifact as any).local_thumbnail_url);
    const sourceUrl = text(artifact.sourceUrl || (artifact as any).source_url);
    const tags = normalizeTags(artifact.tags);

    await db.query(`insert into museums (name) values ($1) on conflict (name) do nothing`, [museum]);
    const museumRows = await db.query<{ id: number | string }>(`select id from museums where name = $1 limit 1`, [museum]);
    const museumId = museumRows.rows[0]?.id;
    if (museumId == null) continue;

    const existingId = await findExistingArtifactId(db, name, museumId);
    const writableImageColumns = [
      ...(canWriteLocalImageUrl ? [{ column: "local_image_url", value: localImageUrl }] : []),
      ...(canWriteLocalThumbnailUrl ? [{ column: "local_thumbnail_url", value: localThumbnailUrl }] : []),
    ];
    const baseParams = [name, dynasty, museumId, category, shortIntro, description, imageUrl, tags];
    let artifactId = existingId;

    if (existingId != null) {
      const params = [existingId, dynasty, category, shortIntro, description, imageUrl, tags];
      const assignments = [
        "dynasty=$2",
        "category=$3",
        "short_intro=$4",
        "description=$5",
        "image_url=$6",
        "tags=$7",
      ];
      if (canWriteSourceUrl) {
        params.push(sourceUrl);
        assignments.push(`source_url=$${params.length}`);
      }
      for (const item of writableImageColumns) {
        params.push(item.value);
        assignments.push(`${item.column}=$${params.length}`);
      }
      if (columns.has("updated_at")) assignments.push("updated_at=now()");
      await db.query(
        `update artifacts
         set ${assignments.join(", ")}
         where id=$1`,
        params,
      );
      updated += 1;
    } else {
      const columnsSql = ["name", "dynasty", "museum_id", "category", "short_intro", "description", "image_url", "tags"];
      const params = [...baseParams];
      if (canWriteSourceUrl) {
        columnsSql.push("source_url");
        params.push(sourceUrl);
      }
      for (const item of writableImageColumns) {
        columnsSql.push(item.column);
        params.push(item.value);
      }
      const placeholders = params.map((_, index) => `$${index + 1}`).join(",");
      const insertedRow = await db.query<{ id: number | string }>(
        `insert into artifacts (${columnsSql.join(", ")})
         values (${placeholders})
         returning id`,
        params,
      );
      artifactId = insertedRow.rows[0]?.id;
      inserted += 1;
    }

    if (artifactId != null) {
      await upsertAttributeRows(db, artifactId, attributeItemsFromArtifact(artifact));
    }
  }

  return { importedCount: artifacts.length, inserted, updated, skipped: false };
}

function normalizeTagsForArtifact(tags: unknown): Array<{ type: string; name: string }> {
  return normalizeTags(tags).map((name) => ({ type: "文化标签", name }));
}

function toArtifact(row: ArtifactRow, attributes: AttributeRow[] = []): Artifact {
  const id = String(row.id);
  const imageUrl = text(row.image_url);
  const localImageUrl = text(row.local_image_url);
  const localThumbnailUrl = text(row.local_thumbnail_url);
  const sourceUrl = text(row.source_url);
  const groups = new Map<string, { order: number; items: { name: string; value: string; order: number }[] }>();

  attributes.forEach((attribute) => {
    const group = text(attribute.attribute_group) || "基础信息";
    const entry = groups.get(group) || { order: attribute.sort_order || 0, items: [] };
    entry.order = Math.min(entry.order, attribute.sort_order || 0);
    entry.items.push({
      name: text(attribute.attribute_name),
      value: text(attribute.attribute_value),
      order: attribute.sort_order || 0,
    });
    groups.set(group, entry);
  });

  return {
    id,
    name: text(row.name),
    museumName: text(row.museum),
    museum: text(row.museum),
    period: text(row.dynasty),
    dynasty: text(row.dynasty),
    material: "",
    culture: "",
    origin: "",
    category: text(row.category),
    shortIntro: text(row.short_intro),
    description: text(row.description),
    localImageUrl,
    localThumbnailUrl,
    local_image_url: localImageUrl,
    local_thumbnail_url: localThumbnailUrl,
    imageUrl,
    image_url: imageUrl,
    sourceUrl,
    source_url: sourceUrl,
    tags: normalizeTagsForArtifact(row.tags),
    attributes: Array.from(groups.entries())
      .map(([group, entry]) => ({
        group,
        order: entry.order,
        items: entry.items
          .sort((a, b) => a.order - b.order)
          .map((item) => ({ name: item.name, value: item.value })),
      }))
      .sort((a, b) => a.order - b.order)
      .map(({ group, items }) => ({ group, items })),
    favsCount: 0,
  } as Artifact;
}

export async function listArtifactsFromDb(db: DbQuery, limit = 5000) {
  const safeLimit = Math.min(Math.max(Number(limit) || 5000, 1), 10000);
  const columns = await getArtifactColumns(db);
  const localImageSelect = columns.has("local_image_url") ? "a.local_image_url" : "'' as local_image_url";
  const localThumbnailSelect = columns.has("local_thumbnail_url") ? "a.local_thumbnail_url" : "'' as local_thumbnail_url";
  const sourceUrlSelect = columns.has("source_url") ? "a.source_url" : "'' as source_url";
  const rows = await db.query<ArtifactRow>(
    `select a.id, a.name, a.dynasty, a.museum_id, m.name as museum, a.category, a.short_intro,
            a.description, a.image_url, ${localImageSelect}, ${localThumbnailSelect}, ${sourceUrlSelect}, a.tags, a.created_at, a.updated_at
     from artifacts a
     join museums m on m.id = a.museum_id
     order by a.id asc
     limit $1`,
    [safeLimit],
  );
  return rows.rows.map((row) => toArtifact(row));
}

export async function getArtifactFromDb(db: DbQuery, id: string) {
  const columns = await getArtifactColumns(db);
  const localImageSelect = columns.has("local_image_url") ? "a.local_image_url" : "'' as local_image_url";
  const localThumbnailSelect = columns.has("local_thumbnail_url") ? "a.local_thumbnail_url" : "'' as local_thumbnail_url";
  const sourceUrlSelect = columns.has("source_url") ? "a.source_url" : "'' as source_url";
  const rows = await db.query<ArtifactRow>(
    `select a.id, a.name, a.dynasty, a.museum_id, m.name as museum, a.category, a.short_intro,
            a.description, a.image_url, ${localImageSelect}, ${localThumbnailSelect}, ${sourceUrlSelect}, a.tags, a.created_at, a.updated_at
     from artifacts a
     join museums m on m.id = a.museum_id
     where a.id::text = $1
     limit 1`,
    [id],
  );
  const row = rows.rows[0];
  if (!row) return null;
  const attrs = await db.query<AttributeRow>(
    `select artifact_id, attribute_group, attribute_name, attribute_value, sort_order
     from artifact_attributes
     where artifact_id = $1
     order by sort_order asc, id asc`,
    [row.id],
  );
  return toArtifact(row, attrs.rows);
}
