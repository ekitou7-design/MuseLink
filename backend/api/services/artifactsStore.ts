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
import { readJsonFile, writeJsonFile } from "../../store";

type ArtifactStoreDocument = {
  version: 1;
  updatedAt: string;
  artifacts: Artifact[];
};

export type ArtifactInput = {
  id?: string;
  name?: unknown;
  museum?: unknown;
  museumName?: unknown;
  dynasty?: unknown;
  period?: unknown;
  category?: unknown;
  shortIntro?: unknown;
  short_intro?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  image_url?: unknown;
  sourceUrl?: unknown;
  source_url?: unknown;
  tags?: unknown;
  attributes?: unknown;
  material?: unknown;
  dimensions?: unknown;
  level?: unknown;
  remarks?: unknown;
  isEditorRecommended?: unknown;
  is_editor_recommended?: unknown;
  editorRecommendationOrder?: unknown;
  editor_recommendation_order?: unknown;
};

const ARTIFACTS_FILE = "imported-artifacts.json";

function nowIso() {
  return new Date().toISOString();
}

function emptyStore(): ArtifactStoreDocument {
  return { version: 1, updatedAt: nowIso(), artifacts: [] };
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  const normalized = String(value).trim();
  if (!normalized || /^(undefined|null|nan)$/i.test(normalized)) return "";
  return normalized;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_一-龥]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "artifact";
}

function firstText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(record[key]);
    if (value) return value;
  }
  return "";
}

function normalizeTags(tags: unknown): ArtifactTag[] {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => {
        if (tag && typeof tag === "object" && !Array.isArray(tag)) {
          const record = tag as Record<string, unknown>;
          const name = text(record.name);
          return name ? { type: text(record.type) || "文化标签", name } : "";
        }
        return text(tag);
      })
      .filter(Boolean) as ArtifactTag[];
  }

  if (typeof tags === "string") {
    return tags.split(/[,，、\n]/).map(text).filter(Boolean);
  }

  return [];
}

function attributeValue(attributes: unknown, name: string) {
  if (!Array.isArray(attributes)) return "";
  for (const group of attributes) {
    if (!group || typeof group !== "object" || Array.isArray(group)) continue;
    const items = (group as { items?: unknown }).items;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      if (text(record.name) === name) return text(record.value);
    }
  }
  return "";
}

function normalizeAttributes(attributes: unknown): ArtifactAttributeGroup[] {
  if (!Array.isArray(attributes)) return [];
  return attributes
    .map((group) => {
      if (!group || typeof group !== "object" || Array.isArray(group)) return null;
      const record = group as Record<string, unknown>;
      const items = Array.isArray(record.items) ? record.items : [];
      return {
        group: text(record.group) || "基础信息",
        items: items
          .map((item) => {
            const itemRecord = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
            return { name: text(itemRecord.name), value: text(itemRecord.value) };
          })
          .filter((item) => item.name && item.value),
      };
    })
    .filter((group): group is ArtifactAttributeGroup => Boolean(group && group.items.length > 0));
}

function ensureAttribute(attributes: ArtifactAttributeGroup[], groupName: string, name: string, value: string) {
  if (!value) return;
  let group = attributes.find((item) => item.group === groupName);
  if (!group) {
    group = { group: groupName, items: [] };
    attributes.push(group);
  }
  const existing = group.items.find((item) => item.name === name);
  if (existing) {
    existing.value = value;
  } else {
    group.items.push({ name, value });
  }
}

function normalizeArtifact(raw: Artifact, fallbackIndex = 0): Artifact {
  const record = raw as Artifact & Record<string, unknown>;
  const name = text(artifactNameRaw(record)) || `未命名文物${fallbackIndex ? ` ${fallbackIndex}` : ""}`;
  const museum = text(artifactMuseumRaw(record)) || "未归类博物馆";
  const period = text(artifactEraRaw(record)) || "暂无信息";
  const imageUrl = text(record.imageUrl ?? record.image_url ?? record["图片链接"] ?? "");
  const localImageUrl = text(record.localImageUrl ?? record.local_image_url ?? "");
  const localThumbnailUrl = text(record.localThumbnailUrl ?? record.local_thumbnail_url ?? "");
  const externalImageUrl = text(record.externalImageUrl ?? record.external_image_url ?? "");
  const sourceUrl = text(record.sourceUrl ?? record.source_url ?? "");
  const attributes = normalizeAttributes(record.attributes);
  const material = text(artifactMaterialRaw(record)) || attributeValue(attributes, "材质");
  const dimensions = text(artifactDimensionsRaw(record)) || attributeValue(attributes, "尺寸");
  const level = text(artifactLevelRaw(record)) || attributeValue(attributes, "等级");
  const remarks = text(artifactRemarksRaw(record)) || attributeValue(attributes, "备注");
  ensureAttribute(attributes, "基础信息", "材质", material);
  ensureAttribute(attributes, "基础信息", "尺寸", dimensions);
  ensureAttribute(attributes, "基础信息", "等级", level);
  ensureAttribute(attributes, "其他信息", "备注", remarks);

  return {
    ...record,
    id: text(record.id) || `${slugify(name)}-${Date.now().toString(36)}-${fallbackIndex}`,
    name,
    "文物名称": name,
    museum,
    museumName: museum,
    "所属博物馆": museum,
    period,
    dynasty: period,
    "朝代": period,
    material,
    "材质": material,
    culture: text(record.culture ?? record["文化"]) || "中华文化",
    origin: text(artifactOriginRaw(record)),
    description: text(artifactDescriptionRaw(record)),
    imageUrl,
    image_url: imageUrl,
    "图片链接": imageUrl,
    localImageUrl,
    localThumbnailUrl,
    local_image_url: localImageUrl,
    local_thumbnail_url: localThumbnailUrl,
    externalImageUrl: externalImageUrl || (imageUrl && !imageUrl.startsWith("/") ? imageUrl : ""),
    sourceUrl,
    source_url: sourceUrl,
    shortIntro: text(record.shortIntro ?? record.short_intro),
    category: text(artifactCategoryRaw(record)),
    "类别": text(artifactCategoryRaw(record)),
    level,
    "等级": level,
    dimensions,
    "尺寸": dimensions,
    remarks,
    "备注": remarks,
    tags: normalizeTags(record.tags),
    attributes,
    favsCount: Number(record.favsCount || 0) || 0,
    isEditorRecommended: Boolean(record.isEditorRecommended ?? record.is_editor_recommended),
    is_editor_recommended: Boolean(record.isEditorRecommended ?? record.is_editor_recommended),
    editorRecommendationOrder: Number(record.editorRecommendationOrder ?? record.editor_recommendation_order ?? 0) || 0,
    editor_recommendation_order: Number(record.editorRecommendationOrder ?? record.editor_recommendation_order ?? 0) || 0,
  } as Artifact;
}

async function readStore() {
  const parsed = await readJsonFile<ArtifactStoreDocument | Artifact[]>(ARTIFACTS_FILE, emptyStore());
  const artifacts = Array.isArray(parsed) ? parsed : Array.isArray(parsed.artifacts) ? parsed.artifacts : [];
  return {
    version: 1 as const,
    updatedAt: Array.isArray(parsed) ? nowIso() : parsed.updatedAt || nowIso(),
    artifacts: artifacts.map((artifact, index) => normalizeArtifact(artifact, index + 1)),
  };
}

async function writeStore(artifacts: Artifact[]) {
  await writeJsonFile<ArtifactStoreDocument>(ARTIFACTS_FILE, {
    version: 1,
    updatedAt: nowIso(),
    artifacts: artifacts.map((artifact, index) => normalizeArtifact(artifact, index + 1)),
  });
}

export async function listArtifactsFromStore(limit = 10000) {
  const store = await readStore();
  const safeLimit = Math.min(Math.max(Number(limit) || 10000, 1), 10000);
  return store.artifacts.slice(0, safeLimit);
}

export async function getArtifactFromStore(id: string) {
  const artifacts = await listArtifactsFromStore();
  return artifacts.find((artifact) => String(artifact.id) === String(id)) || null;
}

export async function searchArtifactsInStore(keyword: string, limit = 100) {
  const q = text(keyword).toLowerCase();
  const artifacts = await listArtifactsFromStore(10000);
  if (!q) return [];
  return artifacts
    .map((artifact) => {
      const haystack = [
        artifact.id,
        artifact.name,
        artifact.museum,
        artifact.museumName,
        artifact.period,
        artifact.dynasty,
        artifact.category,
        artifact.material,
        artifact.description,
        artifact.shortIntro,
        ...(artifact.tags || []).map((tag) => typeof tag === "string" ? tag : tag.name),
      ].map(text).join(" ").toLowerCase();
      return { artifact, score: haystack.includes(q) ? 1 : 0 };
    })
    .filter((item) => item.score > 0)
    .slice(0, Math.min(Math.max(Number(limit) || 100, 1), 500))
    .map((item) => item.artifact);
}

export async function upsertArtifactInStore(input: ArtifactInput) {
  const store = await readStore();
  const id = text(input.id);
  const index = id ? store.artifacts.findIndex((artifact) => String(artifact.id) === id) : -1;
  const existing = index >= 0 ? store.artifacts[index] : undefined;
  const record = { ...(existing || {}), ...(input as Record<string, unknown>) };
  const payload = input as Record<string, unknown>;
  const attributes = normalizeAttributes(payload.attributes ?? existing?.attributes);
  const material = firstText(payload, ["material", "材质"]) || attributeValue(attributes, "材质") || existing?.material || "";
  const dimensions = firstText(payload, ["dimensions", "size", "尺寸"]) || attributeValue(attributes, "尺寸") || existing?.dimensions || "";
  const level = firstText(payload, ["level", "等级"]) || attributeValue(attributes, "等级") || existing?.level || "";
  const remarks = firstText(payload, ["remarks", "remark", "note", "备注"]) || attributeValue(attributes, "备注") || existing?.remarks || "";
  ensureAttribute(attributes, "基础信息", "材质", material);
  ensureAttribute(attributes, "基础信息", "尺寸", dimensions);
  ensureAttribute(attributes, "基础信息", "等级", level);
  ensureAttribute(attributes, "其他信息", "备注", remarks);

  const name = firstText(record, ["name", "名称", "文物名称"]) || existing?.name || "";
  const museum = firstText(record, ["museum", "museumName", "所属博物馆", "博物馆"]) || existing?.museum || "未归类博物馆";
  const period = firstText(record, ["dynasty", "period", "era", "朝代", "时代", "年代"]) || existing?.period || "暂无信息";
  const imageUrl = firstText(record, ["imageUrl", "image_url", "图片链接", "图片"]) || existing?.imageUrl || "";
  const sourceUrl = firstText(record, ["sourceUrl", "source_url", "来源链接"]) || existing?.sourceUrl || "";
  const tags = payload.tags === undefined ? existing?.tags || [] : normalizeTags(payload.tags);
  const editorOrder = Number(record.editorRecommendationOrder ?? record.editor_recommendation_order ?? 0) || 0;
  const artifact = normalizeArtifact({
    ...(record as Artifact),
    id: id || existing?.id || `${slugify(name || "artifact")}-${Date.now().toString(36)}`,
    name,
    "文物名称": name,
    museum,
    museumName: museum,
    "所属博物馆": museum,
    period,
    dynasty: period,
    "朝代": period,
    category: firstText(record, ["category", "类别", "类型"]) || existing?.category || "",
    shortIntro: firstText(record, ["shortIntro", "short_intro", "一句话简介", "简介"]) || existing?.shortIntro || "",
    description: firstText(record, ["description", "desc", "介绍", "描述"]) || existing?.description || "",
    imageUrl,
    image_url: imageUrl,
    "图片链接": imageUrl,
    sourceUrl,
    source_url: sourceUrl,
    material,
    dimensions,
    level,
    remarks,
    tags,
    attributes,
    isEditorRecommended: Boolean(record.isEditorRecommended ?? record.is_editor_recommended),
    is_editor_recommended: Boolean(record.isEditorRecommended ?? record.is_editor_recommended),
    editorRecommendationOrder: editorOrder,
    editor_recommendation_order: editorOrder,
  } as Artifact);

  if (index >= 0) {
    store.artifacts[index] = artifact;
  } else {
    store.artifacts.push(artifact);
  }
  await writeStore(store.artifacts);
  return artifact;
}

export async function patchArtifactInStore(id: string, patch: Record<string, unknown>) {
  const existing = await getArtifactFromStore(id);
  if (!existing) return null;
  return upsertArtifactInStore({ ...existing, ...patch, id });
}

export async function updateArtifactMuseumInStore(oldMuseumName: string, newMuseumName: string) {
  const store = await readStore();
  let changed = false;
  const artifacts = store.artifacts.map((artifact) => {
    if (artifact.museum !== oldMuseumName && artifact.museumName !== oldMuseumName) return artifact;
    changed = true;
    return normalizeArtifact({
      ...artifact,
      museum: newMuseumName,
      museumName: newMuseumName,
      "所属博物馆": newMuseumName,
    } as Artifact);
  });
  if (changed) await writeStore(artifacts);
  return changed;
}

export async function deleteArtifactFromStore(id: string) {
  const store = await readStore();
  const next = store.artifacts.filter((artifact) => String(artifact.id) !== String(id));
  if (next.length === store.artifacts.length) return false;
  await writeStore(next);
  return true;
}

