import fs from "fs/promises";
import path from "path";

type ArtifactRecord = Record<string, unknown>;

type ArtifactStore = {
  version: number;
  updatedAt?: string;
  artifacts: ArtifactRecord[];
};

const ROOT = process.cwd();
const INPUT_PATH = path.join(ROOT, "data", "imported-artifacts.json");
const OUTPUT_PATH = path.join(ROOT, "data", "imported-artifacts.enriched.json");
const TARGET_MUSEUM = "辽宁省博物馆";
const SOURCE_NAME = "辽宁省博物馆公开资料";
const UNKNOWN = "暂无信息";
const COPYRIGHT_NOTE =
  "图片与文字信息来源于公开资料，仅用于 MuseLink 项目 Demo 展示与学习研究，正式使用前需进一步核对授权。";

const ALIASES = {
  name: ["name", "文物名称", "名称", "title", "藏品名称", "题名"],
  museum: ["museumName", "museum", "所属博物馆", "博物馆", "馆藏单位", "收藏单位", "馆名"],
  period: ["dynasty", "period", "era", "朝代", "时代", "年代", "所属年代", "时期"],
  category: ["category", "类别", "文物类别", "藏品类别", "类型", "classification"],
  level: ["level", "等级", "级别", "文物等级", "保护级别"],
  material: ["material", "材质", "质地", "材料", "medium"],
  dimensions: ["dimensions", "size", "尺寸", "规格", "体量", "长宽高"],
  remarks: ["remarks", "remark", "note", "notes", "备注", "附注", "说明"],
  sourceUrl: ["sourceUrl", "source_url", "来源链接", "数据来源", "原文链接", "sourceLink"],
};

const EMPTY_VALUES = new Set(["", "nan", "none", "null", "undefined", UNKNOWN, "未知"]);

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function hasUsefulValue(value: unknown): boolean {
  return !EMPTY_VALUES.has(cleanText(value).toLowerCase());
}

function firstValue(record: ArtifactRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (hasUsefulValue(value)) return cleanText(value);
  }
  return "";
}

function existingOr(record: ArtifactRecord, key: string, fallback: unknown) {
  return hasUsefulValue(record[key]) ? record[key] : fallback;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(hasUsefulValue)));
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function normalizeCategory(category: string) {
  return hasUsefulValue(category) ? category : "馆藏";
}

function normalizePeriod(period: string) {
  return hasUsefulValue(period) ? period : "";
}

function makeShortIntro(record: ArtifactRecord): string {
  const period = normalizePeriod(firstValue(record, ALIASES.period));
  const category = normalizeCategory(firstValue(record, ALIASES.category));
  const material = firstValue(record, ALIASES.material);

  if (period && hasUsefulValue(category) && material) {
    return `这件文物为${period}时期的${category}类藏品，可从材质、形制与工艺细节中观察当时的审美特征。`;
  }
  if (period && hasUsefulValue(category)) {
    return `这件文物为${period}时期的${category}类藏品，是理解相关时代器物形制与审美趣味的材料之一。`;
  }
  if (hasUsefulValue(category)) {
    return `这件文物属于${category}类藏品，可作为观察馆藏体系、器物形制与工艺特征的样本。`;
  }
  return "这件文物是辽宁省博物馆收藏的重要藏品，具有较高的展示与研究价值。";
}

function sentence(label: string, value: string): string {
  return hasUsefulValue(value) ? `${label}${value}。` : "";
}

function makeDescription(record: ArtifactRecord): string {
  const name = firstValue(record, ALIASES.name);
  const period = firstValue(record, ALIASES.period);
  const category = firstValue(record, ALIASES.category);
  const material = firstValue(record, ALIASES.material);
  const dimensions = firstValue(record, ALIASES.dimensions);
  const level = firstValue(record, ALIASES.level);
  const remarks = firstValue(record, ALIASES.remarks);
  const normalizedCategory = normalizeCategory(category);

  const parts = [
    `${name || "这件文物"}现藏于辽宁省博物馆。`,
    sentence("时代信息为", period),
    sentence("类别为", category),
    sentence("材质记录为", material),
    sentence("尺寸信息为", dimensions),
    sentence("等级为", level),
    sentence("备注显示", remarks),
    `在现有资料范围内，它可作为观察${hasUsefulValue(normalizedCategory) ? normalizedCategory : "馆藏文物"}形制、材料工艺与展示价值的样本。`,
    "当前数据未提供更具体的出土背景或流传信息，历史解释仍需结合权威馆藏资料核对。",
  ].filter(Boolean);

  return parts.join("");
}

function makeCultureTags(record: ArtifactRecord): string[] {
  const period = firstValue(record, ALIASES.period);
  const category = firstValue(record, ALIASES.category);
  const material = firstValue(record, ALIASES.material);
  const remarks = firstValue(record, ALIASES.remarks);
  const text = `${period} ${category} ${material} ${remarks}`;
  const tags: string[] = [];

  if (period.includes("辽")) tags.push("辽代文化");
  if (hasAny(text, ["佛", "造像", "菩萨", "佛教"])) tags.push("佛教文化");
  if (category.includes("玉")) tags.push("玉器文化");
  if (category.includes("瓷") || category.includes("陶")) tags.push("陶瓷文化");
  if (category.includes("书") || category.includes("画")) tags.push("书画艺术");
  if (category.includes("青铜") || material.includes("铜")) tags.push("青铜文化");

  return unique(tags);
}

function makeThemeTags(record: ArtifactRecord): string[] {
  const category = firstValue(record, ALIASES.category);
  const material = firstValue(record, ALIASES.material);
  const remarks = firstValue(record, ALIASES.remarks);
  const text = `${category} ${material} ${remarks}`;
  const tags: string[] = [];

  if (hasAny(text, ["佛", "造像", "菩萨"])) tags.push("宗教信仰");
  if (category.includes("陶") || category.includes("瓷")) tags.push("日用器物");
  if (category.includes("玉")) tags.push("礼仪审美");
  if (category.includes("书") || category.includes("画")) tags.push("艺术欣赏");
  if (material.includes("金") || material.includes("银")) tags.push("金属工艺");
  if (tags.length === 0) tags.push("馆藏精品");

  return unique(tags);
}

function mergeTags(existing: unknown, cultureTags: string[], themeTags: string[]) {
  const base = Array.isArray(existing)
    ? existing.map((item) => cleanText(item)).filter(hasUsefulValue)
    : [];
  return unique([...base, ...cultureTags, ...themeTags]);
}

function enrichArtifact(record: ArtifactRecord): ArtifactRecord {
  const museum = firstValue(record, ALIASES.museum);
  if (museum !== TARGET_MUSEUM) return record;

  const cultureTags = hasUsefulValue(record.cultureTags) && Array.isArray(record.cultureTags)
    ? record.cultureTags as string[]
    : makeCultureTags(record);
  const themeTags = hasUsefulValue(record.themeTags) && Array.isArray(record.themeTags)
    ? record.themeTags as string[]
    : makeThemeTags(record);
  const sourceUrl = firstValue(record, ALIASES.sourceUrl);

  return {
    ...record,
    shortIntro: existingOr(record, "shortIntro", makeShortIntro(record)),
    description: existingOr(record, "description", makeDescription(record)),
    sourceName: existingOr(record, "sourceName", SOURCE_NAME),
    sourceUrl: existingOr(record, "sourceUrl", sourceUrl || UNKNOWN),
    copyrightNote: existingOr(record, "copyrightNote", COPYRIGHT_NOTE),
    regionTag: existingOr(record, "regionTag", "辽宁"),
    cultureTags,
    themeTags,
    tags: mergeTags(record.tags, cultureTags, themeTags),
  };
}

async function main() {
  const raw = await fs.readFile(INPUT_PATH, "utf-8");
  const store = JSON.parse(raw) as ArtifactStore;
  const artifacts = Array.isArray(store.artifacts) ? store.artifacts : [];
  const enriched = artifacts.map(enrichArtifact);
  const targetCount = artifacts.filter((artifact) => firstValue(artifact, ALIASES.museum) === TARGET_MUSEUM).length;

  const output: ArtifactStore = {
    ...store,
    updatedAt: new Date().toISOString(),
    artifacts: enriched,
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");

  const enrichedTarget = enriched.filter((artifact) => firstValue(artifact, ALIASES.museum) === TARGET_MUSEUM);
  const shortIntroCount = enrichedTarget.filter((artifact) => hasUsefulValue(artifact.shortIntro)).length;
  const descriptionCount = enrichedTarget.filter((artifact) => hasUsefulValue(artifact.description)).length;

  console.log(JSON.stringify({
    input: path.relative(ROOT, INPUT_PATH),
    output: path.relative(ROOT, OUTPUT_PATH),
    totalArtifacts: artifacts.length,
    targetMuseum: TARGET_MUSEUM,
    targetArtifacts: targetCount,
    enrichedShortIntro: shortIntroCount,
    enrichedDescription: descriptionCount,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
