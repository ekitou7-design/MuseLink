export type DbQuery = {
  query<T = any>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

type SearchRelicsOptions = {
  keyword: string;
  limit?: number;
};

type RelicRow = {
  id: number | string;
  name: string;
  dynasty: string;
  museum_id: number | string;
  museum: string;
  description: string;
  image_url: string;
  local_image_url?: string | null;
  local_thumbnail_url?: string | null;
  tags: string[] | null;
  created_at: string;
  category?: string | null;
  material?: string | null;
  remark?: string | null;
  remarks?: string | null;
};

const BASE_ARTIFACT_COLUMNS = new Set([
  "id",
  "name",
  "dynasty",
  "museum_id",
  "description",
  "image_url",
  "tags",
  "created_at",
]);

const OPTIONAL_TEXT_COLUMNS = ["category", "material", "remark", "remarks"] as const;
const OPTIONAL_IMAGE_COLUMNS = ["local_image_url", "local_thumbnail_url"] as const;

async function getArtifactColumns(db: DbQuery) {
  try {
    const result = await db.query<{ column_name: string }>(
      `select column_name
       from information_schema.columns
       where table_name = 'artifacts'`,
    );
    const columns = new Set(result.rows.map((row) => row.column_name));
    return columns.size > 0 ? columns : BASE_ARTIFACT_COLUMNS;
  } catch {
    return BASE_ARTIFACT_COLUMNS;
  }
}

function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag));
  if (typeof tags === "string") {
    return tags
      .replace(/[{}"]/g, "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return "";
}

function normalizeRelicRow(row: RelicRow) {
  const tags = normalizeTags(row.tags);
  const material = firstNonEmpty(row.material);
  const category = firstNonEmpty(row.category);
  const remarks = firstNonEmpty(row.remarks, row.remark);

  return {
    id: String(row.id),
    name: row.name ?? "",
    museum: row.museum ?? "",
    period: row.dynasty ?? "",
    dynasty: row.dynasty ?? "",
    museum_id: row.museum_id,
    description: row.description ?? "",
    imageUrl: row.image_url ?? "",
    image_url: row.image_url ?? "",
    localImageUrl: row.local_image_url ?? "",
    localThumbnailUrl: row.local_thumbnail_url ?? "",
    local_image_url: row.local_image_url ?? "",
    local_thumbnail_url: row.local_thumbnail_url ?? "",
    tags,
    favsCount: 0,
    category,
    material,
    remarks,
    created_at: row.created_at,
  };
}

export async function searchRelics(db: DbQuery, options: SearchRelicsOptions) {
  const keyword = options.keyword.trim();
  const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 500);
  const columns = await getArtifactColumns(db);
  const optionalColumns = OPTIONAL_TEXT_COLUMNS.filter((column) => columns.has(column));
  const optionalImageColumns = OPTIONAL_IMAGE_COLUMNS.filter((column) => columns.has(column));

  const optionalSelect = optionalColumns.map((column) => `a.${column} as ${column}`);
  const optionalImageSelect = optionalImageColumns.map((column) => `a.${column} as ${column}`);
  const optionalSearchExpressions = optionalColumns.map((column) => `coalesce(a.${column}::text, '')`);
  const searchExpressions = [
    "coalesce(a.name, '')",
    "coalesce(m.name, '')",
    "coalesce(a.dynasty, '')",
    "coalesce(a.description, '')",
    "coalesce(a.tags::text, '')",
    ...optionalSearchExpressions,
  ];
  const whereSql = keyword
    ? `where ${searchExpressions.map((expression) => `lower(${expression}) like lower($1)`).join(" or ")}`
    : "";
  const params: unknown[] = keyword ? [`%${keyword}%`, `${keyword}%`, limit] : [limit];
  const limitParam = keyword ? "$3" : "$1";
  const orderSql = keyword
    ? `case
         when lower(a.name) = lower($2) then 0
         when lower(a.name) like lower($2) then 1
         when lower(m.name) like lower($2) then 2
         else 3
       end, a.id asc`
    : "a.id asc";

  const rows = await db.query<RelicRow>(
    `select
       a.id,
       a.name,
       a.dynasty,
       a.museum_id,
       m.name as museum,
       a.description,
       a.image_url,
       a.tags,
       a.created_at
       ${optionalSelect.length || optionalImageSelect.length ? `, ${[...optionalSelect, ...optionalImageSelect].join(", ")}` : ""}
     from artifacts a
     join museums m on m.id = a.museum_id
     ${whereSql}
     order by ${orderSql}
     limit ${limitParam}`,
    params,
  );

  return rows.rows.map(normalizeRelicRow);
}
