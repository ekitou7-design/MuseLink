import fs from "fs/promises";
import path from "path";

type JsonObject = Record<string, unknown>;

type ArtifactKind =
  | "calligraphyPainting"
  | "ceramic"
  | "jade"
  | "metal"
  | "religious"
  | "documentSeal"
  | "dailyObject"
  | "unknown";

type ArtifactRelationSeed = {
  relationType: string;
  value: string;
  relationReason: string;
};

type RelationCandidate = {
  sourceArtifactId: string;
  targetArtifactId: string;
  relationType: string;
  relationReason: string;
  confidence: number;
};

type GeneratedTags = {
  regionTag: string;
  cultureTags: string[];
  themeTags: string[];
  materialTags: string[];
  periodTags: string[];
  inferredPeriodFromTitle: boolean;
  lowTagConfidence: boolean;
};

type RagDocument = {
  id: string;
  title: string;
  museumName: string;
  text: string;
  metadata: {
    dynasty: string;
    category: string;
    regionTag: string;
    cultureTags: string[];
    themeTags: string[];
    materialTags: string[];
    periodTags: string[];
    sourceUrl: string;
    needsHumanReview: boolean;
    reviewFlags: string[];
    isCuratable: boolean;
  };
};

const ROOT = process.cwd();
const ARTIFACTS_PATH = path.join(ROOT, "data", "imported-artifacts.json");
const AI_READY_PATH = path.join(ROOT, "data", "imported-artifacts.ai-ready.v2.json");
const RELATION_SEEDS_PATH = path.join(ROOT, "data", "artifact-relation-seeds.v2.json");
const RAG_DOCS_PATH = path.join(ROOT, "data", "rag", "artifacts-rag-documents.v2.jsonl");

const UNKNOWN = "暂无信息";
const REGION_TAG = "辽宁";
const MAX_RELATIONS_PER_ARTIFACT = 5;

const INVALID_VALUES = new Set(["", "nan", "none", "null", "undefined", UNKNOWN, "未知"]);
const UNCERTAIN_PERIOD_VALUES = new Set(["", UNKNOWN, "未知", "其他"]);
const TITLE_PERIOD_RULES: Array<[RegExp, string]> = [
  [/新石器/, "新石器时代"],
  [/春秋|战国/, "春秋战国时期"],
  [/西汉|东汉|汉/, "汉代"],
  [/魏晋|晋/, "魏晋时期"],
  [/唐/, "唐代"],
  [/宋/, "宋代"],
  [/辽/, "辽代"],
  [/金/, "金代"],
  [/元/, "元代"],
  [/明/, "明代"],
  [/清/, "清代"],
  [/民国/, "民国时期"],
  [/现代|中华人民共和国/, "现代"],
];

const FIELD_ALIASES: Record<string, string[]> = {
  id: ["id"],
  name: ["name", "文物名称", "名称", "title", "藏品名称", "题名"],
  museumName: ["museumName", "museum", "所属博物馆", "博物馆", "馆藏单位", "收藏单位", "馆名"],
  dynasty: ["dynasty", "period", "era", "朝代", "时代", "年代", "所属年代", "时期"],
  category: ["category", "类别", "文物类别", "藏品类别", "类型", "classification"],
  level: ["level", "等级", "级别", "文物等级", "保护级别"],
  material: ["material", "材质", "质地", "材料", "medium"],
  dimensions: ["dimensions", "size", "尺寸", "规格", "体量", "长宽高"],
  remarks: ["remarks", "remark", "note", "notes", "备注", "附注", "说明"],
  sourceUrl: ["sourceUrl", "source_url", "来源链接", "source"],
  sourceName: ["sourceName", "source_name", "来源名称"],
  shortIntro: ["shortIntro", "short_intro", "一句话简介", "短简介", "摘要", "summary"],
  description: ["description", "详细介绍", "文物描述", "文物简介", "介绍", "details"],
};

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join(" / ");
  return "";
}

function hasUsableValue(value: unknown): boolean {
  const text = cleanText(value).toLowerCase();
  return !INVALID_VALUES.has(text);
}

function firstValue(record: JsonObject, aliases: string[]): string {
  for (const key of aliases) {
    const value = record[key];
    if (hasUsableValue(value)) return cleanText(value);
  }
  return "";
}

function rawFirstValue(record: JsonObject, aliases: string[]): string {
  for (const key of aliases) {
    if (key in record) return cleanText(record[key]);
  }
  return "";
}

function valueOrUnknown(value: string): string {
  return value || UNKNOWN;
}

function normalizeSentence(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/。+/g, "。")
    .replace(/，。/g, "。")
    .replace(/：。/g, "。")
    .trim();
}

function clampSentence(text: string, maxLength: number) {
  const normalized = normalizeSentence(text);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 1)).replace(/[，、；：,. ]+$/, "")}。`;
}

function pushUnique(values: string[], value: string) {
  const text = value.trim();
  if (text && !values.includes(text)) values.push(text);
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function splitMaterialTags(material: string) {
  return unique(
    material
      .split(/[、,，/]/)
      .map((item) => item.trim())
      .filter((item) => item && !INVALID_VALUES.has(item.toLowerCase())),
  );
}

function isUncertainPeriod(value: string) {
  return UNCERTAIN_PERIOD_VALUES.has(value.trim());
}

function normalizePeriodTags(dynasty: string) {
  const tags: string[] = [];
  if (dynasty.includes("新石器")) pushUnique(tags, "新石器时代");
  if (dynasty.includes("春秋") || dynasty.includes("战国")) pushUnique(tags, "春秋战国时期");
  if (dynasty.includes("西汉") || dynasty.includes("东汉") || dynasty.includes("汉")) pushUnique(tags, "汉代");
  if (dynasty.includes("唐")) pushUnique(tags, "唐代");
  if (dynasty.includes("宋")) pushUnique(tags, "宋代");
  if (dynasty.includes("辽")) pushUnique(tags, "辽代");
  if (dynasty.includes("金")) pushUnique(tags, "金代");
  if (dynasty.includes("元")) pushUnique(tags, "元代");
  if (dynasty.includes("明")) pushUnique(tags, "明代");
  if (dynasty.includes("清")) pushUnique(tags, "清代");
  if (dynasty.includes("民国")) pushUnique(tags, "民国时期");
  if (dynasty.includes("中华人民共和")) pushUnique(tags, "现代");
  return tags;
}

function inferPeriodTagsFromTitle(name: string) {
  const tags: string[] = [];
  for (const [pattern, tag] of TITLE_PERIOD_RULES) {
    if (pattern.test(name)) pushUnique(tags, tag);
  }
  return tags;
}

function containsAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

function getArtifactKind(artifact: JsonObject) {
  const name = firstValue(artifact, FIELD_ALIASES.name);
  const category = firstValue(artifact, FIELD_ALIASES.category);
  const material = firstValue(artifact, FIELD_ALIASES.material);
  const text = `${name} ${category} ${material}`;

  if (containsAny(text, ["佛", "菩萨", "造像"])) return "religious";
  if (containsAny(text, ["书", "画", "卷", "轴", "手札", "册", "图"])) return "calligraphyPainting";
  if (containsAny(text, ["地契", "契约", "文书", "印", "印章", "石印", "符牌", "笺", "图册"])) return "documentSeal";
  if (containsAny(text, ["陶", "瓷"])) return "ceramic";
  if (containsAny(text, ["玉"])) return "jade";
  if (containsAny(text, ["铜", "青铜", "金", "银", "铁", "铳", "短剑", "金属"])) return "metal";
  if (containsAny(text, ["鼻烟壶", "生活用品", "盒", "提盒", "镇纸", "火盆", "锅"])) return "dailyObject";
  return "unknown";
}

function deriveTags(artifact: JsonObject): GeneratedTags {
  const name = firstValue(artifact, FIELD_ALIASES.name);
  const dynasty = rawFirstValue(artifact, FIELD_ALIASES.dynasty);
  const category = firstValue(artifact, FIELD_ALIASES.category);
  const material = firstValue(artifact, FIELD_ALIASES.material);
  const nameCategory = `${name} ${category}`;
  const materialCategory = `${material} ${category}`;
  const cultureTags: string[] = Array.isArray(artifact.cultureTags) ? artifact.cultureTags.map(cleanText).filter(Boolean) : [];
  const themeTags: string[] = Array.isArray(artifact.themeTags) ? artifact.themeTags.map(cleanText).filter(Boolean) : [];
  const materialTags: string[] = Array.isArray(artifact.materialTags) ? artifact.materialTags.map(cleanText).filter(Boolean) : [];
  const periodTags: string[] = Array.isArray(artifact.periodTags) ? artifact.periodTags.map(cleanText).filter(Boolean) : [];

  let inferredPeriodFromTitle = false;
  if (!isUncertainPeriod(dynasty)) {
    normalizePeriodTags(dynasty).forEach((tag) => pushUnique(periodTags, tag));
  } else {
    const inferredTags = inferPeriodTagsFromTitle(name);
    inferredPeriodFromTitle = inferredTags.length > 0;
    inferredTags.forEach((tag) => pushUnique(periodTags, tag));
  }

  if (containsAny(nameCategory, ["地契", "契约", "文书"])) {
    pushUnique(cultureTags, "社会文书");
    pushUnique(themeTags, "社会生活");
    pushUnique(themeTags, "制度文书");
  }
  if (containsAny(nameCategory, ["印", "印章", "石印", "符牌"])) {
    pushUnique(cultureTags, "印章文化");
    pushUnique(themeTags, "身份凭信");
    pushUnique(themeTags, "制度管理");
  }
  if (containsAny(materialCategory, ["铜", "青铜"]) || containsAny(nameCategory, ["青铜", "铜器", "铜镜", "铜铳", "铜锅"])) {
    pushUnique(cultureTags, "金属器文化");
    pushUnique(themeTags, "金属工艺");
  }
  if (containsAny(nameCategory, ["钱", "币"])) {
    pushUnique(cultureTags, "货币文化");
    pushUnique(themeTags, "经济交流");
  }
  if (containsAny(nameCategory, ["镜"])) {
    pushUnique(cultureTags, "铜镜文化");
    pushUnique(themeTags, "日用器物");
    pushUnique(themeTags, "审美生活");
  }
  if (containsAny(nameCategory, ["佛", "菩萨", "造像"])) {
    pushUnique(cultureTags, "佛教文化");
    pushUnique(themeTags, "宗教信仰");
  }
  if (containsAny(nameCategory, ["画", "书", "卷", "轴"])) {
    pushUnique(cultureTags, "书画艺术");
    pushUnique(themeTags, "艺术欣赏");
  }
  if (containsAny(nameCategory, ["瓷", "陶"])) {
    pushUnique(cultureTags, "陶瓷文化");
    pushUnique(themeTags, "日用器物");
    pushUnique(themeTags, "工艺技术");
  }
  if (containsAny(nameCategory, ["玉"])) {
    pushUnique(cultureTags, "玉器文化");
    pushUnique(themeTags, "礼仪审美");
  }
  if (containsAny(nameCategory, ["墓志", "碑", "铭"])) {
    pushUnique(cultureTags, "碑刻文献");
    pushUnique(themeTags, "历史记忆");
    pushUnique(themeTags, "文字记录");
  }
  if (containsAny(nameCategory, ["生活用品", "鼻烟壶", "盒", "提盒", "火盆", "锅"])) {
    pushUnique(themeTags, "日用器物");
    pushUnique(themeTags, "审美生活");
  }
  if (
    containsAny(materialCategory, ["金", "银", "铁", "铜"])
    || containsAny(nameCategory, ["青铜", "鎏金", "银质", "金质", "铁器", "铜器", "铜铳", "铜锅", "短剑"])
  ) {
    pushUnique(themeTags, "金属工艺");
  }

  splitMaterialTags(material).forEach((tag) => pushUnique(materialTags, tag));
  if (material.includes("铜")) pushUnique(materialTags, "铜");

  const lowTagConfidence = cultureTags.length === 0 && themeTags.length === 0;
  if (lowTagConfidence) pushUnique(themeTags, "馆藏精品");

  return {
    regionTag: firstValue(artifact, ["regionTag"]) || REGION_TAG,
    cultureTags: unique(cultureTags),
    themeTags: unique(themeTags),
    materialTags: unique(materialTags),
    periodTags: unique(periodTags),
    inferredPeriodFromTitle,
    lowTagConfidence,
  };
}

function compactFacts(artifact: JsonObject) {
  return {
    name: valueOrUnknown(firstValue(artifact, FIELD_ALIASES.name)),
    museumName: valueOrUnknown(firstValue(artifact, FIELD_ALIASES.museumName)),
    dynasty: rawFirstValue(artifact, FIELD_ALIASES.dynasty),
    category: firstValue(artifact, FIELD_ALIASES.category),
    level: firstValue(artifact, FIELD_ALIASES.level),
    material: firstValue(artifact, FIELD_ALIASES.material),
    dimensions: firstValue(artifact, FIELD_ALIASES.dimensions),
    remarks: firstValue(artifact, FIELD_ALIASES.remarks),
  };
}

function buildShortIntro(artifact: JsonObject, kind: ArtifactKind, generated: GeneratedTags) {
  const { dynasty, material } = compactFacts(artifact);
  const periodTag = !isUncertainPeriod(dynasty) ? normalizePeriodTags(dynasty)[0] : generated.periodTags[0];
  const periodText = periodTag ? `${periodTag}` : "";
  const materialText = material ? `，材质为${material}` : "";

  const byKind: Record<ArtifactKind, string> = {
    calligraphyPainting: `这是一件${periodText}书画类藏品，可用于理解图像表达、书写形态与审美传统。`,
    ceramic: `这是一件${periodText}陶瓷类藏品${materialText}，可观察器型、工艺与日用审美。`,
    jade: `这是一件${periodText}玉器类藏品${materialText}，可理解玉料工艺与礼仪审美。`,
    metal: `这是一件${periodText}金属器类藏品${materialText}，适合观察材质工艺与器物功能。`,
    religious: `这是一件带有宗教或造像线索的藏品，可谨慎讨论信仰表达与造型特征。`,
    documentSeal: `这是一件文书、印章或凭信相关藏品，可理解制度记录、身份凭信与社会生活。`,
    dailyObject: `这是一件生活器具相关藏品，可观察材质工艺、日常使用与审美生活。`,
    unknown: "这是辽宁省博物馆馆藏资料之一，可用于理解相关器物类型与审美取向。",
  };

  const intro = clampSentence(byKind[kind], 60);
  return intro.length >= 30 ? intro : clampSentence(`${intro.replace(/。$/, "")}，需结合权威资料复核。`, 60);
}

function factSentence(artifact: JsonObject) {
  const { name, museumName, dynasty, category, level, material, dimensions, remarks } = compactFacts(artifact);
  const details = [
    !isUncertainPeriod(dynasty) ? `时代为${dynasty}` : "",
    category ? `类别为${category}` : "",
    level ? `等级为${level}` : "",
    material ? `材质为${material}` : "",
    dimensions ? `尺寸为${dimensions}` : "",
    remarks ? `备注为${remarks}` : "",
  ].filter(Boolean);
  return `${name}收藏于${museumName}${details.length ? `，现有字段记录${details.join("，")}` : ""}。`;
}

function buildDescription(artifact: JsonObject, kind: ArtifactKind, generated: GeneratedTags) {
  const { name, dynasty, category, material, remarks } = compactFacts(artifact);
  const periodText = !isUncertainPeriod(dynasty)
    ? `时代字段记录为${dynasty}`
    : generated.periodTags.length
      ? `题名中出现时代线索，可暂作${generated.periodTags.join("、")}相关材料观察，但需权威资料核定`
      : "时代信息仍需权威资料补充";
  const categoryText = category ? `类别为${category}` : "类别信息暂未明确";
  const materialText = material ? `材质记录为${material}` : "材质信息暂未明确";
  const remarkText = remarks ? `备注显示“${remarks}”，可作为保存状态或来源线索参考。` : "备注信息暂缺，保存状态和来源线索仍需复核。";

  const openings: Record<ArtifactKind, string> = {
    calligraphyPainting: `${name}可归入书画类资料观察，${periodText}，${categoryText}。其题名和形制信息有助于理解图像表达、书写形态与审美传统，但当前数据未提供作者生平、流传经历或题跋释文，相关阐释应保持谨慎。`,
    ceramic: `${name}可作为陶瓷类器物资料整理，${periodText}，${categoryText}，${materialText}。现有信息适合用于观察器型、材质工艺、日常使用和审美特征；如窑口、产地或具体用途未见字段记录，不宜作确定性判断。`,
    jade: `${name}可作为玉器类资料观察，${periodText}，${categoryText}，${materialText}。它适合从玉料、造型、装饰性和礼仪审美角度进行初步整理；具体礼制用途、使用者身份和出土背景仍需馆方或考古资料确认。`,
    metal: `${name}可作为金属器类资料整理，${periodText}，${categoryText}，${materialText}。现有字段可支持对器类、材质工艺和可能使用场景的基础检索；若无铭文、出土地点或制度背景记录，不应进一步推断具体历史事件。`,
    religious: `${name}的题名或类别中包含宗教、造像相关线索，${periodText}，${categoryText}。它可作为理解宗教图像、造型方式与信仰表达的材料之一；若未给出明确尊名、姿态或供奉背景，不宜擅自判定具体身份。`,
    documentSeal: `${name}适合按文书、印章或凭信类资料整理，${periodText}，${categoryText}，${materialText}。这类藏品通常可为制度运行、身份确认、社会生活或档案记录提供线索；具体文本内容和使用场景仍需权威释读。`,
    dailyObject: `${name}可作为生活器具相关资料观察，${periodText}，${categoryText}，${materialText}。现有字段适合支持对器物功能、材质工艺、日常使用和审美生活的检索；具体使用者和流传背景仍需补充来源。`,
    unknown: `${name}是辽宁省博物馆馆藏资料之一，${periodText}，${categoryText}，${materialText}。在缺少更完整来源说明前，可将其作为理解相关时期器物类型、材质工艺和馆藏结构的材料之一，避免扩大解释。`,
  };

  const text = `${openings[kind]}${remarkText}当前未提供出土地点、历史事件或人物故事说明，后续应结合权威来源继续补充。`;
  const normalized = normalizeSentence(text);
  return normalized.length > 200 ? `${normalized.slice(0, 199)}。` : normalized;
}

function buildRagText(artifact: JsonObject, generated: GeneratedTags) {
  const tags = Array.isArray(artifact.tags) ? artifact.tags.map(cleanText).filter((item) => item && item !== UNKNOWN) : [];
  const rows = [
    ["文物名称", valueOrUnknown(firstValue(artifact, FIELD_ALIASES.name))],
    ["所属博物馆", valueOrUnknown(firstValue(artifact, FIELD_ALIASES.museumName))],
    ["朝代", valueOrUnknown(rawFirstValue(artifact, FIELD_ALIASES.dynasty))],
    ["类别", valueOrUnknown(firstValue(artifact, FIELD_ALIASES.category))],
    ["等级", valueOrUnknown(firstValue(artifact, FIELD_ALIASES.level))],
    ["材质", valueOrUnknown(firstValue(artifact, FIELD_ALIASES.material))],
    ["尺寸", valueOrUnknown(firstValue(artifact, FIELD_ALIASES.dimensions))],
    ["备注", valueOrUnknown(firstValue(artifact, FIELD_ALIASES.remarks))],
    ["一句话简介", valueOrUnknown(firstValue(artifact, FIELD_ALIASES.shortIntro))],
    ["详细介绍", valueOrUnknown(firstValue(artifact, FIELD_ALIASES.description))],
    ["原始标签", tags.length ? tags.join("、") : UNKNOWN],
    ["地域标签", generated.regionTag],
    ["文化标签", generated.cultureTags.length ? generated.cultureTags.join("、") : UNKNOWN],
    ["主题标签", generated.themeTags.length ? generated.themeTags.join("、") : UNKNOWN],
    ["材质标签", generated.materialTags.length ? generated.materialTags.join("、") : UNKNOWN],
    ["时代标签", generated.periodTags.length ? generated.periodTags.join("、") : UNKNOWN],
    ["需要人工审核", cleanText(artifact.needsHumanReview) || "true"],
    ["审核标记", Array.isArray(artifact.reviewFlags) ? artifact.reviewFlags.join("、") : UNKNOWN],
  ];
  return rows.map(([label, value]) => `${label}：${value}`).join("\n");
}

function buildWorkflowSummary(artifact: JsonObject, generated: GeneratedTags) {
  const { name, dynasty, category, material } = compactFacts(artifact);
  const period = !isUncertainPeriod(dynasty) ? dynasty : generated.periodTags.length ? `${generated.periodTags.join("、")}待核` : UNKNOWN;
  const themes = generated.themeTags.filter((tag) => tag !== "馆藏精品").slice(0, 3);
  const themeText = themes.length ? themes.join("、") : "馆藏资料整理";
  let summary = `${name}为辽宁省博物馆馆藏文物，时代信息为${period}，类别${category || "待补"}，材质${material || "待补"}。可用于${themeText}相关策展线索，具体解释需权威资料复核。`;
  if (summary.length < 50) summary += "适合作为知识库冷启动和人工审核样本。";
  if (summary.length > 100) summary = `${summary.slice(0, 99)}。`;
  return normalizeSentence(summary);
}

function buildCuratorNote(generated: GeneratedTags) {
  const cultures = generated.cultureTags;
  const themes = generated.themeTags;

  if (cultures.includes("佛教文化") && themes.includes("宗教信仰")) {
    return "适合用于佛教艺术、宗教信仰与相关社会文化主题展览。";
  }
  if (cultures.includes("社会文书") && themes.includes("制度文书")) {
    return "适合用于社会生活、契约制度、地方治理与档案文献相关主题展览。";
  }
  if (cultures.includes("印章文化") && themes.includes("身份凭信")) {
    return "适合用于身份凭信、制度管理与文字材料相关主题展览。";
  }
  if (cultures.includes("金属器文化") && themes.includes("金属工艺")) {
    return "适合用于金属工艺、器物制度与古代生活方式相关主题展览。";
  }
  if (cultures.includes("书画艺术") && themes.includes("艺术欣赏")) {
    return "适合用于书画艺术、图像表达与审美传统相关主题展览。";
  }
  if (cultures.includes("陶瓷文化") && themes.includes("工艺技术")) {
    return "适合用于陶瓷工艺、日用器物与审美生活相关主题展览。";
  }
  if (cultures.includes("玉器文化") && themes.includes("礼仪审美")) {
    return "适合用于玉器工艺、礼仪审美与材质文化相关主题展览。";
  }
  if (themes.includes("日用器物")) {
    return "适合用于日用器物、生活方式与审美生活相关主题展览。";
  }
  return "适合用于辽宁省博物馆馆藏精品与地方文化展示相关主题展览。";
}

function buildSourceName(artifact: JsonObject) {
  const existing = firstValue(artifact, FIELD_ALIASES.sourceName);
  if (existing) return existing;
  const sourceFile = firstValue(artifact, ["sourceFile"]);
  return sourceFile ? `辽宁省博物馆导入数据（${sourceFile}）` : "辽宁省博物馆导入数据";
}

function buildRelationSeeds(artifact: JsonObject, generated: GeneratedTags) {
  const seeds: ArtifactRelationSeed[] = [];
  const museumName = firstValue(artifact, FIELD_ALIASES.museumName);
  const dynasty = rawFirstValue(artifact, FIELD_ALIASES.dynasty);
  const category = firstValue(artifact, FIELD_ALIASES.category);

  for (const tag of generated.cultureTags) {
    seeds.push({ relationType: "同文化主题", value: tag, relationReason: `共享文化标签：${tag}` });
  }
  for (const tag of generated.themeTags.filter((item) => item !== "馆藏精品")) {
    seeds.push({ relationType: "同策展主题", value: tag, relationReason: `共享策展主题：${tag}` });
  }
  for (const tag of generated.periodTags) {
    seeds.push({ relationType: "同时代", value: tag, relationReason: `共享时代标签：${tag}` });
  }
  if (category) seeds.push({ relationType: "同类别", value: category, relationReason: `类别同为：${category}` });
  for (const tag of generated.materialTags) {
    seeds.push({ relationType: "同材质", value: tag, relationReason: `共享材质标签：${tag}` });
  }
  if (museumName) seeds.push({ relationType: "同馆藏", value: museumName, relationReason: `同属馆藏：${museumName}` });
  if (!isUncertainPeriod(dynasty) && !generated.periodTags.length) {
    seeds.push({ relationType: "同时代", value: dynasty, relationReason: `共享朝代字段：${dynasty}` });
  }

  return seeds;
}

function setIfMissing(record: JsonObject, key: string, value: unknown) {
  if (!hasUsableValue(record[key])) record[key] = value;
}

function buildReviewFlags(originalArtifact: JsonObject, artifact: JsonObject, generated: GeneratedTags, curatorNote: string) {
  const flags: string[] = [];
  const sourceUrl = rawFirstValue(originalArtifact, FIELD_ALIASES.sourceUrl);
  const originalDescription = rawFirstValue(originalArtifact, FIELD_ALIASES.description);
  const dynasty = rawFirstValue(originalArtifact, FIELD_ALIASES.dynasty);
  const name = firstValue(artifact, FIELD_ALIASES.name);

  if (!hasUsableValue(sourceUrl)) pushUnique(flags, "missing_source_url");
  if (!hasUsableValue(originalDescription)) pushUnique(flags, "missing_description_source");
  pushUnique(flags, "template_generated_description");
  if (generated.lowTagConfidence) pushUnique(flags, "low_tag_confidence");
  if (generated.inferredPeriodFromTitle) {
    pushUnique(flags, "period_in_title_but_missing_dynasty");
    pushUnique(flags, "uncertain_period");
  }
  if (isUncertainPeriod(dynasty) && !generated.periodTags.length) pushUnique(flags, "uncertain_period");
  if (curatorNote.includes("馆藏精品与地方文化展示")) pushUnique(flags, "generic_curator_note");
  if (name.includes("□")) pushUnique(flags, "needs_authority_check");
  pushUnique(flags, "needs_authority_check");

  return flags;
}

function enrichArtifact(artifact: JsonObject) {
  const enriched = { ...artifact };
  const kind = getArtifactKind(enriched);
  const generated = deriveTags(enriched);

  setIfMissing(enriched, "shortIntro", buildShortIntro(enriched, kind, generated));
  setIfMissing(enriched, "description", buildDescription(enriched, kind, generated));
  setIfMissing(enriched, "sourceName", buildSourceName(enriched));
  setIfMissing(enriched, "sourceUrl", firstValue(enriched, FIELD_ALIASES.sourceUrl) || UNKNOWN);
  setIfMissing(
    enriched,
    "copyrightNote",
    "仅用于 MuseLink 数据整理、检索与研究展示；图片及原始馆藏信息的版权和使用授权以原始来源说明为准。",
  );

  enriched.regionTag = generated.regionTag;
  enriched.cultureTags = generated.cultureTags;
  enriched.themeTags = generated.themeTags;
  enriched.materialTags = generated.materialTags;
  enriched.periodTags = generated.periodTags;
  enriched.relationSeeds = buildRelationSeeds(enriched, generated);

  setIfMissing(enriched, "workflowSummary", buildWorkflowSummary(enriched, generated));
  setIfMissing(enriched, "curatorNote", buildCuratorNote(generated));
  setIfMissing(enriched, "displayPriority", 1);
  if (typeof enriched.isCuratable !== "boolean") enriched.isCuratable = true;

  const reviewFlags = buildReviewFlags(artifact, enriched, generated, cleanText(enriched.curatorNote));
  enriched.reviewFlags = reviewFlags;
  enriched.needsHumanReview = reviewFlags.length > 0;
  setIfMissing(enriched, "ragText", buildRagText(enriched, generated));

  return enriched;
}

function relationConfidence(relationType: string) {
  const confidenceByType: Record<string, number> = {
    同文化主题: 0.88,
    同策展主题: 0.84,
    同时代: 0.76,
    同类别: 0.72,
    同材质: 0.7,
    同馆藏: 0.55,
  };
  return confidenceByType[relationType] ?? 0.65;
}

function relationPriority(relationType: string) {
  const priorityByType: Record<string, number> = {
    同文化主题: 1,
    同策展主题: 2,
    同时代: 3,
    同类别: 4,
    同材质: 5,
    同馆藏: 6,
  };
  return priorityByType[relationType] ?? 9;
}

function getArtifactId(artifact: JsonObject, index: number) {
  return firstValue(artifact, FIELD_ALIASES.id) || `artifact-${index}`;
}

function buildRelationCandidates(artifacts: JsonObject[]): RelationCandidate[] {
  const potentials: RelationCandidate[] = [];
  const groupMap = new Map<string, Array<{ artifactId: string }>>();

  artifacts.forEach((artifact, index) => {
    const artifactId = getArtifactId(artifact, index);
    const seeds = Array.isArray(artifact.relationSeeds) ? artifact.relationSeeds as ArtifactRelationSeed[] : [];
    for (const seed of seeds) {
      if (!seed.relationType || !seed.value) continue;
      const groupKey = `${seed.relationType}::${seed.value}`;
      const members = groupMap.get(groupKey) ?? [];
      members.push({ artifactId });
      groupMap.set(groupKey, members);
    }
  });

  for (const [groupKey, members] of groupMap.entries()) {
    if (members.length < 2) continue;
    const [relationType, value] = groupKey.split("::");
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        const source = members[i];
        const target = members[j];
        potentials.push({
          sourceArtifactId: source.artifactId,
          targetArtifactId: target.artifactId,
          relationType,
          relationReason: `${relationType}：共享“${value}”`,
          confidence: relationConfidence(relationType),
        });
      }
    }
  }

  potentials.sort((a, b) => {
    const priorityDiff = relationPriority(a.relationType) - relationPriority(b.relationType);
    if (priorityDiff !== 0) return priorityDiff;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (a.sourceArtifactId !== b.sourceArtifactId) return a.sourceArtifactId.localeCompare(b.sourceArtifactId, "zh-CN");
    if (a.targetArtifactId !== b.targetArtifactId) return a.targetArtifactId.localeCompare(b.targetArtifactId, "zh-CN");
    return a.relationType.localeCompare(b.relationType, "zh-CN");
  });

  const relationCounts = new Map<string, number>();
  const seen = new Set<string>();
  const selected: RelationCandidate[] = [];

  for (const relation of potentials) {
    const pair = [relation.sourceArtifactId, relation.targetArtifactId].sort().join("::");
    const key = `${pair}::${relation.relationType}`;
    if (seen.has(key)) continue;
    if ((relationCounts.get(relation.sourceArtifactId) ?? 0) >= MAX_RELATIONS_PER_ARTIFACT) continue;
    if ((relationCounts.get(relation.targetArtifactId) ?? 0) >= MAX_RELATIONS_PER_ARTIFACT) continue;

    seen.add(key);
    selected.push(relation);
    relationCounts.set(relation.sourceArtifactId, (relationCounts.get(relation.sourceArtifactId) ?? 0) + 1);
    relationCounts.set(relation.targetArtifactId, (relationCounts.get(relation.targetArtifactId) ?? 0) + 1);
  }

  return selected;
}

function buildRagDocument(artifact: JsonObject, index: number): RagDocument {
  return {
    id: getArtifactId(artifact, index),
    title: valueOrUnknown(firstValue(artifact, FIELD_ALIASES.name)),
    museumName: valueOrUnknown(firstValue(artifact, FIELD_ALIASES.museumName)),
    text: valueOrUnknown(firstValue(artifact, ["ragText"])),
    metadata: {
      dynasty: valueOrUnknown(rawFirstValue(artifact, FIELD_ALIASES.dynasty)),
      category: valueOrUnknown(firstValue(artifact, FIELD_ALIASES.category)),
      regionTag: cleanText(artifact.regionTag) || REGION_TAG,
      cultureTags: Array.isArray(artifact.cultureTags) ? artifact.cultureTags.map(cleanText).filter(Boolean) : [],
      themeTags: Array.isArray(artifact.themeTags) ? artifact.themeTags.map(cleanText).filter(Boolean) : [],
      materialTags: Array.isArray(artifact.materialTags) ? artifact.materialTags.map(cleanText).filter(Boolean) : [],
      periodTags: Array.isArray(artifact.periodTags) ? artifact.periodTags.map(cleanText).filter(Boolean) : [],
      sourceUrl: valueOrUnknown(rawFirstValue(artifact, FIELD_ALIASES.sourceUrl)),
      needsHumanReview: artifact.needsHumanReview === true,
      reviewFlags: Array.isArray(artifact.reviewFlags) ? artifact.reviewFlags.map(cleanText).filter(Boolean) : [],
      isCuratable: artifact.isCuratable !== false,
    },
  };
}

async function readJson<T>(filePath: string): Promise<T> {
  const text = await fs.readFile(filePath, "utf-8");
  return JSON.parse(text) as T;
}

async function main() {
  const artifactsDoc = await readJson<JsonObject>(ARTIFACTS_PATH);
  const artifacts = Array.isArray(artifactsDoc.artifacts) ? artifactsDoc.artifacts as JsonObject[] : [];
  const enrichedArtifacts = artifacts.map(enrichArtifact);
  const relationCandidates = buildRelationCandidates(enrichedArtifacts);
  const ragDocuments = enrichedArtifacts.map(buildRagDocument);

  await fs.mkdir(path.dirname(RAG_DOCS_PATH), { recursive: true });
  await fs.writeFile(
    AI_READY_PATH,
    `${JSON.stringify({
      ...artifactsDoc,
      artifacts: enrichedArtifacts,
      aiPrep: {
        version: "v2",
        generatedAt: new Date().toISOString(),
        sourceFile: "data/imported-artifacts.json",
        artifactCount: enrichedArtifacts.length,
        note: "AI-ready v2 派生文件；未覆盖原始 imported-artifacts.json 或 v1 AI-ready 文件。",
      },
    }, null, 2)}\n`,
    "utf-8",
  );
  await fs.writeFile(RELATION_SEEDS_PATH, `${JSON.stringify(relationCandidates, null, 2)}\n`, "utf-8");
  await fs.writeFile(RAG_DOCS_PATH, `${ragDocuments.map((doc) => JSON.stringify(doc)).join("\n")}\n`, "utf-8");

  console.log(JSON.stringify({
    version: "v2",
    sourceArtifacts: artifacts.length,
    aiReadyArtifacts: enrichedArtifacts.length,
    relationCandidates: relationCandidates.length,
    ragDocuments: ragDocuments.length,
    outputs: {
      aiReady: path.relative(ROOT, AI_READY_PATH),
      relationSeeds: path.relative(ROOT, RELATION_SEEDS_PATH),
      ragDocuments: path.relative(ROOT, RAG_DOCS_PATH),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
