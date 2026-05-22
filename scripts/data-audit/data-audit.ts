import fs from "fs/promises";
import path from "path";

type JsonObject = Record<string, unknown>;

type FieldAudit = {
  fieldName: string;
  filledCount: number;
  emptyCount: number;
  completionRate: number;
};

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "scripts", "data-audit");
const SCHEMA_PATH = path.join(ROOT, "backend", "api", "db", "schema.sql");
const ARTIFACTS_PATH = path.resolve(
  ROOT,
  process.argv[2] || process.env.DATA_AUDIT_ARTIFACTS_PATH || path.join("data", "imported-artifacts.json"),
);
const MUSEUMS_PATH = path.join(ROOT, "data", "imported-museums.json");
const USER_DATA_PATH = path.join(ROOT, "data", "user-data.json");
const EXHIBITIONS_PATH = path.join(ROOT, "data", "exhibitions.json");

const FIELD_ALIASES: Record<string, string[]> = {
  "文物名称": ["name", "文物名称", "名称", "title", "藏品名称", "题名"],
  "所属博物馆": ["museumName", "museum", "所属博物馆", "博物馆", "馆藏单位", "收藏单位", "馆名"],
  "朝代": ["dynasty", "period", "era", "朝代", "时代", "年代", "所属年代", "时期"],
  "类别": ["category", "类别", "文物类别", "藏品类别", "类型", "classification"],
  "等级": ["level", "等级", "级别", "文物等级", "保护级别"],
  "材质": ["material", "材质", "质地", "材料", "medium"],
  "尺寸": ["dimensions", "size", "尺寸", "规格", "体量", "长宽高"],
  "图片链接": ["imageUrl", "image_url", "图片链接", "高精度图片链接", "图片URL", "图片", "照片", "image", "img", "thumbnail"],
  "备注": ["remarks", "remark", "note", "notes", "备注", "附注", "说明"],
  "简介": ["shortIntro", "short_intro", "一句话简介", "短简介", "摘要", "summary"],
  "详细介绍": ["description", "详细介绍", "文物描述", "文物简介", "介绍", "简介", "说明", "details"],
};

const INVALID_VALUES = new Set(["", "nan", "none", "null", "undefined", "暂无信息", "未知"]);

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const text = await fs.readFile(filePath, "utf-8");
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean).join(" / ");
  }
  return "";
}

function hasValue(value: unknown): boolean {
  const text = cleanText(value).toLowerCase();
  return !INVALID_VALUES.has(text);
}

function firstValue(record: JsonObject, aliases: string[]): string {
  for (const key of aliases) {
    const value = record[key];
    if (hasValue(value)) return cleanText(value);
  }
  return "";
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]) {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n") + "\n";
}

function parseSchema(schemaSql: string) {
  const tables: Array<{ name: string; columns: string[] }> = [];
  const tableRegex = /create table if not exists\s+([a-zA-Z_][\w]*)\s*\(([\s\S]*?)\);/g;
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(schemaSql)) !== null) {
    const [, name, body] = match;
    const columns = body
      .split("\n")
      .map((line) => line.trim().replace(/,$/, ""))
      .filter((line) => line && !line.startsWith("--"))
      .map((line) => line.split(/\s+/)[0])
      .filter((column) => !["primary", "foreign", "unique", "constraint"].includes(column.toLowerCase()));
    tables.push({ name, columns });
  }

  const indexes = Array.from(schemaSql.matchAll(/create index if not exists\s+([a-zA-Z_][\w]*)/g)).map((item) => item[1]);
  const types = Array.from(schemaSql.matchAll(/create type\s+([a-zA-Z_][\w]*)\s+as enum/gi)).map((item) => item[1]);

  return { tables, indexes, types };
}

function buildMuseumCounts(artifacts: JsonObject[]) {
  const counts = new Map<string, number>();
  for (const artifact of artifacts) {
    const museumName = firstValue(artifact, FIELD_ALIASES["所属博物馆"]) || "未知博物馆";
    counts.set(museumName, (counts.get(museumName) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([museumName, artifactCount]) => ({ museumName, artifactCount }))
    .sort((a, b) => b.artifactCount - a.artifactCount || a.museumName.localeCompare(b.museumName, "zh-CN"));
}

function buildFieldAudits(artifacts: JsonObject[]): FieldAudit[] {
  const total = artifacts.length;
  return Object.entries(FIELD_ALIASES).map(([fieldName, aliases]) => {
    const filledCount = artifacts.filter((artifact) => firstValue(artifact, aliases)).length;
    const emptyCount = total - filledCount;
    return {
      fieldName,
      filledCount,
      emptyCount,
      completionRate: total > 0 ? Number((filledCount / total).toFixed(4)) : 0,
    };
  });
}

function getAllArtifactKeys(artifacts: JsonObject[]) {
  const keyCounts = new Map<string, number>();
  for (const artifact of artifacts) {
    for (const [key, value] of Object.entries(artifact)) {
      if (hasValue(value)) {
        keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
      }
    }
  }
  return Array.from(keyCounts.entries())
    .map(([key, filledCount]) => ({
      key,
      filledCount,
      emptyCount: artifacts.length - filledCount,
      completionRate: artifacts.length > 0 ? filledCount / artifacts.length : 0,
    }))
    .sort((a, b) => a.completionRate - b.completionRate || a.key.localeCompare(b.key, "zh-CN"));
}

function artifactIds(artifacts: JsonObject[]) {
  return new Set(artifacts.map((artifact) => cleanText(artifact.id)).filter(Boolean));
}

function getFavoritesCount(userData: JsonObject) {
  const favoritesByUserId = userData.favoritesByUserId as Record<string, unknown> | undefined;
  if (!favoritesByUserId) return { userCount: 0, favoriteCount: 0 };
  const entries = Object.values(favoritesByUserId);
  return {
    userCount: entries.length,
    favoriteCount: entries.reduce<number>((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0),
  };
}

function getExhibitionStats(exhibitionsDoc: JsonObject) {
  const exhibitions = Array.isArray(exhibitionsDoc.exhibitions) ? exhibitionsDoc.exhibitions as JsonObject[] : [];
  const referencedIds = new Set<string>();
  for (const exhibition of exhibitions) {
    const ids = Array.isArray(exhibition.artifactIds) ? exhibition.artifactIds : [];
    ids.forEach((id) => {
      const text = cleanText(id);
      if (text) referencedIds.add(text);
    });
  }
  return { exhibitionCount: exhibitions.length, referencedArtifactCount: referencedIds.size, referencedIds };
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" |")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replace(/\|/g, "\\|")).join(" | ")} |`),
  ].join("\n");
}

function pct(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

async function main() {
  const [schemaSql, artifactsDoc, museumsDoc, userData, exhibitionsDoc] = await Promise.all([
    fs.readFile(SCHEMA_PATH, "utf-8").catch(() => ""),
    readJson<JsonObject>(ARTIFACTS_PATH, { artifacts: [] }),
    readJson<JsonObject>(MUSEUMS_PATH, { museums: [] }),
    readJson<JsonObject>(USER_DATA_PATH, {}),
    readJson<JsonObject>(EXHIBITIONS_PATH, { exhibitions: [] }),
  ]);

  const schema = parseSchema(schemaSql);
  const artifacts = Array.isArray(artifactsDoc.artifacts) ? artifactsDoc.artifacts as JsonObject[] : [];
  const museums = Array.isArray(museumsDoc.museums) ? museumsDoc.museums as JsonObject[] : [];
  const museumCounts = buildMuseumCounts(artifacts);
  const fieldAudits = buildFieldAudits(artifacts);
  const allKeyStats = getAllArtifactKeys(artifacts);
  const ids = artifactIds(artifacts);
  const favoriteStats = getFavoritesCount(userData);
  const exhibitionStats = getExhibitionStats(exhibitionsDoc);
  const museumsWithArtifacts = new Set(museumCounts.map((item) => item.museumName));
  const museumsWithoutArtifacts = museums
    .map((museum) => cleanText(museum.name))
    .filter((name) => name && !museumsWithArtifacts.has(name))
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
  const missingImages = artifacts
    .filter((artifact) => !firstValue(artifact, FIELD_ALIASES["图片链接"]))
    .map((artifact) => firstValue(artifact, FIELD_ALIASES["文物名称"]) || cleanText(artifact.id));
  const missingDescription = artifacts
    .filter((artifact) => !firstValue(artifact, FIELD_ALIASES["详细介绍"]))
    .map((artifact) => firstValue(artifact, FIELD_ALIASES["文物名称"]) || cleanText(artifact.id));
  const orphanExhibitionIds = Array.from(exhibitionStats.referencedIds).filter((id) => !ids.has(id));
  const duplicateIds = Array.from(
    artifacts.reduce((map, artifact) => {
      const id = cleanText(artifact.id);
      if (id) map.set(id, (map.get(id) || 0) + 1);
      return map;
    }, new Map<string, number>()),
  ).filter(([, count]) => count > 1);

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(
    path.join(OUT_DIR, "museum_artifact_count.csv"),
    toCsv(museumCounts, ["museumName", "artifactCount"]),
    "utf-8",
  );
  await fs.writeFile(
    path.join(OUT_DIR, "artifact_field_completeness.csv"),
    toCsv(
      fieldAudits.map((item) => ({
        fieldName: item.fieldName,
        filledCount: item.filledCount,
        emptyCount: item.emptyCount,
        completionRate: pct(item.completionRate),
      })),
      ["fieldName", "filledCount", "emptyCount", "completionRate"],
    ),
    "utf-8",
  );

  const topMissing = fieldAudits
    .slice()
    .sort((a, b) => b.emptyCount - a.emptyCount || a.fieldName.localeCompare(b.fieldName, "zh-CN"))
    .slice(0, 8);
  const severeKeyMissing = allKeyStats
    .filter((item) => item.filledCount > 0 && item.emptyCount > 0)
    .slice(0, 12);

  const report = `# MuseLink 数据盘点报告

生成时间：${new Date().toISOString()}

## 1. 数据源与数据库结构

本次脚本只读本地项目数据，不修改数据库、不删除数据、不创建表。

- PostgreSQL schema：\`backend/api/db/schema.sql\`
- 当前盘点文物数据：\`${path.relative(ROOT, ARTIFACTS_PATH)}\`
- 当前主应用博物馆数据：\`data/imported-museums.json\`
- 收藏数据：\`data/user-data.json\`
- 展览数据：\`data/exhibitions.json\`

### 1.1 Schema 表

${mdTable(
  ["表名", "主要字段"],
  schema.tables.map((table) => [table.name, table.columns.join(", ")]),
)}

### 1.2 结构说明

- 已存在 \`museums\` 表。
- 已存在 \`artifacts\` 文物表；未在 schema 中发现 \`relics\` 或 \`collections\` 表。
- \`artifacts.museum_id\` 外键关联 \`museums.id\`，是 PostgreSQL schema 中的正式关联方式。
- 当前 JSON 文物数据仍主要使用 \`museum\` / \`所属博物馆\` / 可兼容 \`museumName\`。
- 标签在 PostgreSQL 中是 \`artifacts.tags text[]\`，当前还不是独立标签表。
- 收藏在 PostgreSQL 中是 \`likes(user_id, target_type, target_id)\`；当前主应用 JSON 收藏在 \`data/user-data.json.favoritesByUserId\`。
- 展览与文物通过 \`exhibition_items(exhibition_id, artifact_id)\` 关联；JSON 展览中用 \`artifactIds\` 数组。
- 已有扩展属性表 \`artifact_attributes\`，可承载不同文物的灵活字段。

索引：${schema.indexes.length ? schema.indexes.map((item) => `\`${item}\``).join(", ") : "未解析到索引"}

枚举类型：${schema.types.length ? schema.types.map((item) => `\`${item}\``).join(", ") : "未解析到枚举类型"}

## 2. 数据统计

- \`data/imported-museums.json\` 博物馆记录数：${museums.length}
- 有文物挂载的博物馆数：${museumCounts.length}
- 文物总数：${artifacts.length}
- 仅有馆名/博物馆壳但没有文物的博物馆数：${museumsWithoutArtifacts.length}
- 收藏用户记录数：${favoriteStats.userCount}
- 收藏文物记录数：${favoriteStats.favoriteCount}
- 展览数：${exhibitionStats.exhibitionCount}
- 展览引用过的文物 ID 数：${exhibitionStats.referencedArtifactCount}
- 展览引用但当前文物库不存在的 ID 数：${orphanExhibitionIds.length}
- 重复文物 ID 数：${duplicateIds.length}

### 2.1 每个博物馆文物数量

完整 CSV 已生成：\`scripts/data-audit/museum_artifact_count.csv\`

${mdTable(
  ["博物馆", "文物数"],
  museumCounts.slice(0, 20).map((item) => [item.museumName, item.artifactCount]),
)}

### 2.2 文物数量最多的博物馆

${museumCounts.length ? museumCounts.slice(0, 10).map((item, index) => `${index + 1}. ${item.museumName}: ${item.artifactCount}`).join("\n") : "当前没有文物数据。"}

### 2.3 只有馆名但没有文物的博物馆

共 ${museumsWithoutArtifacts.length} 个。前 30 个：

${museumsWithoutArtifacts.slice(0, 30).map((name) => `- ${name}`).join("\n") || "- 无"}

### 2.4 没有图片的文物

共 ${missingImages.length} 条。

${missingImages.slice(0, 30).map((name) => `- ${name}`).join("\n") || "- 无"}

### 2.5 缺少详细介绍的文物

共 ${missingDescription.length} 条。前 30 条：

${missingDescription.slice(0, 30).map((name) => `- ${name}`).join("\n") || "- 无"}

## 3. 字段完整度

完整 CSV 已生成：\`scripts/data-audit/artifact_field_completeness.csv\`

${mdTable(
  ["字段", "有值", "为空", "完整率"],
  fieldAudits.map((item) => [item.fieldName, item.filledCount, item.emptyCount, pct(item.completionRate)]),
)}

### 3.1 缺失最严重字段

${mdTable(
  ["字段", "有值", "为空", "完整率"],
  topMissing.map((item) => [item.fieldName, item.filledCount, item.emptyCount, pct(item.completionRate)]),
)}

### 3.2 原始键层面的不统一信号

以下是“出现过但不是每条都有”的原始键，说明当前导入字段存在批次差异或命名不统一：

${mdTable(
  ["原始键", "有值", "为空", "完整率"],
  severeKeyMissing.map((item) => [item.key, item.filledCount, item.emptyCount, pct(item.completionRate)]),
)}

## 4. 当前数据结构问题

1. 当前真实文物集中度很高：有文物挂载的博物馆只有 ${museumCounts.length} 个，而博物馆壳数据有 ${museums.length} 个，说明“博物馆目录”和“文物馆藏数据”尚未同步扩展。
2. 文物字段存在双轨命名：JSON 使用 \`museum\`、\`period\`、中文键、旧字段；SQL schema 使用 \`museum_id\`、\`dynasty\`、\`image_url\`。兼容层有效，但长期维护成本偏高。
3. 标签仍偏轻量：当前主要是数组标签，缺少标签类型、标签来源、标签置信度、同义词、层级关系。
4. 介绍类字段状态：${missingDescription.length > 0 ? `仍有 ${missingDescription.length} 条缺少详细介绍，短简介和详细介绍对精品文物、主题策展、推荐解释都很关键。` : "当前盘点数据中的详细介绍已补齐，但仍建议人工审核文字准确性。"}
5. 展览里存在 ${orphanExhibitionIds.length} 个当前文物库不存在的引用 ID，需要后续做只读核对后再决定是否修复。
6. 当前扩展属性结构已经具备雏形，但历史 JSON 数据仍大量依赖 \`material/dimensions/level/remarks\` 等旧字段。

## 5. 是否适合长期扩展

- 全球博物馆扩展：基础 schema 可以起步，但还缺少国家/地区、经纬度、官网、数据来源、授权状态、多语言名称等字段。
- 精品文物体系：需要增加精选等级、推荐理由、策展权重、高清图状态、版权/来源字段。
- 主题策展：现有 \`tags\`、\`dynasty\`、\`category\`、\`material\` 可用于初步筛选，但介绍和结构化标签不足。
- 标签系统：建议从数组升级到独立标签表，支持 \`tag_type\`、同义词、层级、人工/导入来源。
- 文物关联推荐：当前可基于名称、博物馆、朝代、材质、类别、标签做轻量推荐；若要更稳定，需要补全描述、来源、主题标签和扩展属性。

## 6. 后续建议

优先级建议：

1. 先补数据：优先补 \`description\` / \`shortIntro\` / \`sourceUrl\` / 图片版权来源，收益最高。
2. 再固化数据结构：统一导入后的标准字段，逐步把旧字段同步到 \`artifact_attributes\`，减少中文键和驼峰/下划线混用。
3. 再做标签体系：建立标签类型和主题标签，支撑精品文物、主题策展和推荐。
4. 最后再改 UI 或做 AI 功能：当前最大瓶颈不是界面，而是数据完整度和结构化程度。

## 7. 本次输出文件

- \`scripts/data-audit/data_audit_report.md\`
- \`scripts/data-audit/museum_artifact_count.csv\`
- \`scripts/data-audit/artifact_field_completeness.csv\`
`;

  await fs.writeFile(path.join(OUT_DIR, "data_audit_report.md"), report, "utf-8");

  console.log(JSON.stringify({
    artifacts: artifacts.length,
    museumsInStore: museums.length,
    museumsWithArtifacts: museumCounts.length,
    museumsWithoutArtifacts: museumsWithoutArtifacts.length,
    missingImages: missingImages.length,
    missingDescription: missingDescription.length,
    report: "scripts/data-audit/data_audit_report.md",
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
