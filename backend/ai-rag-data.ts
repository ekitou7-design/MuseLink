import fs from "fs/promises";
import path from "path";
import type { Artifact, ArtifactTag } from "../src/types";
import {
  artifactCategoryRaw,
  artifactDescriptionRaw,
  artifactDimensionsRaw,
  artifactEraRaw,
  artifactImageUrlRaw,
  artifactMaterialRaw,
  artifactMuseumRaw,
  artifactNameRaw,
} from "../src/lib/dbDisplay";

export type AiReadyArtifact = {
  id: string;
  title: string;
  name: string;
  dynasty: string;
  period: string;
  museum: string;
  category: string;
  material: string;
  dimensions: string;
  description: string;
  historicalContext: string;
  culturalSignificance: string;
  tags: string[];
  imageUrl: string;
  localImageUrl: string;
  searchableText: string;
  updatedAt: string;
};

export type RagDocument = {
  id: string;
  artifactId: string;
  title: string;
  content: string;
  metadata: {
    dynasty: string;
    period: string;
    category: string;
    material: string;
    museum: string;
    tags: string[];
    imageUrl: string;
    localImageUrl: string;
  };
  updatedAt: string;
};

export type ArtifactRelation = {
  sourceArtifactId: string;
  targetArtifactId: string;
  relationType: string;
  relationReason: string;
  confidence: number;
  updatedAt: string;
};

export type AiRagSyncSummary = {
  ok: boolean;
  artifactCount: number;
  aiReadyCount: number;
  ragDocumentCount: number;
  relationCount: number;
  coverage: string;
  message: string;
  error?: string;
};

type JsonDoc<T> = {
  version: 1;
  updatedAt: string;
  source: string;
  items?: T[];
  artifacts?: T[];
  documents?: T[];
  relations?: T[];
};

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const RAG_DIR = path.join(DATA_DIR, "rag");
const AI_READY_PATH = path.join(DATA_DIR, "ai-ready-artifacts.json");
const RAG_DOCS_PATH = path.join(DATA_DIR, "rag-documents.json");
const RELATIONS_PATH = path.join(DATA_DIR, "artifact-relations.json");
const LEGACY_AI_READY_PATH = path.join(DATA_DIR, "imported-artifacts.ai-ready.v2.json");
const LEGACY_RAG_JSONL_PATH = path.join(RAG_DIR, "artifacts-rag-documents.v2.jsonl");
const LEGACY_RELATIONS_PATH = path.join(DATA_DIR, "artifact-relation-seeds.v2.json");
const IMPORTED_ARTIFACTS_PATH = path.join(DATA_DIR, "imported-artifacts.json");

const UNKNOWN = "暂无信息";
const MAX_RELATIONS_PER_ARTIFACT = 5;

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    const normalized = value.trim();
    return /^(undefined|null|nan)$/i.test(normalized) ? "" : normalized;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join(" / ");
  return "";
}

function valueOrUnknown(value: unknown) {
  return cleanText(value) || UNKNOWN;
}

function tagName(tag: ArtifactTag | unknown): string {
  if (typeof tag === "string") return cleanText(tag);
  if (tag && typeof tag === "object" && !Array.isArray(tag)) {
    const record = tag as Record<string, unknown>;
    return cleanText(record.name) || cleanText(record.type);
  }
  return cleanText(tag);
}

function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return Array.from(new Set(tags.map(tagName).filter(Boolean)));
  if (typeof tags === "string") {
    return Array.from(new Set(tags.split(/[,，、;；\n]/).map(cleanText).filter(Boolean)));
  }
  return [];
}

function firstRecordText(artifact: unknown, keys: string[]) {
  if (!artifact || typeof artifact !== "object") return "";
  const record = artifact as Record<string, unknown>;
  for (const key of keys) {
    const value = cleanText(record[key]);
    if (value) return value;
  }
  return "";
}

function localImageUrl(artifact: Artifact) {
  return firstRecordText(artifact, ["localImageUrl", "local_image_url", "localThumbnailUrl", "local_thumbnail_url"]);
}

function getArtifactId(artifact: Artifact) {
  return cleanText((artifact as unknown as Record<string, unknown>).id);
}

function compactArtifact(artifact: Artifact) {
  const name = valueOrUnknown(artifactNameRaw(artifact));
  const period = valueOrUnknown(artifactEraRaw(artifact));
  const museum = valueOrUnknown(artifactMuseumRaw(artifact));
  const category = valueOrUnknown(artifactCategoryRaw(artifact));
  const material = valueOrUnknown(artifactMaterialRaw(artifact));
  const dimensions = valueOrUnknown(artifactDimensionsRaw(artifact));
  const description = valueOrUnknown(artifactDescriptionRaw(artifact));
  const tags = normalizeTags(artifact.tags);
  const imageUrl = cleanText(artifactImageUrlRaw(artifact));
  const local = localImageUrl(artifact);

  return {
    id: getArtifactId(artifact),
    name,
    period,
    dynasty: period,
    museum,
    category,
    material,
    dimensions,
    description,
    tags,
    imageUrl,
    localImageUrl: local,
  };
}

function uniqueText(values: unknown[]) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean))).join("\n");
}

function buildHistoricalContext(compact: ReturnType<typeof compactArtifact>) {
  const pieces = [
    compact.period !== UNKNOWN ? `${compact.name} 的时代字段记录为 ${compact.period}` : "",
    compact.museum !== UNKNOWN ? `馆藏机构为 ${compact.museum}` : "",
    compact.category !== UNKNOWN ? `类别为 ${compact.category}` : "",
  ].filter(Boolean);
  return pieces.length ? `${pieces.join("，")}。` : `${compact.name} 的历史背景仍需结合权威资料补充。`;
}

function buildCulturalSignificance(compact: ReturnType<typeof compactArtifact>) {
  const tags = compact.tags.length ? `，相关标签包括 ${compact.tags.join("、")}` : "";
  const material = compact.material !== UNKNOWN ? `材质为 ${compact.material}` : "材质信息待补充";
  return `${compact.name} 可作为 ${compact.category} 相关策展与检索材料，${material}${tags}。`;
}

export function generateAiReadyArtifact(artifact: Artifact): AiReadyArtifact {
  const now = new Date().toISOString();
  const compact = compactArtifact(artifact);
  const historicalContext = firstRecordText(artifact, ["historicalContext", "historical_context"]) || buildHistoricalContext(compact);
  const culturalSignificance =
    firstRecordText(artifact, ["culturalSignificance", "cultural_significance", "curatorNote", "workflowSummary"]) ||
    buildCulturalSignificance(compact);
  const searchableText = uniqueText([
    compact.name,
    compact.period,
    compact.dynasty,
    compact.category,
    compact.material,
    compact.dimensions,
    compact.museum,
    compact.description,
    historicalContext,
    culturalSignificance,
    compact.tags.join(" "),
  ]);

  return {
    id: compact.id,
    title: compact.name,
    name: compact.name,
    dynasty: compact.dynasty,
    period: compact.period,
    museum: compact.museum,
    category: compact.category,
    material: compact.material,
    dimensions: compact.dimensions,
    description: compact.description,
    historicalContext,
    culturalSignificance,
    tags: compact.tags,
    imageUrl: compact.imageUrl,
    localImageUrl: compact.localImageUrl,
    searchableText,
    updatedAt: now,
  };
}

export function generateRagDocument(artifact: Artifact): RagDocument {
  const ai = generateAiReadyArtifact(artifact);
  const content = [
    `文物名称：${ai.name}`,
    `时代/朝代：${ai.period}`,
    `馆藏机构：${ai.museum}`,
    `类别：${ai.category}`,
    `材质：${ai.material}`,
    `尺寸：${ai.dimensions}`,
    `简介：${ai.description}`,
    `历史背景：${ai.historicalContext}`,
    `文化意义：${ai.culturalSignificance}`,
    `标签：${ai.tags.join("、") || UNKNOWN}`,
  ].join("\n");

  return {
    id: `rag-${ai.id}`,
    artifactId: ai.id,
    title: ai.title,
    content,
    metadata: {
      dynasty: ai.dynasty,
      period: ai.period,
      category: ai.category,
      material: ai.material,
      museum: ai.museum,
      tags: ai.tags,
      imageUrl: ai.imageUrl,
      localImageUrl: ai.localImageUrl,
    },
    updatedAt: ai.updatedAt,
  };
}

async function ensureDataDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(RAG_DIR, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, value: unknown) {
  await ensureDataDirs();
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function docItems<T>(doc: unknown, key: "artifacts" | "documents" | "relations"): T[] {
  if (Array.isArray(doc)) return doc as T[];
  if (doc && typeof doc === "object") {
    const record = doc as Record<string, unknown>;
    const values = record[key] || record.items;
    if (Array.isArray(values)) return values as T[];
  }
  return [];
}

async function readAiReadyArtifacts() {
  return docItems<AiReadyArtifact>(await readJson<unknown>(AI_READY_PATH, { artifacts: [] }), "artifacts");
}

async function readRagDocuments() {
  return docItems<RagDocument>(await readJson<unknown>(RAG_DOCS_PATH, { documents: [] }), "documents");
}

export async function readArtifactRelations() {
  return docItems<ArtifactRelation>(await readJson<unknown>(RELATIONS_PATH, { relations: [] }), "relations");
}

export async function readImportedArtifactsForAiRag(): Promise<Artifact[]> {
  const doc = await readJson<unknown>(IMPORTED_ARTIFACTS_PATH, { artifacts: [] });
  return docItems<Artifact>(doc, "artifacts").filter((artifact) => getArtifactId(artifact));
}

async function writeAiReadyArtifacts(artifacts: AiReadyArtifact[], source = "artifacts") {
  const now = new Date().toISOString();
  const doc: JsonDoc<AiReadyArtifact> = { version: 1, updatedAt: now, source, artifacts };
  await writeJson(AI_READY_PATH, doc);
  await writeJson(LEGACY_AI_READY_PATH, doc);
}

async function writeRagDocuments(documents: RagDocument[], source = "artifacts") {
  const now = new Date().toISOString();
  const doc: JsonDoc<RagDocument> = { version: 1, updatedAt: now, source, documents };
  await writeJson(RAG_DOCS_PATH, doc);
  await fs.writeFile(LEGACY_RAG_JSONL_PATH, `${documents.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf-8");
}

async function writeArtifactRelations(relations: ArtifactRelation[], source = "artifacts") {
  const now = new Date().toISOString();
  const doc: JsonDoc<ArtifactRelation> = { version: 1, updatedAt: now, source, relations };
  await writeJson(RELATIONS_PATH, doc);
  await writeJson(LEGACY_RELATIONS_PATH, relations);
}

function relationSeeds(artifact: Artifact) {
  const compact = compactArtifact(artifact);
  const seeds: Array<{ type: string; value: string; reason: string; confidence: number }> = [];
  const add = (type: string, value: string, reason: string, confidence: number) => {
    if (value && value !== UNKNOWN) seeds.push({ type, value, reason, confidence });
  };

  add("同馆藏", compact.museum, `同属馆藏：${compact.museum}`, 0.55);
  add("同时代", compact.period, `共享时代：${compact.period}`, 0.76);
  add("同类别", compact.category, `类别同为：${compact.category}`, 0.72);
  compact.material.split(/[、,，/]/).map(cleanText).filter(Boolean).forEach((value) => {
    add("同材质", value, `共享材质：${value}`, 0.7);
  });
  compact.tags.forEach((value) => add("同标签", value, `共享标签：${value}`, 0.68));
  return seeds;
}

function buildPairRelations(source: Artifact, target: Artifact): ArtifactRelation[] {
  const sourceSeeds = relationSeeds(source);
  const targetSeeds = relationSeeds(target);
  const targetKeys = new Map(targetSeeds.map((seed) => [`${seed.type}::${seed.value}`, seed]));
  const relations: ArtifactRelation[] = [];
  const now = new Date().toISOString();

  for (const seed of sourceSeeds) {
    const match = targetKeys.get(`${seed.type}::${seed.value}`);
    if (!match) continue;
    relations.push({
      sourceArtifactId: getArtifactId(source),
      targetArtifactId: getArtifactId(target),
      relationType: seed.type,
      relationReason: seed.reason,
      confidence: Math.min(seed.confidence, match.confidence),
      updatedAt: now,
    });
  }
  return relations;
}

function relationSort(a: ArtifactRelation, b: ArtifactRelation) {
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  if (a.sourceArtifactId !== b.sourceArtifactId) return a.sourceArtifactId.localeCompare(b.sourceArtifactId, "zh-CN");
  if (a.targetArtifactId !== b.targetArtifactId) return a.targetArtifactId.localeCompare(b.targetArtifactId, "zh-CN");
  return a.relationType.localeCompare(b.relationType, "zh-CN");
}

function buildAllRelations(artifacts: Artifact[]) {
  const relations: ArtifactRelation[] = [];
  for (let i = 0; i < artifacts.length; i += 1) {
    for (let j = i + 1; j < artifacts.length; j += 1) {
      relations.push(...buildPairRelations(artifacts[i], artifacts[j]));
    }
  }
  return limitRelations(relations);
}

function limitRelations(relations: ArtifactRelation[]) {
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  const selected: ArtifactRelation[] = [];
  for (const relation of [...relations].sort(relationSort)) {
    const pair = [relation.sourceArtifactId, relation.targetArtifactId].sort().join("::");
    const key = `${pair}::${relation.relationType}`;
    if (seen.has(key)) continue;
    if ((counts.get(relation.sourceArtifactId) || 0) >= MAX_RELATIONS_PER_ARTIFACT) continue;
    if ((counts.get(relation.targetArtifactId) || 0) >= MAX_RELATIONS_PER_ARTIFACT) continue;
    seen.add(key);
    selected.push(relation);
    counts.set(relation.sourceArtifactId, (counts.get(relation.sourceArtifactId) || 0) + 1);
    counts.set(relation.targetArtifactId, (counts.get(relation.targetArtifactId) || 0) + 1);
  }
  return selected;
}

export async function updateArtifactRelationsForArtifact(artifact: Artifact, allArtifacts: Artifact[]) {
  const artifactId = getArtifactId(artifact);
  const existing = await readArtifactRelations();
  const untouched = existing.filter((relation) => relation.sourceArtifactId !== artifactId && relation.targetArtifactId !== artifactId);
  const fresh = allArtifacts
    .filter((candidate) => getArtifactId(candidate) && getArtifactId(candidate) !== artifactId)
    .flatMap((candidate) => buildPairRelations(artifact, candidate));
  const relations = limitRelations([...untouched, ...fresh]);
  await writeArtifactRelations(relations, "incremental-artifact-update");
  return relations;
}

function summary(artifactCount: number, aiReadyCount: number, ragDocumentCount: number, relationCount: number): AiRagSyncSummary {
  return {
    ok: artifactCount === aiReadyCount && artifactCount === ragDocumentCount,
    artifactCount,
    aiReadyCount,
    ragDocumentCount,
    relationCount,
    coverage: `${Math.min(aiReadyCount, ragDocumentCount)} / ${artifactCount}`,
    message: `文物已入库；AI/RAG 文档已生成；关系候选已更新；当前 AI/RAG 覆盖率：${Math.min(aiReadyCount, ragDocumentCount)} / ${artifactCount}`,
  };
}

export async function syncAiRagForArtifact(artifact: Artifact, allArtifacts: Artifact[]) {
  const artifactId = getArtifactId(artifact);
  if (!artifactId) throw new Error("artifact.id is required for AI/RAG sync.");

  const aiReady = await readAiReadyArtifacts();
  const ragDocs = await readRagDocuments();
  const nextAiReady = [...aiReady.filter((item) => item.id !== artifactId), generateAiReadyArtifact(artifact)].sort((a, b) => a.id.localeCompare(b.id, "zh-CN"));
  const nextRagDocs = [...ragDocs.filter((item) => item.artifactId !== artifactId), generateRagDocument(artifact)].sort((a, b) => a.artifactId.localeCompare(b.artifactId, "zh-CN"));
  await writeAiReadyArtifacts(nextAiReady, "incremental-artifact-update");
  await writeRagDocuments(nextRagDocs, "incremental-artifact-update");
  const relations = await updateArtifactRelationsForArtifact(artifact, allArtifacts);
  return summary(allArtifacts.length, nextAiReady.length, nextRagDocs.length, relations.length);
}

export async function syncAiRagForArtifacts(artifacts: Artifact[]) {
  const cleanArtifacts = artifacts.filter((artifact) => getArtifactId(artifact));
  const aiReady = cleanArtifacts.map(generateAiReadyArtifact).sort((a, b) => a.id.localeCompare(b.id, "zh-CN"));
  const ragDocs = cleanArtifacts.map(generateRagDocument).sort((a, b) => a.artifactId.localeCompare(b.artifactId, "zh-CN"));
  const relations = buildAllRelations(cleanArtifacts);
  await writeAiReadyArtifacts(aiReady, "full-artifacts-sync");
  await writeRagDocuments(ragDocs, "full-artifacts-sync");
  await writeArtifactRelations(relations, "full-artifacts-sync");
  return summary(cleanArtifacts.length, aiReady.length, ragDocs.length, relations.length);
}

export async function deleteAiRagForArtifact(artifactId: string, remainingArtifacts: Artifact[]) {
  const aiReady = (await readAiReadyArtifacts()).filter((item) => item.id !== artifactId);
  const ragDocs = (await readRagDocuments()).filter((item) => item.artifactId !== artifactId);
  const relations = (await readArtifactRelations()).filter((item) => item.sourceArtifactId !== artifactId && item.targetArtifactId !== artifactId);
  await writeAiReadyArtifacts(aiReady, "incremental-artifact-delete");
  await writeRagDocuments(ragDocs, "incremental-artifact-delete");
  await writeArtifactRelations(relations, "incremental-artifact-delete");
  return summary(remainingArtifacts.length, aiReady.length, ragDocs.length, relations.length);
}

export async function checkAiRagData(artifacts?: Artifact[]) {
  const sourceArtifacts = artifacts || await readImportedArtifactsForAiRag();
  const artifactIds = new Set(sourceArtifacts.map(getArtifactId).filter(Boolean));
  const aiReady = await readAiReadyArtifacts();
  const ragDocs = await readRagDocuments();
  const relations = await readArtifactRelations();
  const aiIds = new Set(aiReady.map((item) => item.id));
  const ragIds = new Set(ragDocs.map((item) => item.artifactId));

  return {
    artifactCount: artifactIds.size,
    aiReadyCount: aiReady.length,
    ragDocumentCount: ragDocs.length,
    missingAiArtifactIds: Array.from(artifactIds).filter((id) => !aiIds.has(id)),
    missingRagArtifactIds: Array.from(artifactIds).filter((id) => !ragIds.has(id)),
    orphanRagArtifactIds: Array.from(ragIds).filter((id) => !artifactIds.has(id)),
    relationCount: relations.length,
  };
}
