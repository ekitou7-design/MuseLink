/** 仅当数据库为 `null` / `undefined` / 完全空字符串 `""` 时视为无值，不使用 trim。 */
export function isStrictDbEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/** 数据库约定的空值占位符；有值时必须原样展示，不做 trim、不替换内容。 */
export const DB_EMPTY_PLACEHOLDER = "暂无信息";

/** 无值时统一显示数据库约定占位符；有值时原样转为展示用字符串（不做 trim、不替换内容）。 */
export function displayDbString(value: unknown): string {
  if (isStrictDbEmpty(value)) return DB_EMPTY_PLACEHOLDER;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return String(value);
}

export type ArtifactFieldId =
  | "name"
  | "museum"
  | "era"
  | "imageUrl"
  | "category"
  | "level"
  | "material"
  | "dimensions"
  | "remarks"
  | "culture"
  | "origin"
  | "description";

export type ArtifactFieldConfig = {
  id: ArtifactFieldId;
  label: string;
  keys: readonly string[];
};

export const ARTIFACT_FIELD_CONFIG = {
  name: { id: "name", label: "文物名称", keys: ["name", "title", "名称", "文物名称", "藏品名称", "题名"] },
  museum: {
    id: "museum",
    label: "所属博物馆",
    keys: ["museum", "museumName", "博物馆", "所属博物馆", "馆藏单位", "收藏单位", "馆名"],
  },
  era: { id: "era", label: "朝代", keys: ["朝代", "dynasty", "时代", "period", "era", "年代"] },
  imageUrl: {
    id: "imageUrl",
    label: "图片链接",
    keys: ["localImageUrl", "local_image_url", "imageUrl", "image_url", "image", "图片", "图片链接", "thumbnail"],
  },
  category: { id: "category", label: "类别", keys: ["category", "类别", "文物类别", "类型", "classification"] },
  level: { id: "level", label: "等级", keys: ["level", "等级", "级别", "文物等级"] },
  material: { id: "material", label: "材质", keys: ["material", "材质", "medium", "质地", "材料"] },
  dimensions: { id: "dimensions", label: "尺寸", keys: ["dimensions", "尺寸", "size", "规格", "体量"] },
  remarks: { id: "remarks", label: "备注", keys: ["remarks", "备注", "notes", "附注"] },
  culture: { id: "culture", label: "文化", keys: ["culture", "文化", "文化类型"] },
  origin: { id: "origin", label: "出土地", keys: ["origin", "出土地", "provenance", "来源", "发现地"] },
  description: {
    id: "description",
    label: "简介",
    keys: ["description", "简介", "summary", "介绍", "说明", "文物简介"],
  },
} as const satisfies Record<ArtifactFieldId, ArtifactFieldConfig>;

export function artifactFieldLabel(field: ArtifactFieldId): string {
  return ARTIFACT_FIELD_CONFIG[field].label;
}

/** 从文物对象上按顺序取第一个非空字段（与库/导入里多种列名、键名对齐，不做内容改写）。 */
export function coalesceArtifactField(artifact: unknown, keys: readonly string[]): unknown {
  if (artifact === null || artifact === undefined) return "";
  const o = typeof artifact === "object" ? (artifact as Record<string, unknown>) : {};
  for (const k of keys) {
    const v = o[k];
    if (!isStrictDbEmpty(v)) return v;
  }
  return "";
}

/** 朝代 = 时代 = 年代：同一语义字段的多种库键/列名。 */
export function artifactEraRaw(artifact: unknown): unknown {
  return coalesceArtifactField(artifact, ARTIFACT_FIELD_CONFIG.era.keys);
}

export function artifactImageUrlRaw(artifact: unknown, variant: "full" | "thumbnail" = "full"): unknown {
  const imageKeys = variant === "thumbnail"
    ? [
        "localThumbnailUrl",
        "local_thumbnail_url",
        "localImageUrl",
        "local_image_url",
        "thumbnailUrl",
        "thumbnail_url",
        "thumbnail",
        "imageUrl",
        "image_url",
        "image",
        "图片",
        "图片链接",
      ]
    : [
        "localImageUrl",
        "local_image_url",
        "localThumbnailUrl",
        "local_thumbnail_url",
        "imageUrl",
        "image_url",
        "image",
        "图片",
        "图片链接",
        "thumbnailUrl",
        "thumbnail_url",
        "thumbnail",
      ];
  if (artifact === null || artifact === undefined) return "";
  const o = typeof artifact === "object" ? (artifact as Record<string, unknown>) : {};
  for (const key of imageKeys) {
    const value = o[key];
    if (isStrictDbEmpty(value)) continue;
    const url = typeof value === "string" ? value.trim() : String(value);
    if (!url || url === DB_EMPTY_PLACEHOLDER || /^(null|undefined|nan)$/i.test(url)) continue;
    if (/(placeholder|placehold|占位|no-image|no_image|noimage|fallback|default-image|default_image)/i.test(url)) continue;
    return value;
  }
  return "";
}

export function artifactMuseumRaw(artifact: unknown): unknown {
  return coalesceArtifactField(artifact, ARTIFACT_FIELD_CONFIG.museum.keys);
}

export function artifactNameRaw(artifact: unknown): unknown {
  return coalesceArtifactField(artifact, ARTIFACT_FIELD_CONFIG.name.keys);
}

export function artifactMaterialRaw(artifact: unknown): unknown {
  return coalesceArtifactField(artifact, ARTIFACT_FIELD_CONFIG.material.keys);
}

export function artifactCultureRaw(artifact: unknown): unknown {
  return coalesceArtifactField(artifact, ARTIFACT_FIELD_CONFIG.culture.keys);
}

export function artifactOriginRaw(artifact: unknown): unknown {
  return coalesceArtifactField(artifact, ARTIFACT_FIELD_CONFIG.origin.keys);
}

export function artifactDescriptionRaw(artifact: unknown): unknown {
  return coalesceArtifactField(artifact, ARTIFACT_FIELD_CONFIG.description.keys);
}

export function artifactLevelRaw(artifact: unknown): unknown {
  return coalesceArtifactField(artifact, ARTIFACT_FIELD_CONFIG.level.keys);
}

export function artifactCategoryRaw(artifact: unknown): unknown {
  return coalesceArtifactField(artifact, ARTIFACT_FIELD_CONFIG.category.keys);
}

export function artifactDimensionsRaw(artifact: unknown): unknown {
  return coalesceArtifactField(artifact, ARTIFACT_FIELD_CONFIG.dimensions.keys);
}

export function artifactRemarksRaw(artifact: unknown): unknown {
  return coalesceArtifactField(artifact, ARTIFACT_FIELD_CONFIG.remarks.keys);
}
