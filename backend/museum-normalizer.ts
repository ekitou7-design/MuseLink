import type { DbQuery } from "./api/db/syncImportedArtifacts";
import {
  CITY_OPTIONS_BY_PROVINCE,
  inferMuseumTypeByName,
  normalizeMuseumCity,
  normalizeMuseumGrade,
  normalizeMuseumLevel,
  normalizeMuseumProvince,
  normalizeMuseumType,
} from "../src/constants/locationOptions";

export type MuseumMatchType = "exact" | "alias" | "normalized" | "fuzzy" | "created";

export type MuseumRowLike = {
  id: number | string;
  name: string;
  normalized_name?: string | null;
  aliases?: string[] | null;
  type?: string | null;
  level?: string | null;
  grade?: string | null;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  official_website?: string | null;
  description?: string | null;
  history?: string | null;
  highlights?: string | null;
  opening_hours?: string | null;
  ticket_info?: string | null;
  contact?: string | null;
  cover_image_url?: string | null;
  cover_thumbnail_url?: string | null;
  local_cover_image_url?: string | null;
  local_cover_thumbnail_url?: string | null;
  storage_cover_image_url?: string | null;
  storage_cover_thumbnail_url?: string | null;
  image_source?: string | null;
  source?: string | null;
  created_by_import?: boolean | null;
  artifact_count?: number | null;
  is_featured?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MuseumResolveResult = {
  museum: MuseumRowLike;
  canonicalName: string;
  rawName: string;
  normalizedName: string;
  matchType: MuseumMatchType;
  confidence: number;
  created: boolean;
  possibleDuplicates?: Array<{ id: string; name: string; score: number }>;
};

export type MuseumLocationInference = {
  province: string;
  city: string;
  confidence: number;
  source: "artifact" | "dictionary" | "name_rule" | "unknown";
};

const BUILT_IN_ALIAS_RULES = [
  {
    name: "南京大学博物馆",
    aliases: ["南京大学博物馆", "南京大学", "南大博物馆", "南大"],
    defaults: {
      type: "高校博物馆",
      grade: "未定级",
      level: "未定级",
      province: "江苏",
      city: "南京",
      source: "artifact_import",
    },
  },
];

const PROTECTED_DISTINCT_NAMES = ["南京博物院", "南京市博物馆", "南京大学博物馆", "南京六朝博物馆"];

let schemaReady = false;

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function normalizeMuseumName(name: unknown): string | null {
  const normalized = text(name)
    .replace(/\u3000/g, " ")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/\s+/g, " ")
    .replace(/^[\s,，.。;；:：、\-—_'"“”‘’/\\|]+/, "")
    .replace(/[\s,，.。;；:：、\-—_'"“”‘’/\\|]+$/, "")
    .trim();
  return normalized || null;
}

export function normalizedMuseumKey(name: unknown): string | null {
  const normalized = normalizeMuseumName(name);
  if (!normalized) return null;
  return normalized
    .toLowerCase()
    .replace(/[()\[\]{}【】《》〈〉]/g, "")
    .replace(/[\s,，.。;；:：、\-—_'"“”‘’/\\|]/g, "");
}

function cleanLocationPart(value: unknown): string {
  return normalizeMuseumName(value) || "";
}

function firstRecordText(record: unknown, keys: string[]) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return "";
  const source = record as Record<string, unknown>;
  for (const key of keys) {
    const value = cleanLocationPart(source[key]);
    if (value) return value;
  }
  return "";
}

const BUILT_IN_MUSEUM_LOCATIONS = [
  ["法门寺博物馆", "陕西", "宝鸡"],
  ["南京大学博物馆", "江苏", "南京"],
  ["南京大学", "江苏", "南京"],
  ["南大博物馆", "江苏", "南京"],
  ["南大", "江苏", "南京"],
  ["南京博物院", "江苏", "南京"],
  ["南京市博物馆", "江苏", "南京"],
  ["六朝博物馆", "江苏", "南京"],
  ["南京六朝博物馆", "江苏", "南京"],
  ["苏州博物馆", "江苏", "苏州"],
  ["故宫博物院", "北京", "北京"],
  ["中国国家博物馆", "北京", "北京"],
  ["上海博物馆", "上海", "上海"],
  ["浙江省博物馆", "浙江", "杭州"],
  ["陕西历史博物馆", "陕西", "西安"],
  ["河南博物院", "河南", "郑州"],
  ["湖北省博物馆", "湖北", "武汉"],
  ["湖南博物院", "湖南", "长沙"],
  ["山西博物院", "山西", "太原"],
  ["辽宁省博物馆", "辽宁", "沈阳"],
  ["广东省博物馆", "广东", "广州"],
  ["四川博物院", "四川", "成都"],
  ["重庆中国三峡博物馆", "重庆", "重庆"],
  ["甘肃省博物馆", "甘肃", "兰州"],
  ["新疆维吾尔自治区博物馆", "新疆", "乌鲁木齐"],
  ["内蒙古博物院", "内蒙古", "呼和浩特"],
  ["云南省博物馆", "云南", "昆明"],
] as const;

const BUILT_IN_LOCATION_BY_KEY = new Map(
  BUILT_IN_MUSEUM_LOCATIONS
    .map(([name, province, city]) => {
      const key = normalizedMuseumKey(name);
      return key ? [key, { province, city }] as const : null;
    })
    .filter(Boolean) as Array<readonly [string, { province: string; city: string }]>,
);

const CITY_LOCATION_RULES = [
  ["宝鸡", "陕西", "宝鸡"],
  ["南京", "江苏", "南京"],
  ["苏州", "江苏", "苏州"],
  ["杭州", "浙江", "杭州"],
  ["西安", "陕西", "西安"],
  ["北京", "北京", "北京"],
  ["上海", "上海", "上海"],
  ["广州", "广东", "广州"],
  ["成都", "四川", "成都"],
  ["武汉", "湖北", "武汉"],
  ["长沙", "湖南", "长沙"],
  ["郑州", "河南", "郑州"],
  ["洛阳", "河南", "洛阳"],
  ["太原", "山西", "太原"],
  ["沈阳", "辽宁", "沈阳"],
  ["兰州", "甘肃", "兰州"],
  ["乌鲁木齐", "新疆", "乌鲁木齐"],
] as const;

const KNOWN_CITY_LOCATION_RULES = Object.entries(CITY_OPTIONS_BY_PROVINCE).flatMap(([province, cities]) =>
  cities.map((city) => [city, province, city] as const),
);

function inferFromRegionText(region: string): Pick<MuseumLocationInference, "province" | "city"> | null {
  if (!region) return null;
  for (const [cityName, province, city] of CITY_LOCATION_RULES) {
    if (region.includes(cityName)) return { province, city };
  }
  for (const [cityName, province, city] of KNOWN_CITY_LOCATION_RULES) {
    if (region.includes(cityName)) return { province, city };
  }
  for (const [, province, city] of BUILT_IN_MUSEUM_LOCATIONS) {
    if (region.includes(province)) return { province, city: region.includes(city) ? city : "" };
  }
  return null;
}

export function inferMuseumLocation(museumName: unknown, rawArtifact?: unknown): MuseumLocationInference {
  const artifactProvince = firstRecordText(rawArtifact, ["province", "省份", "省", "museumProvince", "museum_province"]);
  const artifactCity = firstRecordText(rawArtifact, ["city", "城市", "市", "museumCity", "museum_city"]);
  const artifactRegion = firstRecordText(rawArtifact, ["region", "地区", "所在地", "馆藏地区", "location", "地址", "address"]);
  if (artifactProvince || artifactCity) {
    const fromRegion = inferFromRegionText(`${artifactProvince}${artifactCity}${artifactRegion}`);
    const province = normalizeMuseumProvince(artifactProvince || fromRegion?.province || "其他") || "其他";
    const city = normalizeMuseumCity(province, artifactCity || fromRegion?.city || "未知地区") || "未知地区";
    return {
      province,
      city,
      confidence: artifactProvince && artifactCity ? 1 : 0.88,
      source: "artifact",
    };
  }
  const regionLocation = inferFromRegionText(artifactRegion);
  if (regionLocation) {
    return { ...regionLocation, confidence: 0.86, source: "artifact" };
  }

  const normalizedName = normalizedMuseumKey(museumName);
  if (normalizedName) {
    const dictionary = BUILT_IN_LOCATION_BY_KEY.get(normalizedName);
    if (dictionary) return { ...dictionary, confidence: 1, source: "dictionary" };
  }

  const cleanName = normalizeMuseumName(museumName) || "";
  for (const [cityName, province, city] of CITY_LOCATION_RULES) {
    if (cleanName.includes(cityName)) {
      return { province, city, confidence: 0.82, source: "name_rule" };
    }
  }
  for (const [cityName, province, city] of KNOWN_CITY_LOCATION_RULES) {
    if (cleanName.includes(cityName)) {
      return { province, city, confidence: 0.78, source: "name_rule" };
    }
  }

  return { province: "其他", city: "未知地区", confidence: 0, source: "unknown" };
}

function shouldFillLocation(value: unknown) {
  const clean = cleanLocationPart(value);
  return !clean || clean === "其他" || clean === "未知地区";
}

function aliasKeyMap() {
  const map = new Map<string, (typeof BUILT_IN_ALIAS_RULES)[number]>();
  for (const rule of BUILT_IN_ALIAS_RULES) {
    for (const alias of rule.aliases) {
      const key = normalizedMuseumKey(alias);
      if (key) map.set(key, rule);
    }
  }
  return map;
}

const BUILT_IN_ALIAS_BY_KEY = aliasKeyMap();
const PROTECTED_KEYS = new Set(PROTECTED_DISTINCT_NAMES.map(normalizedMuseumKey).filter(Boolean) as string[]);

export async function ensureMuseumSchema(db: DbQuery) {
  if (schemaReady) return;
  await db.query(`alter table museums add column if not exists normalized_name text`);
  await db.query(`alter table museums add column if not exists aliases text[] not null default '{}'::text[]`);
  await db.query(`alter table museums add column if not exists type text not null default '其他'`);
  await db.query(`alter table museums add column if not exists level text not null default '未定级'`);
  await db.query(`alter table museums add column if not exists grade text not null default '未定级'`);
  await db.query(`alter table museums add column if not exists province text`);
  await db.query(`alter table museums add column if not exists city text`);
  await db.query(`alter table museums add column if not exists address text`);
  await db.query(`alter table museums add column if not exists latitude double precision`);
  await db.query(`alter table museums add column if not exists longitude double precision`);
  await db.query(`alter table museums add column if not exists official_website text`);
  await db.query(`alter table museums add column if not exists history text not null default ''`);
  await db.query(`alter table museums add column if not exists highlights text not null default ''`);
  await db.query(`alter table museums add column if not exists opening_hours text not null default ''`);
  await db.query(`alter table museums add column if not exists ticket_info text not null default ''`);
  await db.query(`alter table museums add column if not exists contact text not null default ''`);
  await db.query(`alter table museums add column if not exists cover_image_url text not null default ''`);
  await db.query(`alter table museums add column if not exists cover_thumbnail_url text not null default ''`);
  await db.query(`alter table museums add column if not exists local_cover_image_url text not null default ''`);
  await db.query(`alter table museums add column if not exists local_cover_thumbnail_url text not null default ''`);
  await db.query(`alter table museums add column if not exists storage_cover_image_url text not null default ''`);
  await db.query(`alter table museums add column if not exists storage_cover_thumbnail_url text not null default ''`);
  await db.query(`alter table museums add column if not exists image_source text not null default ''`);
  await db.query(`alter table museums add column if not exists source text not null default ''`);
  await db.query(`alter table museums add column if not exists created_by_import boolean not null default false`);
  await db.query(`alter table museums add column if not exists artifact_count int not null default 0`);
  await db.query(`alter table museums add column if not exists is_featured boolean not null default false`);
  await db.query(`alter table museums add column if not exists updated_at timestamptz not null default now()`);
  await db.query(`alter table artifacts add column if not exists raw_museum_name text not null default ''`);
  await db.query(`alter table artifacts add column if not exists canonical_museum_name text not null default ''`);
  const aliasTable = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables where table_name = 'museum_aliases' limit 1`,
  );
  if (aliasTable.rows.length === 0) {
    await db.query(
      `create table museum_aliases (
        id bigserial primary key,
        museum_id bigint not null,
        alias text not null,
        normalized_alias text not null,
        source text not null default '',
        confidence double precision not null default 1,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`,
    );
  }
  await db.query(`create unique index if not exists idx_museum_aliases_normalized_alias_unique on museum_aliases(normalized_alias)`);
  await db.query(`create index if not exists idx_museums_normalized_name on museums(normalized_name)`);
  await db.query(`create index if not exists idx_artifacts_museum_id on artifacts(museum_id)`);
  await db.query(`create index if not exists idx_artifacts_raw_museum_name on artifacts(raw_museum_name)`);
  await db.query(
    `update museums
     set normalized_name = name
     where normalized_name is null or normalized_name = ''`,
  );
  schemaReady = true;
}

async function getMuseumById(db: DbQuery, id: number | string) {
  const result = await db.query<MuseumRowLike>(`select * from museums where id = $1 limit 1`, [id]);
  return result.rows[0] || null;
}

async function getMuseumByName(db: DbQuery, name: string) {
  const result = await db.query<MuseumRowLike>(`select * from museums where name = $1 limit 1`, [name]);
  return result.rows[0] || null;
}

async function getMuseumByNormalizedName(db: DbQuery, normalizedName: string) {
  const result = await db.query<MuseumRowLike>(`select * from museums where normalized_name = $1 limit 1`, [normalizedName]);
  return result.rows[0] || null;
}

async function getMuseumByAlias(db: DbQuery, normalizedAlias: string) {
  const aliasResult = await db.query<{ museum_id: number | string; confidence: number }>(
    `select museum_id, confidence from museum_aliases where normalized_alias = $1 order by confidence desc limit 1`,
    [normalizedAlias],
  );
  const alias = aliasResult.rows[0];
  if (alias) {
    const museum = await getMuseumById(db, alias.museum_id);
    if (museum) return { museum, confidence: Number(alias.confidence) || 1 };
  }

  const arrayResult = await db.query<MuseumRowLike>(`select * from museums where $1 = any(aliases) limit 1`, [normalizedAlias]);
  const museum = arrayResult.rows[0];
  return museum ? { museum, confidence: 0.98 } : null;
}

async function upsertAlias(db: DbQuery, museumId: number | string, alias: string, source = "system", confidence = 1) {
  const normalizedAlias = normalizedMuseumKey(alias);
  if (!normalizedAlias) return;
  const existing = await db.query<{ id: number | string; confidence: number }>(
    `select id, confidence from museum_aliases where normalized_alias=$1 limit 1`,
    [normalizedAlias],
  );
  if (existing.rows[0]) {
    await db.query(
      `update museum_aliases
       set museum_id=$2, alias=$3, source=$4, confidence=$5, updated_at=now()
       where id=$1`,
      [existing.rows[0].id, museumId, alias, source, Math.max(Number(existing.rows[0].confidence) || 0, confidence)],
    );
    return;
  }
  await db.query(
    `insert into museum_aliases (museum_id, alias, normalized_alias, source, confidence)
     values ($1,$2,$3,$4,$5)`,
    [museumId, alias, normalizedAlias, source, confidence],
  );
}

async function updateMuseumLocationIfNeeded(db: DbQuery, museum: MuseumRowLike, rawName?: unknown, rawArtifact?: unknown) {
  const inferred = inferMuseumLocation(rawName || museum.name, rawArtifact);
  if (inferred.source === "unknown") return museum;
  const nextProvince = shouldFillLocation(museum.province)
    ? inferred.province
    : normalizeMuseumProvince(museum.province) || cleanLocationPart(museum.province);
  const nextCity = shouldFillLocation(museum.city)
    ? inferred.city
    : normalizeMuseumCity(nextProvince, museum.city) || cleanLocationPart(museum.city);
  if (nextProvince === cleanLocationPart(museum.province) && nextCity === cleanLocationPart(museum.city)) return museum;
  await db.query(`update museums set province=$2, city=$3, updated_at=now() where id=$1`, [
    museum.id,
    nextProvince || null,
    nextCity || null,
  ]);
  return (await getMuseumById(db, museum.id)) || museum;
}

async function createMuseum(db: DbQuery, name: string, options?: Partial<MuseumRowLike>, rawArtifact?: unknown) {
  const normalizedName = normalizedMuseumKey(name) || name;
  const inferredLocation = inferMuseumLocation(name, rawArtifact || options);
  const province = normalizeMuseumProvince(options?.province) || inferredLocation.province;
  const city = normalizeMuseumCity(province, options?.city) || inferredLocation.city;
  const type = inferMuseumTypeByName(name, options?.type || "其他");
  const level = normalizeMuseumLevel(options?.level);
  const grade = normalizeMuseumGrade(options?.grade);
  const existing = await getMuseumByName(db, name);
  if (existing) {
    await db.query(
      `update museums
       set normalized_name=$2,
           type=case when type = '' or type = '其他' then $3 else type end,
           level=case when level = '' or level = '未定级' then $4 else level end,
           grade=case when grade = '' or grade = '未定级' then $5 else grade end,
           source=case when source = '' then $6 else source end,
           created_by_import=created_by_import or $7,
           updated_at=now()
       where id=$1`,
      [
        existing.id,
        existing.normalized_name || normalizedName,
        type,
        level,
        grade,
        options?.source || "artifact_import",
        options?.created_by_import ?? true,
      ],
    );
    const updated = (await getMuseumById(db, existing.id)) || existing;
    return updateMuseumLocationIfNeeded(db, updated, name, rawArtifact || options);
  }
  const result = await db.query<MuseumRowLike>(
    `insert into museums (
       name, normalized_name, aliases, type, level, grade, province, city, source, created_by_import,
       description, location, image_url, updated_at
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
     returning *`,
    [
      name,
      normalizedName,
      [normalizedName],
      type,
      level,
      grade,
      province || null,
      city || null,
      options?.source || "artifact_import",
      options?.created_by_import ?? true,
      options?.description || "",
      "",
      "",
    ],
  );
  return result.rows[0];
}

async function addMuseumAliasKeys(db: DbQuery, museumId: number | string, aliases: string[]) {
  const museum = await getMuseumById(db, museumId);
  if (!museum) return;
  const merged = Array.from(new Set([...(museum.aliases || []), ...aliases].filter(Boolean)));
  await db.query(`update museums set aliases=$2, updated_at=now() where id=$1`, [museumId, merged]);
}

async function ensureBuiltInRule(db: DbQuery, rule: (typeof BUILT_IN_ALIAS_RULES)[number]) {
  const museum = await createMuseum(db, rule.name, {
    ...rule.defaults,
    created_by_import: true,
  });
  for (const alias of rule.aliases) {
    await upsertAlias(db, museum.id, alias, "system", 1);
  }
  const aliases = rule.aliases.map(normalizedMuseumKey).filter(Boolean) as string[];
  await addMuseumAliasKeys(db, museum.id, aliases);
  return (await getMuseumById(db, museum.id)) || museum;
}

function charSet(value: string) {
  return new Set(Array.from(value));
}

function similarity(left: string, right: string) {
  if (!left || !right || left === right) return left === right ? 1 : 0;
  const a = charSet(left);
  const b = charSet(right);
  const intersection = Array.from(a).filter((char) => b.has(char)).length;
  const union = new Set([...Array.from(a), ...Array.from(b)]).size || 1;
  return intersection / union;
}

export async function findPossibleMuseumDuplicates(db: DbQuery, rawName: string) {
  const normalizedName = normalizedMuseumKey(rawName);
  if (!normalizedName) return [];
  const rows = await db.query<MuseumRowLike>(`select id, name, normalized_name from museums order by id asc`);
  return rows.rows
    .map((museum) => {
      const key = normalizedMuseumKey(museum.normalized_name || museum.name) || "";
      const score = similarity(normalizedName, key);
      return { id: String(museum.id), name: museum.name, score };
    })
    .filter((item) => item.score >= 0.72 && item.score < 1)
    .filter((item) => !(PROTECTED_KEYS.has(normalizedName) && PROTECTED_KEYS.has(normalizedMuseumKey(item.name) || "")))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export async function resolveMuseumName(db: DbQuery, rawName: unknown, rawArtifact?: unknown): Promise<MuseumResolveResult | null> {
  await ensureMuseumSchema(db);
  const cleanName = normalizeMuseumName(rawName);
  if (!cleanName) return null;
  const normalizedName = normalizedMuseumKey(cleanName);
  if (!normalizedName) return null;

  const exact = await getMuseumByName(db, cleanName);
  if (exact) {
    const museum = await updateMuseumLocationIfNeeded(db, exact, cleanName, rawArtifact);
    return { museum, canonicalName: museum.name, rawName: cleanName, normalizedName, matchType: "exact", confidence: 1, created: false };
  }

  const normalized = await getMuseumByNormalizedName(db, normalizedName);
  if (normalized) {
    const museum = await updateMuseumLocationIfNeeded(db, normalized, cleanName, rawArtifact);
    return { museum, canonicalName: museum.name, rawName: cleanName, normalizedName, matchType: "normalized", confidence: 1, created: false };
  }

  const alias = await getMuseumByAlias(db, normalizedName);
  if (alias && alias.confidence >= 0.95) {
    const museum = await updateMuseumLocationIfNeeded(db, alias.museum, cleanName, rawArtifact);
    return { museum, canonicalName: museum.name, rawName: cleanName, normalizedName, matchType: "alias", confidence: alias.confidence, created: false };
  }

  const builtInRule = BUILT_IN_ALIAS_BY_KEY.get(normalizedName);
  if (builtInRule) {
    const museum = await ensureBuiltInRule(db, builtInRule);
    return { museum, canonicalName: museum.name, rawName: cleanName, normalizedName, matchType: "alias", confidence: 1, created: false };
  }

  const possibleDuplicates = await findPossibleMuseumDuplicates(db, cleanName);
  const museum = await createMuseum(db, cleanName, {
    type: "其他",
    level: "未定级",
    grade: "未定级",
    source: "artifact_import",
    created_by_import: true,
  }, rawArtifact);
  await upsertAlias(db, museum.id, cleanName, "artifact_import", 1);
  return {
    museum,
    canonicalName: museum.name,
    rawName: cleanName,
    normalizedName,
    matchType: "created",
    confidence: 1,
    created: true,
    possibleDuplicates,
  };
}

export async function ensureMuseumExists(db: DbQuery, museumName: unknown, rawArtifact?: unknown) {
  const resolved = await resolveMuseumName(db, museumName, rawArtifact);
  if (!resolved) {
    return resolveMuseumName(db, "未归类博物馆", rawArtifact);
  }
  return resolved;
}

export async function seedBuiltInMuseumAliases(db: DbQuery) {
  await ensureMuseumSchema(db);
  for (const rule of BUILT_IN_ALIAS_RULES) {
    await ensureBuiltInRule(db, rule);
  }
}
