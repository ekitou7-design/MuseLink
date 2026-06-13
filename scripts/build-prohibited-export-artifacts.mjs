import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "imports", "prohibited-export-artifacts.json");
const IMPORTED_PATH = path.join(ROOT, "data", "imported-artifacts.json");
const WIKI_API =
  "https://zh.wikipedia.org/w/api.php?action=query&prop=revisions&titles=%E7%A6%81%E6%AD%A2%E5%87%BA%E5%A2%83%E5%B1%95%E8%A7%88%E6%96%87%E7%89%A9&rvprop=content&format=json&formatversion=2&origin=*";

const BATCHES = [
  {
    tableIndex: 1,
    expected: 64,
    batchNo: 1,
    batch: "第一批禁止出国（境）展览文物",
    sourceName: "国家文物局关于印发《首批禁止出国（境）展览文物目录》的通知",
    sourceUrl: "http://qikan.cqvip.com/Qikan/Article/Detail?id=11786366",
  },
  {
    tableIndex: 2,
    expected: 37,
    batchNo: 2,
    batch: "第二批禁止出国（境）展览文物（书画类）",
    sourceName: "关于发布《第二批禁止出国（境）展览文物目录（书画类）》的通知（文物博函〔2012〕1345号）",
    sourceUrl: "http://www.ncha.gov.cn/art/2012/6/26/art_2237_23608.html",
  },
  {
    tableIndex: 3,
    expected: 94,
    batchNo: 3,
    batch: "第三批禁止出境展览文物",
    sourceName: "关于发布《第三批禁止出境展览文物目录》的通知（文物博函〔2013〕1320号）",
    sourceUrl: "http://www.ncha.gov.cn/art/2013/8/19/art_2237_23647.html",
  },
];

const CATEGORY_TAGS = new Set(["青铜器", "陶瓷", "玉器", "杂项"]);
const CONTROLLED_MATERIAL_TAGS = new Set([
  "青铜器",
  "青铜",
  "陶瓷",
  "陶器",
  "玉器",
  "玉",
  "书画",
  "纸本/绢本书画",
  "杂项",
  "金银",
  "漆木",
  "石质",
  "玻璃",
  "纸绢/织物",
]);

const PROVINCE_BY_MUSEUM = [
  ["故宫博物院", "北京"],
  ["中国国家博物馆", "北京"],
  ["首都博物馆", "北京"],
  ["北京大学", "北京"],
  ["天津博物馆", "天津"],
  ["河北博物院", "河北"],
  ["山西博物院", "山西"],
  ["辽宁省博物馆", "辽宁"],
  ["上海博物馆", "上海"],
  ["南京博物院", "江苏"],
  ["苏州博物馆", "江苏"],
  ["浙江省博物馆", "浙江"],
  ["安徽博物院", "安徽"],
  ["福建博物院", "福建"],
  ["江西省博物馆", "江西"],
  ["山东博物馆", "山东"],
  ["河南博物院", "河南"],
  ["湖北省博物馆", "湖北"],
  ["湖南省博物馆", "湖南"],
  ["广东省博物馆", "广东"],
  ["广西壮族自治区博物馆", "广西"],
  ["重庆中国三峡博物馆", "重庆"],
  ["四川博物院", "四川"],
  ["三星堆博物馆", "四川"],
  ["成都金沙遗址博物馆", "四川"],
  ["贵州省博物馆", "贵州"],
  ["云南省博物馆", "云南"],
  ["西藏博物馆", "西藏"],
  ["陕西历史博物馆", "陕西"],
  ["陕西省考古研究院", "陕西"],
  ["秦始皇帝陵博物院", "陕西"],
  ["西安碑林博物馆", "陕西"],
  ["甘肃省博物馆", "甘肃"],
  ["青海省博物馆", "青海"],
  ["宁夏博物馆", "宁夏"],
  ["新疆维吾尔自治区博物馆", "新疆"],
];

function text(value) {
  return String(value ?? "").trim();
}

function decodeEntities(value) {
  return text(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function cleanWiki(value) {
  let output = text(value);
  output = output.replace(/<!--[\s\S]*?-->/g, "");
  output = output.replace(/<ref[\s\S]*?<\/ref>/g, "");
  output = output.replace(/<ref[^>]*\/>/g, "");
  output = output.replace(/<br\s*\/?>/gi, "、");
  output = output.replace(/\[\[(?:File|文件|Image):[^\]]+\]\]/gi, "");
  for (let i = 0; i < 8; i += 1) {
    output = output.replace(/\{\{([^{}]+)\}\}/g, (_, body) => {
      const parts = body.split("|").map(text);
      if (parts[0] === "僻字") return parts[1] || "";
      return parts.find((part, index) => index > 0 && part && !part.includes("=")) || "";
    });
  }
  output = output.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2");
  output = output.replace(/\[\[([^\]]+)\]\]/g, "$1");
  output = output.replace(/'{2,}/g, "");
  output = output.replace(/<[^>]+>/g, "");
  output = decodeEntities(output);
  return output.replace(/\s+/g, " ").replace(/[，,]\s*$/g, "").trim();
}

function normalizeName(value) {
  return cleanWiki(value).replace(/\s+/g, "").replace(/[（(]一套\d+件[）)]/g, "");
}

function parseCell(part) {
  let value = text(part);
  let attrs = "";
  const barIndex = value.indexOf("|");
  const attrCandidate = barIndex >= 0 ? value.slice(0, barIndex) : "";
  if (/\b(rowspan|colspan|style|class|scope|align|width)\b/i.test(attrCandidate)) {
    attrs = attrCandidate;
    value = value.slice(barIndex + 1).trim();
  }
  const rowspan = Number((attrs.match(/rowspan\s*=\s*"?(\d+)/i) || [])[1] || 1);
  const colspan = Number((attrs.match(/colspan\s*=\s*"?(\d+)/i) || [])[1] || 1);
  return { raw: value, rowspan, colspan };
}

function splitCells(row) {
  const cells = [];
  for (const line of row.split("\n")) {
    if (!line.startsWith("|") && !line.startsWith("!")) continue;
    if (line.startsWith("|-") || line.startsWith("|}")) continue;
    const body = line.slice(1);
    const separator = line.startsWith("!") ? /\s*!!\s*/g : /\s*\|\|\s*/g;
    for (const part of body.split(separator)) {
      cells.push(parseCell(part));
    }
  }
  return cells;
}

function materialFrom(name, category, batchNo) {
  if (batchNo === 2) return "纸本/绢本书画";
  if (category === "青铜器") return "青铜";
  if (category === "陶瓷") return "陶瓷";
  if (category === "玉器") return "玉";
  if (/陶|彩绘|俑/.test(name)) return "陶";
  if (/瓷|釉|窑|瓶|碗|盘|杯|罐|枕/.test(name)) return "陶瓷";
  if (/青铜|铜|鼎|簋|尊|盘|钟|鬲|壶|盉|觥|卣|戈|剑|灯|炉/.test(name)) return "青铜";
  if (/玉|璧|琮|璜|佩|玦/.test(name)) return "玉";
  if (/金|银/.test(name)) return "金银";
  if (/漆/.test(name)) return "漆木";
  if (/锦|绢|帛|纱|绣|缂丝|书|画|帖|卷|经|简/.test(name)) return "纸绢/织物";
  if (/石|碑|砖|画像/.test(name)) return "石质";
  if (/玻璃/.test(name)) return "玻璃";
  return category === "杂项" ? "杂项" : "";
}

function categoryFrom(name, tableCategory, batchNo) {
  if (batchNo === 2) return "书画";
  if (tableCategory) return tableCategory;
  if (/陶|瓷|釉|窑|俑|器座|缸|罐|瓶|碗|杯|枕/.test(name)) return "陶瓷";
  if (/鼎|簋|尊|盘|钟|鬲|壶|盉|觥|卣|青铜|铜/.test(name)) return "青铜器";
  if (/玉|璧|琮|璜|佩|玦/.test(name)) return "玉器";
  if (/书|画|帖|卷|经|帛|锦|简/.test(name)) return "书画/文献";
  return "杂项";
}

function provinceFromMuseum(museum) {
  const hit = PROVINCE_BY_MUSEUM.find(([needle]) => text(museum).includes(needle));
  return hit?.[1] || "";
}

function filePathFromRow(rawRow) {
  const match = rawRow.match(/\[\[(?:File|文件|Image):([^|\]]+)/i);
  if (!match) return "";
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(cleanWiki(match[1]))}`;
}

function parseTable(table, batchInfo) {
  const rows = table.split(/\n(?=\|-)/).slice(1);
  const spans = [];
  const items = [];
  const seenNames = new Set();
  let currentThirdCategory = "";

  for (const rawRow of rows) {
    const parsedCells = splitCells(rawRow);
    const logical = [];
    for (let index = 0; index < spans.length; index += 1) {
      const active = spans[index];
      if (active && active.left > 0) {
        logical[index] = active.cell;
        active.left -= 1;
      }
    }

    let col = 0;
    for (const cell of parsedCells) {
      while (logical[col]) col += 1;
      for (let i = 0; i < cell.colspan; i += 1) {
        logical[col + i] = cell;
        if (cell.rowspan > 1) {
          spans[col + i] = { cell, left: cell.rowspan - 1 };
        }
      }
      col += cell.colspan;
    }

    const firstRaw = logical[0]?.raw || "";
    const first = cleanWiki(firstRaw);
    if (["青铜器类", "陶瓷类", "玉器类", "杂项类"].includes(first)) {
      currentThirdCategory = first.replace(/类$/, "");
      continue;
    }
    if (!firstRaw.includes("[[")) continue;

    const name = cleanWiki(firstRaw);
    if (!name || name === "名称") continue;
    const nameKey = normalizeName(name);
    if (seenNames.has(nameKey)) continue;
    seenNames.add(nameKey);

    let period = "";
    let originPlace = "";
    let excavatedAt = "";
    let museum = "";

    if (batchInfo.batchNo === 2) {
      period = cleanWiki(logical[1]?.raw);
      museum = cleanWiki(logical[2]?.raw);
    } else {
      period = cleanWiki(logical[1]?.raw);
      if (batchInfo.batchNo === 1) {
        originPlace = cleanWiki(logical[2]?.raw);
        excavatedAt = cleanWiki(logical[3]?.raw);
        museum = cleanWiki(logical[4]?.raw);
      } else {
        excavatedAt = cleanWiki(logical[2]?.raw);
        originPlace = cleanWiki(logical[3]?.raw);
        museum = cleanWiki(logical[4]?.raw);
      }
    }

    const tableCategory = batchInfo.batchNo === 3 ? currentThirdCategory : "";
    const category = categoryFrom(name, tableCategory, batchInfo.batchNo);
    const material = materialFrom(name, category, batchInfo.batchNo);
    const origin = [originPlace, excavatedAt ? `${excavatedAt}出土` : ""].filter(Boolean).join("，");

    items.push({
      name,
      dynasty: period,
      period,
      category,
      material,
      museum,
      province: provinceFromMuseum(museum),
      origin,
      imageUrl: filePathFromRow(rawRow),
      imageSource: filePathFromRow(rawRow) ? "维基共享资源/维基百科目录图片" : "",
      ...batchInfo,
    });
  }

  return items;
}

async function readExistingArtifacts() {
  try {
    const raw = await fs.readFile(IMPORTED_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed.artifacts || [];
  } catch {
    return [];
  }
}

function hasUsefulImage(value) {
  const url = text(value);
  if (!/^https?:\/\//.test(url)) return false;
  if (/placeholder|example/i.test(url)) return false;
  if (/(ncha\.gov\.cn\/art\/|qikan\.cqvip\.com|cflac\.org\.cn|wenbao\.net)/i.test(url)) return false;
  return true;
}

function unionTags(...sets) {
  return Array.from(new Set(sets.flat().map(text).filter(Boolean)));
}

function keepExistingTag(tag, item) {
  const value = text(tag);
  if (!CONTROLLED_MATERIAL_TAGS.has(value)) return true;
  if (value === item.category || value === item.material) return true;
  if (item.category === "陶瓷" && value === "陶器") return true;
  return false;
}

function buildDescription(item) {
  const where = item.museum ? `，现藏于${item.museum}` : "";
  const origin = item.origin ? `，目录记录出土信息为${item.origin}` : "";
  return `${item.name}列入${item.batch}，时代为${item.period || "待考"}${where}${origin}。它是国家明确限制出境展览的一级文物，适合用于呈现中国古代文明的制度、工艺与审美记忆。`;
}

function buildSignificance(item) {
  return `其被列入${item.batch}，说明文物具有稀缺性和重要历史、艺术、科学价值。可作为AI策展中连接时代、地域、材质与国家记忆的核心展品。`;
}

function enrichWithExisting(items, existingArtifacts) {
  const existingByName = new Map();
  for (const artifact of existingArtifacts) {
    const name = normalizeName(artifact.name || artifact["文物名称"]);
    if (name && !existingByName.has(name)) existingByName.set(name, artifact);
  }

  return items.map((item, index) => {
    const existing = existingByName.get(normalizeName(item.name));
    const existingTags = Array.isArray(existing?.tags) ? existing.tags.filter((tag) => keepExistingTag(tag, item)) : [];
    const secondBatchTags = item.batchNo === 2 ? ["古代书画", "书画"] : [];
    const thirdCategoryTags = item.batchNo === 3 && CATEGORY_TAGS.has(item.category) ? [item.category] : [];
    const tags = unionTags(existingTags, [
      "禁止出国（境）展览文物",
      "一级文物",
      "国宝级文物",
      item.batch,
      item.batch.includes("禁止出境") ? "禁止出境展览文物" : "禁止出国展览文物",
      item.category,
      item.material,
      ...secondBatchTags,
      ...thirdCategoryTags,
    ]);

    const imageUrl = hasUsefulImage(existing?.imageUrl) ? existing.imageUrl : item.imageUrl;
    const museum = text(existing?.museum) || item.museum || "unknown";
    const description = text(existing?.description).length >= 80 ? text(existing.description) : buildDescription({ ...item, museum });
    const significance = buildSignificance(item);

    return {
      id: text(existing?.id) || `prohibited-export-${item.batchNo}-${String(index + 1).padStart(3, "0")}`,
      name: item.name,
      batchNo: item.batchNo,
      dynasty: item.dynasty,
      period: item.period,
      category: item.category,
      material: item.material,
      museum,
      province: item.province || provinceFromMuseum(museum),
      origin: item.origin,
      description,
      shortIntro: `${item.batch}：${item.category || "文物"}，${item.period || "时代待考"}。`,
      significance,
      tags,
      batch: item.batch,
      sourceUrl: item.sourceUrl,
      sourceName: item.sourceName,
      imageUrl,
      imageSource: imageUrl === item.imageUrl && item.imageSource ? item.imageSource : text(existing?.imageSource || existing?.图片来源),
      culture: "中华文化",
      level: "一级文物",
      favsCount: Number(existing?.favsCount) || 0,
      attributes: [
        {
          group: "禁止出境展览信息",
          items: [
            { name: "批次", value: item.batch },
            { name: "目录来源", value: item.sourceName },
            { name: "来源链接", value: item.sourceUrl },
            { name: "省份", value: item.province || provinceFromMuseum(museum) || "unknown" },
            { name: "图片来源", value: imageUrl ? (item.imageSource || "既有馆藏图片") : "" },
            { name: "策展价值", value: significance },
          ].filter((entry) => entry.value),
        },
      ],
    };
  });
}

async function build() {
  const wiki = await fetch(WIKI_API).then((response) => {
    if (!response.ok) throw new Error(`抓取目录失败：${response.status}`);
    return response.json();
  });
  const content = wiki.query.pages[0].revisions[0].content;
  const tables = Array.from(content.matchAll(/\{\|[\s\S]*?\n\|\}/g)).map((match) => match[0]);
  const parsed = BATCHES.flatMap((batch) => parseTable(tables[batch.tableIndex], batch));

  for (const batch of BATCHES) {
    const count = parsed.filter((item) => item.batchNo === batch.batchNo).length;
    if (count !== batch.expected) {
      throw new Error(`${batch.batch} 解析到 ${count} 条，期望 ${batch.expected} 条。`);
    }
  }

  const records = enrichWithExisting(parsed, await readExistingArtifacts());
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(
    OUTPUT_PATH,
    JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        sourcePage: "https://zh.wikipedia.org/wiki/禁止出境展览文物",
        sourceNote: "目录名称按国家文物局通知条目整理；页面引用保留国家文物局/通知来源。",
        counts: {
          first: records.filter((item) => item.batchNo === 1).length,
          second: records.filter((item) => item.batchNo === 2).length,
          third: records.filter((item) => item.batchNo === 3).length,
          total: records.length,
          withImageUrl: records.filter((item) => hasUsefulImage(item.imageUrl)).length,
          withoutImageUrl: records.filter((item) => !hasUsefulImage(item.imageUrl)).length,
        },
        records,
      },
      null,
      2,
    ),
    "utf-8",
  );

  return { records, outputPath: OUTPUT_PATH };
}

async function runImport(records) {
  const apiBase = process.env.API_BASE_URL || "http://localhost:3000";
  const job = {
    sourceName: "三批禁止出国/出境展览文物目录",
    sourceType: "inline",
    format: "json",
    records,
    mode: "append",
    persistTo: ["file"],
    mapping: {
      id: "id",
      name: "name",
      museum: "museum",
      period: "period",
      material: "material",
      culture: "culture",
      origin: "origin",
      shortIntro: "shortIntro",
      description: "description",
      imageUrl: "imageUrl",
      sourceUrl: "sourceUrl",
      attributes: "attributes",
      tags: "tags",
      favsCount: "favsCount",
      category: "category",
      level: "level",
    },
  };
  const response = await fetch(`${apiBase}/api/import/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(job),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(`导入失败：${JSON.stringify(result)}`);
  }
  return result;
}

const { records, outputPath } = await build();
const counts = {
  first: records.filter((item) => item.batchNo === 1).length,
  second: records.filter((item) => item.batchNo === 2).length,
  third: records.filter((item) => item.batchNo === 3).length,
  total: records.length,
  withImageUrl: records.filter((item) => hasUsefulImage(item.imageUrl)).length,
  withoutImageUrl: records.filter((item) => !hasUsefulImage(item.imageUrl)).length,
};

console.log(JSON.stringify({ outputPath, counts }, null, 2));

if (process.argv.includes("--import")) {
  const result = await runImport(records);
  console.log(
    JSON.stringify(
      {
        importResult: {
          sourceName: result.sourceName,
          totalRecords: result.totalRecords,
          validRecords: result.validRecords,
          skippedRecords: result.skippedRecords,
          fileStoreCount: result.fileStoreCount,
          dbSync: result.dbSync,
        },
      },
      null,
      2,
    ),
  );
}
