import type { Artifact, Museum } from "../../../src/types";
import { artifactEraRaw, artifactMaterialRaw, artifactMuseumRaw } from "../../../src/lib/dbDisplay";
import { readJsonFile, writeJsonFile } from "../../store";
import { listArtifactsFromStore, updateArtifactMuseumInStore } from "./artifactsStore";

export type MuseumStoreItem = Museum & {
  normalizedName?: string;
  aliases?: string[];
  type?: string;
  level?: string;
  grade?: string;
  province?: string;
  city?: string;
  address?: string;
  officialWebsite?: string;
  description: string;
  history?: string;
  highlights?: string;
  openingHours?: string;
  ticketInfo?: string;
  contact?: string;
  coverImageUrl?: string;
  coverThumbnailUrl?: string;
  localCoverImageUrl?: string;
  localCoverThumbnailUrl?: string;
  storageCoverImageUrl?: string;
  storageCoverThumbnailUrl?: string;
  imageSource?: string;
  source?: string;
  createdByImport?: boolean;
  isFeatured?: boolean;
  hasCover?: boolean;
  displayCoverUrl?: string;
  createdAt?: string;
};

type MuseumStoreDocument = {
  version: 1;
  updatedAt: string;
  museums: MuseumStoreItem[];
};

export type MuseumInput = Partial<MuseumStoreItem> & {
  official_website?: unknown;
  opening_hours?: unknown;
  ticket_info?: unknown;
  is_featured?: unknown;
};

const MUSEUMS_FILE = "imported-museums.json";

function nowIso() {
  return new Date().toISOString();
}

function emptyStore(): MuseumStoreDocument {
  return { version: 1, updatedAt: nowIso(), museums: [] };
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
    .replace(/^-|-$/g, "") || "museum";
}

function coverUrl(museum: Record<string, unknown>) {
  return (
    text(museum.storageCoverThumbnailUrl) ||
    text(museum.localCoverThumbnailUrl) ||
    text(museum.coverThumbnailUrl) ||
    text(museum.storageCoverImageUrl) ||
    text(museum.localCoverImageUrl) ||
    text(museum.coverImageUrl) ||
    text(museum.imageUrl)
  );
}

function normalizeMuseum(raw: Partial<MuseumStoreItem>, fallbackName = "未知博物馆"): MuseumStoreItem {
  const record = raw as Record<string, unknown>;
  const name = text(record.name) || fallbackName;
  const imageUrl = text(record.imageUrl) || coverUrl(record);
  const displayCoverUrl = coverUrl({ ...record, imageUrl });
  return {
    ...raw,
    id: text(record.id) || name || slugify(fallbackName),
    name,
    normalizedName: text(record.normalizedName) || name,
    aliases: Array.isArray(record.aliases) ? record.aliases.map(text).filter(Boolean) : [],
    type: text(record.type) || "其他",
    level: text(record.level) || "未定级",
    grade: text(record.grade) || "未定级",
    province: text(record.province),
    city: text(record.city),
    address: text(record.address),
    officialWebsite: text(record.officialWebsite ?? record.official_website),
    description: text(record.description) || `${name}馆藏文物数据库。`,
    history: text(record.history),
    highlights: text(record.highlights),
    openingHours: text(record.openingHours ?? record.opening_hours),
    ticketInfo: text(record.ticketInfo ?? record.ticket_info),
    contact: text(record.contact),
    coverImageUrl: text(record.coverImageUrl),
    coverThumbnailUrl: text(record.coverThumbnailUrl),
    localCoverImageUrl: text(record.localCoverImageUrl),
    localCoverThumbnailUrl: text(record.localCoverThumbnailUrl),
    storageCoverImageUrl: text(record.storageCoverImageUrl),
    storageCoverThumbnailUrl: text(record.storageCoverThumbnailUrl),
    imageSource: text(record.imageSource),
    source: text(record.source),
    createdByImport: Boolean(record.createdByImport),
    artifactIds: Array.isArray(record.artifactIds) ? record.artifactIds.map(text).filter(Boolean) : [],
    artifactCount: Number(record.artifactCount || 0) || 0,
    periods: Array.isArray(record.periods) ? record.periods.map(text).filter(Boolean) : [],
    materials: Array.isArray(record.materials) ? record.materials.map(text).filter(Boolean) : [],
    isFeatured: Boolean(record.isFeatured ?? record.is_featured),
    hasCover: Boolean(displayCoverUrl),
    displayCoverUrl,
    imageUrl: imageUrl || displayCoverUrl,
    location: text(record.location) || [text(record.province), text(record.city)].filter(Boolean).join(" "),
    updatedAt: text(record.updatedAt) || nowIso(),
    createdAt: text(record.createdAt),
  };
}

async function readStore() {
  const parsed = await readJsonFile<MuseumStoreDocument | MuseumStoreItem[]>(MUSEUMS_FILE, emptyStore());
  const museums = Array.isArray(parsed) ? parsed : Array.isArray(parsed.museums) ? parsed.museums : [];
  return {
    version: 1 as const,
    updatedAt: Array.isArray(parsed) ? nowIso() : parsed.updatedAt || nowIso(),
    museums: museums.map((museum) => normalizeMuseum(museum, text(museum.name) || "未知博物馆")),
  };
}

async function writeStore(museums: MuseumStoreItem[]) {
  await writeJsonFile<MuseumStoreDocument>(MUSEUMS_FILE, {
    version: 1,
    updatedAt: nowIso(),
    museums: museums.map((museum) => normalizeMuseum(museum)),
  });
}

function buildIndexFromArtifacts(artifacts: Artifact[]) {
  const byName = new Map<string, { artifactIds: string[]; periods: Set<string>; materials: Set<string>; firstImage: string }>();
  for (const artifact of artifacts) {
    const name = text(artifactMuseumRaw(artifact)) || "未知博物馆";
    const entry = byName.get(name) || { artifactIds: [], periods: new Set<string>(), materials: new Set<string>(), firstImage: "" };
    entry.artifactIds.push(String(artifact.id));
    const period = text(artifactEraRaw(artifact));
    const material = text(artifactMaterialRaw(artifact));
    if (period) entry.periods.add(period);
    if (material) entry.materials.add(material);
    if (!entry.firstImage) entry.firstImage = text(artifact.localThumbnailUrl || artifact.localImageUrl || artifact.imageUrl);
    byName.set(name, entry);
  }
  return byName;
}

function mergeMuseumArtifactIndex(museums: MuseumStoreItem[], artifacts: Artifact[]) {
  const byName = new Map<string, MuseumStoreItem>();
  for (const museum of museums) {
    byName.set(museum.name, normalizeMuseum(museum));
  }

  const index = buildIndexFromArtifacts(artifacts);
  for (const [name, entry] of index) {
    const existing = byName.get(name);
    byName.set(name, normalizeMuseum({
      ...(existing || {
        id: name,
        name,
        description: `${name}馆藏文物数据库，当前收录 ${entry.artifactIds.length} 件文物。`,
        createdByImport: true,
      }),
      artifactIds: entry.artifactIds,
      artifactCount: entry.artifactIds.length,
      periods: Array.from(entry.periods).sort(),
      materials: Array.from(entry.materials).sort(),
      imageUrl: existing?.imageUrl || entry.firstImage,
      updatedAt: existing?.updatedAt || nowIso(),
    }, name));
  }

  return Array.from(byName.values())
    .map((museum) => {
      if (index.has(museum.name)) return museum;
      return normalizeMuseum({ ...museum, artifactIds: [], artifactCount: 0, periods: [], materials: [] }, museum.name);
    })
    .sort((left, right) => (right.artifactCount || 0) - (left.artifactCount || 0) || left.name.localeCompare(right.name, "zh-CN"));
}

export async function refreshMuseumArtifactIndex() {
  const [store, artifacts] = await Promise.all([readStore(), listArtifactsFromStore(10000)]);
  const museums = mergeMuseumArtifactIndex(store.museums, artifacts);
  await writeStore(museums);
  return museums;
}

export async function listMuseumsFromStore() {
  const [store, artifacts] = await Promise.all([readStore(), listArtifactsFromStore(10000)]);
  return mergeMuseumArtifactIndex(store.museums, artifacts);
}

export async function getMuseumFromStore(idOrName: string) {
  const museums = await listMuseumsFromStore();
  return museums.find((museum) => String(museum.id) === String(idOrName) || museum.name === idOrName) || null;
}

export async function getMuseumArtifactsFromStore(idOrName: string) {
  const [museum, artifacts] = await Promise.all([getMuseumFromStore(idOrName), listArtifactsFromStore(10000)]);
  if (!museum) return { museum: null, artifacts: [] as Artifact[] };
  const idSet = new Set(museum.artifactIds.map(String));
  return {
    museum,
    artifacts: artifacts.filter((artifact) => idSet.has(String(artifact.id)) || text(artifactMuseumRaw(artifact)) === museum.name),
  };
}

export async function updateMuseumInStore(idOrName: string, input: MuseumInput) {
  const store = await readStore();
  const index = store.museums.findIndex((museum) => String(museum.id) === String(idOrName) || museum.name === idOrName);
  if (index < 0) return null;
  const existing = normalizeMuseum(store.museums[index]);
  const name = text(input.name) || existing.name;
  const updated = normalizeMuseum({
    ...existing,
    ...input,
    id: existing.id,
    name,
    officialWebsite: text(input.officialWebsite ?? input.official_website) || existing.officialWebsite,
    openingHours: text(input.openingHours ?? input.opening_hours) || existing.openingHours,
    ticketInfo: text(input.ticketInfo ?? input.ticket_info) || existing.ticketInfo,
    isFeatured: Boolean(input.isFeatured ?? input.is_featured),
    updatedAt: nowIso(),
  }, name);
  store.museums[index] = updated;
  await writeStore(store.museums);
  if (name !== existing.name) {
    await updateArtifactMuseumInStore(existing.name, name);
  }
  await refreshMuseumArtifactIndex();
  return getMuseumFromStore(updated.id);
}

export async function upsertMuseumCoverInStore(
  idOrName: string,
  localCoverImageUrl: string,
  localCoverThumbnailUrl: string,
  imageSource: string,
) {
  const museum = await getMuseumFromStore(idOrName);
  if (!museum) return null;
  return updateMuseumInStore(idOrName, {
    ...museum,
    localCoverImageUrl,
    localCoverThumbnailUrl,
    coverImageUrl: localCoverImageUrl,
    coverThumbnailUrl: localCoverThumbnailUrl,
    imageUrl: localCoverThumbnailUrl || localCoverImageUrl,
    imageSource,
    updatedAt: nowIso(),
  });
}

export async function deleteMuseumCoverFromStore(idOrName: string) {
  const museum = await getMuseumFromStore(idOrName);
  if (!museum) return null;
  return updateMuseumInStore(idOrName, {
    ...museum,
    localCoverImageUrl: "",
    localCoverThumbnailUrl: "",
    coverImageUrl: "",
    coverThumbnailUrl: "",
    storageCoverImageUrl: "",
    storageCoverThumbnailUrl: "",
    imageUrl: "",
    imageSource: "",
    updatedAt: nowIso(),
  });
}

export async function addMuseumAliasInStore(idOrName: string, alias: string) {
  const museum = await getMuseumFromStore(idOrName);
  if (!museum) return null;
  const aliases = Array.from(new Set([...(museum.aliases || []), text(alias)].filter(Boolean)));
  return updateMuseumInStore(idOrName, { ...museum, aliases });
}

export async function deleteMuseumAliasInStore(idOrName: string, aliasOrIndex: string) {
  const museum = await getMuseumFromStore(idOrName);
  if (!museum) return null;
  const aliases = (museum.aliases || []).filter((alias, index) => alias !== aliasOrIndex && String(index) !== aliasOrIndex);
  return updateMuseumInStore(idOrName, { ...museum, aliases });
}
