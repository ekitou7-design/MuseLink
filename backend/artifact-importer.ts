import fs from "fs/promises";
import path from "path";
import type { Artifact } from "../src/types";
import { syncAiRagForArtifacts, type AiRagSyncSummary } from "./ai-rag-data";
import { syncMuseumStoreFromArtifacts } from "./museums";

export type ArtifactImportFormat = "json" | "ndjson" | "csv";
export type ArtifactImportMode = "append" | "replace-museum" | "replace-all";
export type ArtifactPersistTarget = "file";
export type ArtifactFieldSelector = string | string[];

export type ArtifactImportJob = {
  sourceName?: string;
  sourceType?: "file" | "inline";
  inputPath?: string;
  format?: ArtifactImportFormat;
  listPath?: string;
  records?: Record<string, unknown>[];
  mapping?: Partial<Record<keyof Artifact, ArtifactFieldSelector>>;
  defaults?: Partial<Artifact>;
  mode?: ArtifactImportMode;
  persistTo?: ArtifactPersistTarget[];
};

export type ArtifactImportSkippedRecord = {
  index: number;
  reason: string;
};

export type ArtifactImportPreview = {
  sourceName: string;
  totalRecords: number;
  validRecords: number;
  skippedRecords: number;
  museums: string[];
  preview: Artifact[];
  artifacts: Artifact[];
  skipped: ArtifactImportSkippedRecord[];
};

export type ArtifactImportExecutionResult = ArtifactImportPreview & {
  persistedTo: ArtifactPersistTarget[];
  fileStoreCount: number;
  aiRagSync?: AiRagSyncSummary;
};

type ArtifactStoreDocument = {
  version: 1;
  updatedAt: string;
  artifacts: Artifact[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "imported-artifacts.json");

const AUTO_FIELD_ALIASES: Partial<Record<keyof Artifact, string[]>> = {
  id: ["id", "_id", "编号", "文物编号", "藏品编号", "登记号", "入藏号", "索引号", "identifier", "objectid", "accessionNumber"],
  name: ["name", "title", "名称", "文物名称", "藏品名称", "题名", "标题", "器物名称", "objectName"],
  museum: [
    "museum",
    "museumName",
    "博物馆",
    "所属博物馆",
    "所在博物馆",
    "馆名",
    "馆藏单位",
    "收藏单位",
    "现藏",
    "现藏地",
    "现藏单位",
    "藏于",
    "collection",
    "institution",
    "repository",
    "currentLocation",
  ],
  period: ["period", "era", "dynasty", "date", "年代", "时代", "朝代", "时期", "年款", "断代"],
  material: ["material", "materials", "medium", "材质", "质地", "材料"],
  culture: ["culture", "文化", "文化类型", "分类", "主题"],
  origin: ["origin", "provenance", "findspot", "place", "出土地", "发现地", "来源", "产地", "遗址", "地点"],
  shortIntro: ["shortIntro", "short_intro", "summary", "一句话简介", "短简介", "摘要"],
  description: ["description", "summary", "intro", "简介", "介绍", "说明", "描述", "文物简介", "藏品介绍", "备注", "details"],
  imageUrl: ["imageUrl", "image", "image_url", "img", "图片", "图像", "图片URL", "图片链接", "照片", "url", "thumbnail"],
  sourceUrl: ["sourceUrl", "source_url", "sourceLink", "来源链接", "数据来源", "原文链接"],
  attributes: ["attributes", "扩展属性", "扩展信息"],
  tags: ["tags", "keywords", "标签", "关键词", "关键字"],
  favsCount: ["favsCount", "hot", "views", "likes", "热度", "收藏数", "浏览量"],
  category: ["category", "文物类别", "藏品类别", "类型", "classification", "kind"],
  level: ["level", "等级", "级别", "文物等级", "grade", "rating", "保护级别"],
  dimensions: ["dimensions", "size", "尺寸", "规格", "体量", "长宽高"],
  remarks: ["remarks", "备注", "附注", "notes", "annotation"],
};

const TEXT_FIELD_LABELS: Partial<Record<keyof Artifact, string[]>> = {
  name: ["名称", "文物名称", "藏品名称", "题名", "标题"],
  museum: ["博物馆", "所属博物馆", "所在博物馆", "馆名", "馆藏单位", "收藏单位", "现藏", "现藏地", "现藏单位", "藏于"],
  period: ["年代", "时代", "朝代", "时期", "断代"],
  material: ["材质", "质地", "材料"],
  culture: ["文化", "文化类型", "分类"],
  origin: ["出土地", "发现地", "来源", "产地", "遗址", "地点"],
  shortIntro: ["一句话简介", "短简介", "摘要"],
  description: ["简介", "介绍", "说明", "描述", "文物简介", "藏品介绍"],
  imageUrl: ["图片", "图像", "图片URL", "图片链接", "照片"],
  sourceUrl: ["来源链接", "数据来源", "原文链接"],
  tags: ["标签", "关键词", "关键字"],
  category: ["类别", "文物类别", "藏品类别", "类型"],
  level: ["等级", "级别", "文物等级", "保护级别"],
  dimensions: ["尺寸", "规格", "体量", "长宽高"],
  remarks: ["备注", "附注", "notes"],
};

const DEFAULT_IMPORT_TEMPLATE: ArtifactImportJob = {
  sourceName: "中国国家博物馆示例导入",
  sourceType: "file",
  inputPath: "./imports/example-national-museum.json",
  format: "json",
  listPath: "records",
  mode: "replace-museum",
  persistTo: ["file"],
  defaults: {
    museum: "中国国家博物馆",
    culture: "馆藏文物",
    favsCount: 0,
  },
  mapping: {
    id: ["文物编号", "id"],
    name: ["名称", "name", "title"],
    museum: ["博物馆", "museum"],
    period: ["年代", "period"],
    material: ["材质", "material"],
    culture: ["文化", "culture"],
    origin: ["出土地", "origin", "unearthedAt"],
    shortIntro: ["一句话简介", "shortIntro", "short_intro", "summary"],
    description: ["简介", "description", "summary"],
    imageUrl: ["图片", "imageUrl", "image"],
    sourceUrl: ["来源链接", "sourceUrl", "source_url"],
    attributes: ["attributes", "扩展属性", "扩展信息"],
    tags: ["标签", "tags"],
    favsCount: ["热度", "favsCount"],
    category: ["类别", "category"],
    level: ["等级", "level"],
    dimensions: ["尺寸", "dimensions", "size"],
    remarks: ["备注", "remarks"],
  },
};

function getDefaultArtifactStore(): ArtifactStoreDocument {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    artifacts: [],
  };
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readArtifactStore(): Promise<ArtifactStoreDocument> {
  try {
    const file = await fs.readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(file) as ArtifactStoreDocument;
    return {
      version: 1,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [],
    };
  } catch (error) {
    return getDefaultArtifactStore();
  }
}

async function writeArtifactStore(artifacts: Artifact[]) {
  await ensureDataDir();
  const payload: ArtifactStoreDocument = {
    version: 1,
    updatedAt: new Date().toISOString(),
    artifacts,
  };
  await fs.writeFile(STORE_PATH, JSON.stringify(payload, null, 2), "utf-8");
}

function getByPath(record: unknown, selector: string): unknown {
  if (!selector) {
    return undefined;
  }

  return selector.split(".").reduce<unknown>((current, part) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number(part);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (typeof current === "object") {
      return (current as Record<string, unknown>)[part];
    }

    return undefined;
  }, record);
}

function resolveSelector(record: Record<string, unknown>, selector?: ArtifactFieldSelector): unknown {
  if (!selector) {
    return undefined;
  }

  const selectors = Array.isArray(selector) ? selector : [selector];
  for (const candidate of selectors) {
    const value = getByPath(record, candidate);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
}

function normalizeKey(key: string) {
  return key
    .toLowerCase()
    .replace(/[\s_\-:：.()[\]（）【】《》<>]/g, "");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectRecordEntries(record: unknown, prefix = ""): Array<{ key: string; path: string; value: unknown }> {
  if (!isPlainObject(record)) {
    return [];
  }

  const entries: Array<{ key: string; path: string; value: unknown }> = [];
  for (const [key, value] of Object.entries(record)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    entries.push({ key, path: pathKey, value });
    if (isPlainObject(value)) {
      entries.push(...collectRecordEntries(value, pathKey));
    }
  }
  return entries;
}

function resolveByAliases(record: Record<string, unknown>, aliases: string[]): unknown {
  const entries = collectRecordEntries(record);
  const normalizedAliases = aliases.map(normalizeKey);

  for (const entry of entries) {
    const normalizedKey = normalizeKey(entry.key);
    if (normalizedAliases.includes(normalizedKey)) {
      return entry.value;
    }
  }

  for (const entry of entries) {
    const normalizedKey = normalizeKey(entry.key);
    if (normalizedAliases.some((alias) => normalizedKey.includes(alias) || alias.includes(normalizedKey))) {
      return entry.value;
    }
  }

  return undefined;
}

function collectTextFragments(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTextFragments(item));
  }
  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([key, nestedValue]) => [key, ...collectTextFragments(nestedValue)]);
  }
  return [];
}

function getRecordSearchText(record: Record<string, unknown>) {
  return collectTextFragments(record).join("\n");
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanExtractedText(value: string) {
  return value
    .replace(/^[\s:：,，;；|/、-]+/, "")
    .replace(/[\s,，;；|/]+$/, "")
    .trim();
}

function resolveFromLabeledText(record: Record<string, unknown>, field: keyof Artifact): unknown {
  const labels = TEXT_FIELD_LABELS[field] || [];
  if (labels.length === 0) {
    return undefined;
  }

  const text = getRecordSearchText(record);
  for (const label of labels) {
    const pattern = new RegExp(`(?:^|[\\n\\r；;。])\\s*${escapeRegex(label)}\\s*[:：=]?\\s*([^\\n\\r；;。]{1,160})`, "i");
    const match = text.match(pattern);
    if (match?.[1]) {
      return cleanExtractedText(match[1]);
    }
  }

  return undefined;
}

function inferMuseumFromText(record: Record<string, unknown>) {
  const text = getRecordSearchText(record);
  const labeled = resolveFromLabeledText(record, "museum");
  if (labeled) {
    return labeled;
  }

  const museumPattern =
    /([A-Za-z\u4e00-\u9fa5·（）()0-9]{2,40}(?:博物馆|博物院|美术馆|纪念馆|陈列馆|Museum|Museo|Gallery))/i;
  const match = text.match(museumPattern);
  return match?.[1] ? cleanExtractedText(match[1]) : undefined;
}

function inferImageUrlFromText(record: Record<string, unknown>) {
  const text = getRecordSearchText(record);
  const match = text.match(/https?:\/\/[^\s"'<>，,；;]+/i);
  return match?.[0];
}

function resolveImportField(
  record: Record<string, unknown>,
  field: keyof Artifact,
  mapping: Partial<Record<keyof Artifact, ArtifactFieldSelector>>,
  defaults: Partial<Artifact>,
): unknown {
  const mappedValue = resolveSelector(record, mapping[field]);
  if (mappedValue !== undefined && mappedValue !== null && mappedValue !== "") {
    return mappedValue;
  }

  if (field === "imageUrl" && mapping[field]) {
    const selectors = Array.isArray(mapping[field]) ? mapping[field] : [mapping[field]];
    if (selectors.some((selector) => getByPath(record, selector as string) === "")) {
      return "";
    }
  }

  const aliasValue = resolveByAliases(record, AUTO_FIELD_ALIASES[field] || []);
  if (aliasValue !== undefined && aliasValue !== null && aliasValue !== "") {
    return aliasValue;
  }

  if (field === "museum") {
    const museum = inferMuseumFromText(record);
    if (museum) return museum;
  }

  if (field === "imageUrl") {
    const imageUrl = inferImageUrlFromText(record);
    if (imageUrl) return imageUrl;
  }

  const textValue = resolveFromLabeledText(record, field);
  if (textValue !== undefined && textValue !== null && textValue !== "") {
    return textValue;
  }

  return defaults[field];
}

function inferFormatFromPath(inputPath?: string): ArtifactImportFormat {
  const extension = path.extname(inputPath || "").toLowerCase();
  if (extension === ".csv") {
    return "csv";
  }
  if (extension === ".ndjson" || extension === ".jsonl") {
    return "ndjson";
  }
  return "json";
}

function coerceString(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => coerceString(item)).filter(Boolean).join(" / ");
  }
  return fallback;
}

function coerceNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function coerceTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => coerceString(item)).filter(Boolean);
  }

  const text = coerceString(value);
  if (!text) {
    return [];
  }

  return text
    .split(/[|,，;；、/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function coerceAttributes(value: unknown): NonNullable<Artifact["attributes"]> {
  const parsed = (() => {
    if (typeof value === "string") {
      const text = value.trim();
      if (!text) return [];
      try {
        return JSON.parse(text);
      } catch {
        return [];
      }
    }
    return value;
  })();

  if (!Array.isArray(parsed)) return [];

  const groups = new Map<string, { order: number; items: { name: string; value: string; order: number }[] }>();
  const add = (groupRaw: unknown, nameRaw: unknown, valueRaw: unknown, orderRaw: unknown) => {
    const name = coerceString(nameRaw).trim();
    const valueText = coerceString(valueRaw).trim();
    if (!name || !valueText) return;
    const group = coerceString(groupRaw, "基础信息").trim() || "基础信息";
    const parsedOrder = Number(orderRaw);
    const order = Number.isFinite(parsedOrder) ? parsedOrder : 0;
    const existing = groups.get(group) || { order, items: [] };
    existing.order = Math.min(existing.order, order);
    existing.items.push({ name, value: valueText, order });
    groups.set(group, existing);
  };

  for (const raw of parsed) {
    if (!isPlainObject(raw)) continue;
    if (Array.isArray(raw.items)) {
      for (const itemRaw of raw.items) {
        if (!isPlainObject(itemRaw)) continue;
        add(
          raw.group ?? raw.attribute_group,
          itemRaw.name ?? itemRaw.attribute_name,
          itemRaw.value ?? itemRaw.attribute_value,
          itemRaw.sortOrder ?? itemRaw.sort_order,
        );
      }
    } else {
      add(
        raw.group ?? raw.attribute_group,
        raw.name ?? raw.attribute_name,
        raw.value ?? raw.attribute_value,
        raw.sortOrder ?? raw.sort_order,
      );
    }
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

function slugify(input: string) {
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_一-龥]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || `artifact-${Date.now()}`;
}

function dedupeArtifacts(artifacts: Artifact[]): Artifact[] {
  const unique = new Map<string, Artifact>();
  for (const artifact of artifacts) {
    unique.set(artifact.id, artifact);
  }
  return Array.from(unique.values());
}

function parseCsv(csvText: string): Record<string, unknown>[] {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        currentCell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim() !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.trim() !== "")) {
    rows.push(currentRow);
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((cell) => cell.trim());
  return rows.slice(1).map((row) => {
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });
}

async function loadRecordsFromJob(job: ArtifactImportJob): Promise<Record<string, unknown>[]> {
  if (job.sourceType === "inline" || (Array.isArray(job.records) && !job.inputPath)) {
    return Array.isArray(job.records) ? job.records : [];
  }

  if (!job.inputPath) {
    throw new Error("缺少 inputPath，无法读取导入文件。");
  }

  const absolutePath = path.isAbsolute(job.inputPath)
    ? job.inputPath
    : path.join(process.cwd(), job.inputPath);

  const fileContent = await fs.readFile(absolutePath, "utf-8");
  const format = job.format || inferFormatFromPath(job.inputPath);

  if (format === "csv") {
    return parseCsv(fileContent);
  }

  if (format === "ndjson") {
    return fileContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  const parsed = JSON.parse(fileContent) as unknown;
  const target = job.listPath ? getByPath(parsed, job.listPath) : parsed;

  if (!Array.isArray(target)) {
    throw new Error("JSON 数据未解析成数组，请检查 listPath 是否正确。");
  }

  return target as Record<string, unknown>[];
}

function normalizeArtifactRecord(
  record: Record<string, unknown>,
  index: number,
  job: ArtifactImportJob,
): Artifact {
  const mapping = job.mapping || {};
  const defaults = job.defaults || {};

  const name = coerceString(resolveImportField(record, "name", mapping, defaults));
  if (!name) {
    throw new Error("缺少 name/名称 字段。");
  }

  const museum = coerceString(resolveImportField(record, "museum", mapping, defaults), "未知博物馆");
  const period = coerceString(resolveImportField(record, "period", mapping, defaults), "未知");
  const material = coerceString(resolveImportField(record, "material", mapping, defaults), "未知");
  const culture = coerceString(resolveImportField(record, "culture", mapping, defaults), "馆藏文物");
  const origin = coerceString(resolveImportField(record, "origin", mapping, { ...defaults, origin: defaults.origin || museum }), museum);
  const shortIntro = coerceString(resolveImportField(record, "shortIntro", mapping, defaults));
  const description = coerceString(
    resolveImportField(record, "description", mapping, defaults),
    "",
  );
  const imageUrl = coerceString(
    resolveImportField(record, "imageUrl", mapping, defaults),
    "",
  );
  const sourceUrl = coerceString(resolveImportField(record, "sourceUrl", mapping, defaults));
  const mappedAttributes = coerceAttributes(resolveImportField(record, "attributes", mapping, defaults));
  const flatAttributes = coerceAttributes([
    {
      group: record.attribute_group ?? record["属性分组"] ?? record["扩展分组"],
      name: record.attribute_name ?? record["属性名称"] ?? record["扩展名称"],
      value: record.attribute_value ?? record["属性值"] ?? record["扩展值"],
      sortOrder: record.sort_order ?? record.sortOrder ?? record["排序"],
    },
  ]);
  const attributes = mappedAttributes.length > 0 ? mappedAttributes : flatAttributes;
  const tags = (() => {
    const mappedValue = resolveImportField(record, "tags", mapping, defaults);
    if (mappedValue !== undefined && mappedValue !== null && mappedValue !== "") {
      return coerceTags(mappedValue);
    }
    return Array.isArray(defaults.tags) ? defaults.tags : [];
  })();
  const favsCount = coerceNumber(resolveImportField(record, "favsCount", mapping, defaults), 0);
  const idValue = coerceString(resolveImportField(record, "id", mapping, defaults));
  const id = idValue || slugify(`${museum}-${name}-${index}`);

  const category = coerceString(resolveImportField(record, "category", mapping, defaults));
  const level = coerceString(resolveImportField(record, "level", mapping, defaults));
  const dimensions = coerceString(resolveImportField(record, "dimensions", mapping, defaults));
  const remarks = coerceString(resolveImportField(record, "remarks", mapping, defaults));

  return {
    id,
    name,
    museum,
    period,
    material,
    culture,
    origin,
    ...(shortIntro.trim() ? { shortIntro: shortIntro.trim() } : {}),
    description,
    imageUrl,
    ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}),
    ...(attributes.length > 0 ? { attributes } : {}),
    tags,
    favsCount,
    ...(category.trim() ? { category: category.trim() } : {}),
    ...(level.trim() ? { level: level.trim() } : {}),
    ...(dimensions.trim() ? { dimensions: dimensions.trim() } : {}),
    ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
  };
}

function buildImportPreview(job: ArtifactImportJob, records: Record<string, unknown>[]): ArtifactImportPreview {
  const artifacts: Artifact[] = [];
  const skipped: ArtifactImportSkippedRecord[] = [];

  records.forEach((record, index) => {
    try {
      artifacts.push(normalizeArtifactRecord(record, index, job));
    } catch (error) {
      skipped.push({
        index,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  });

  const uniqueArtifacts = dedupeArtifacts(artifacts);

  return {
    sourceName: job.sourceName || "未命名导入任务",
    totalRecords: records.length,
    validRecords: uniqueArtifacts.length,
    skippedRecords: skipped.length,
    museums: Array.from(new Set(uniqueArtifacts.map((artifact) => artifact.museum))),
    preview: uniqueArtifacts.slice(0, 20),
    artifacts: uniqueArtifacts,
    skipped: skipped.slice(0, 20),
  };
}

function mergeArtifacts(
  existingArtifacts: Artifact[],
  importedArtifacts: Artifact[],
  mode: ArtifactImportMode,
): Artifact[] {
  if (mode === "replace-all") {
    return dedupeArtifacts(importedArtifacts);
  }

  if (mode === "replace-museum") {
    const museums = new Set(importedArtifacts.map((artifact) => artifact.museum));
    const keptArtifacts = existingArtifacts.filter((artifact) => !museums.has(artifact.museum));
    return dedupeArtifacts([...keptArtifacts, ...importedArtifacts]);
  }

  return dedupeArtifacts([...existingArtifacts, ...importedArtifacts]);
}

async function persistArtifactsToFile(
  artifacts: Artifact[],
  mode: ArtifactImportMode,
): Promise<{ count: number; artifacts: Artifact[] }> {
  const store = await readArtifactStore();
  const mergedArtifacts = mergeArtifacts(store.artifacts, artifacts, mode);
  await writeArtifactStore(mergedArtifacts);
  await syncMuseumStoreFromArtifacts(mergedArtifacts);
  return { count: mergedArtifacts.length, artifacts: mergedArtifacts };
}

export async function getImportedArtifacts(): Promise<Artifact[]> {
  const store = await readArtifactStore();
  return store.artifacts;
}

export async function getImportStorePath() {
  await ensureDataDir();
  return STORE_PATH;
}

export function getArtifactImportTemplate() {
  return DEFAULT_IMPORT_TEMPLATE;
}

export async function previewArtifactImport(job: ArtifactImportJob): Promise<ArtifactImportPreview> {
  const records = await loadRecordsFromJob(job);
  return buildImportPreview(job, records);
}

export async function executeArtifactImport(options: { job: ArtifactImportJob }): Promise<ArtifactImportExecutionResult> {
  const preview = await previewArtifactImport(options.job);
  const mode = options.job.mode || "replace-museum";
  const requestedTargets = options.job.persistTo || ["file"];
  const persistedTo: ArtifactPersistTarget[] = [];

  let fileStoreCount = 0;
  let aiRagSync: AiRagSyncSummary | undefined;

  if (requestedTargets.includes("file")) {
    const persisted = await persistArtifactsToFile(preview.artifacts, mode);
    fileStoreCount = persisted.count;
    aiRagSync = await syncAiRagForArtifacts(persisted.artifacts);
    persistedTo.push("file");
  }

  return {
    ...preview,
    persistedTo,
    fileStoreCount,
    aiRagSync,
  };
}
