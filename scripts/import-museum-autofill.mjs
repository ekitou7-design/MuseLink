import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const INPUT_PATH = process.argv[2];
const IMPORTED_MUSEUMS_PATH = path.join(process.cwd(), "data", "imported-museums.json");

const UPDATE_FIELDS = ["province", "city", "type", "description", "history", "highlights", "is_featured"];
const STRING_FIELDS = UPDATE_FIELDS.filter((field) => field !== "is_featured");

function text(value) {
  if (value === null || value === undefined) return "";
  const normalized = String(value).trim();
  if (normalized === "undefined" || normalized === "null") return "";
  return normalized;
}

function normalizeKey(value) {
  return text(value).replace(/\s+/g, "").toLowerCase();
}

function hasOwn(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function readBool(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = text(value).toLowerCase();
  if (["true", "1", "yes", "y", "是"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "否"].includes(normalized)) return false;
  return undefined;
}

function valueFromInput(record, field) {
  if (field === "is_featured") {
    const raw = hasOwn(record, "is_featured") ? record.is_featured : record.isFeatured;
    return readBool(raw);
  }
  if (!hasOwn(record, field)) return undefined;
  const value = text(record[field]);
  return value ? value : undefined;
}

function changedFields(target, source) {
  const changes = {};
  for (const field of STRING_FIELDS) {
    const nextValue = valueFromInput(source, field);
    if (nextValue === undefined) continue;
    if (text(target[field]) !== nextValue) changes[field] = nextValue;
  }

  const nextFeatured = valueFromInput(source, "is_featured");
  if (nextFeatured !== undefined && Boolean(target.is_featured ?? target.isFeatured) !== nextFeatured) {
    changes.is_featured = nextFeatured;
  }

  return changes;
}

function applyChanges(target, changes) {
  for (const [field, value] of Object.entries(changes)) {
    if (field === "is_featured") {
      if (hasOwn(target, "isFeatured") && !hasOwn(target, "is_featured")) {
        target.isFeatured = value;
      } else {
        target.is_featured = value;
      }
      continue;
    }
    target[field] = value;
  }
}

function inputMatchNames(record) {
  return [record.name, record.standard_name].map(text).filter(Boolean);
}

async function readInputMuseums(filePath) {
  if (!filePath) {
    throw new Error("Usage: node scripts/import-museum-autofill.mjs data/museums-autofill-completed.json");
  }
  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  const museums = Array.isArray(parsed) ? parsed : Array.isArray(parsed.museums) ? parsed.museums : [];
  if (museums.length === 0) {
    throw new Error("Input file does not contain a museums array.");
  }
  return museums.filter((item) => item && typeof item === "object" && !Array.isArray(item));
}

function postgresConfigured() {
  return Boolean(process.env.DB_HOST || process.env.DB_NAME);
}

function createPgPool() {
  const required = (name, fallback) => {
    const value = process.env[name] ?? fallback;
    if (!value) throw new Error(`Missing ${name} env var`);
    return value;
  };
  return new pg.Pool({
    host: required("DB_HOST", "127.0.0.1"),
    port: Number(required("DB_PORT", "5432")),
    database: required("DB_NAME", "muselink"),
    user: required("DB_USER", "muselink"),
    password: required("DB_PASSWORD", "muselink_password"),
  });
}

async function importToPostgres(inputMuseums) {
  const pool = createPgPool();
  try {
    const result = await pool.query(
      `select id, name, province, city, type, description, history, highlights, is_featured
       from museums
       order by id asc`,
    );
    const byId = new Map(result.rows.map((row) => [String(row.id), row]));
    const byName = new Map();
    for (const row of result.rows) {
      byName.set(normalizeKey(row.name), row);
    }

    const report = createEmptyReport("postgres:museums");
    for (const input of inputMuseums) {
      const match = matchMuseum(input, byId, byName);
      if (!match) {
        report.unmatched.push(inputSummary(input));
        continue;
      }

      const changes = changedFields(match, input);
      if (Object.keys(changes).length === 0) {
        report.skipped += 1;
        report.details.push({ id: String(match.id), name: match.name, matchedBy: match.matchedBy, updatedFields: [] });
        continue;
      }

      await pool.query(
        `update museums
         set province=$2, city=$3, type=$4, description=$5, history=$6, highlights=$7, is_featured=$8, updated_at=now()
         where id=$1`,
        [
          match.id,
          changes.province ?? match.province,
          changes.city ?? match.city,
          changes.type ?? match.type,
          changes.description ?? match.description,
          changes.history ?? match.history,
          changes.highlights ?? match.highlights,
          changes.is_featured ?? match.is_featured,
        ],
      );
      Object.assign(match, changes);
      report.updated += 1;
      report.details.push({
        id: String(match.id),
        name: match.name,
        matchedBy: match.matchedBy,
        updatedFields: Object.keys(changes),
      });
    }

    return report;
  } finally {
    await pool.end();
  }
}

async function importToImportedMuseumsJson(inputMuseums) {
  const raw = await fs.readFile(IMPORTED_MUSEUMS_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  const museums = Array.isArray(parsed) ? parsed : Array.isArray(parsed.museums) ? parsed.museums : [];
  const byId = new Map(museums.map((museum) => [String(museum.id), museum]));
  const byName = new Map();
  for (const museum of museums) {
    byName.set(normalizeKey(museum.name), museum);
  }

  const report = createEmptyReport("json:data/imported-museums.json");
  for (const input of inputMuseums) {
    const match = matchMuseum(input, byId, byName);
    if (!match) {
      report.unmatched.push(inputSummary(input));
      continue;
    }

    const changes = changedFields(match, input);
    if (Object.keys(changes).length === 0) {
      report.skipped += 1;
      report.details.push({ id: String(match.id), name: match.name, matchedBy: match.matchedBy, updatedFields: [] });
      continue;
    }

    applyChanges(match, changes);
    match.updatedAt = new Date().toISOString();
    report.updated += 1;
    report.details.push({
      id: String(match.id),
      name: match.name,
      matchedBy: match.matchedBy,
      updatedFields: Object.keys(changes),
    });
  }

  if (report.updated > 0) {
    const next = Array.isArray(parsed)
      ? museums
      : {
          ...parsed,
          updatedAt: new Date().toISOString(),
          museums,
        };
    await fs.writeFile(IMPORTED_MUSEUMS_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  }

  return report;
}

function matchMuseum(input, byId, byName) {
  const id = text(input.id);
  if (id && byId.has(id)) {
    const row = byId.get(id);
    row.matchedBy = "id";
    return row;
  }

  for (const name of inputMatchNames(input)) {
    const key = normalizeKey(name);
    if (byName.has(key)) {
      const row = byName.get(key);
      row.matchedBy = name === text(input.standard_name) ? "standard_name" : "name";
      return row;
    }
  }

  return null;
}

function inputSummary(input) {
  return {
    id: text(input.id),
    name: text(input.name),
    standard_name: text(input.standard_name),
  };
}

function createEmptyReport(target) {
  return {
    target,
    updated: 0,
    skipped: 0,
    unmatched: [],
    details: [],
  };
}

function printReport(report) {
  console.log(`数据源: ${report.target}`);
  console.log(`成功更新: ${report.updated}`);
  console.log(`跳过: ${report.skipped}`);
  console.log(`未匹配: ${report.unmatched.length}`);
  if (report.unmatched.length > 0) {
    console.log("未匹配到的博物馆:");
    for (const item of report.unmatched) {
      console.log(`- id=${item.id || "-"} name=${item.name || "-"} standard_name=${item.standard_name || "-"}`);
    }
  }
  console.log("每个博物馆更新字段:");
  for (const item of report.details) {
    const fields = item.updatedFields.length > 0 ? item.updatedFields.join(", ") : "无变更";
    console.log(`- ${item.name} (${item.id}, ${item.matchedBy}): ${fields}`);
  }
}

async function main() {
  const inputMuseums = await readInputMuseums(INPUT_PATH);
  const report = postgresConfigured()
    ? await importToPostgres(inputMuseums)
    : await importToImportedMuseumsJson(inputMuseums);

  if (!postgresConfigured()) {
    console.log("未检测到 DB_HOST/DB_NAME；当前项目本地后台使用 pg-mem，脚本无法写入正在运行的内存库。");
    console.log("已写回项目现有持久博物馆数据文件 data/imported-museums.json。");
  }
  printReport(report);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
