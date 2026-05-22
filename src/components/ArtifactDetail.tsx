import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ExternalLink, Heart, ImageOff, Loader2, Sparkles, Tag, X } from "lucide-react";
import type { Artifact, ArtifactAttributeGroup } from "../types";
import { apiFetch } from "../lib/api";
import { curatorService } from "../services/curatorService";
import { SafeImage } from "./SafeImage";

/** 文物详情顶栏标题（非业务字段）。 */
const DETAIL_NAV_TITLE = "文物详情";
const IMAGE_UNAVAILABLE_TEXT = "暂无图片";
const INFO_EMPTY_PLACEHOLDER = "暂无信息";
const INTRO_EMPTY_PLACEHOLDER = "暂无简介";
const DESCRIPTION_EMPTY_PLACEHOLDER = "暂无介绍";
const MORE_EMPTY_PLACEHOLDER = "暂无更多信息";

type ArtifactDbField =
  | "imageUrl"
  | "museumName"
  | "name"
  | "dynasty"
  | "category"
  | "shortIntro"
  | "description"
  | "sourceUrl"
  | "material"
  | "dimensions"
  | "size"
  | "level"
  | "remarks"
  | "remark"
  | "note";

const FIELD_SOURCES: Record<ArtifactDbField, readonly string[]> = {
  imageUrl: ["imageUrl", "image_url", "图片链接", "图片", "image", "thumbnail"],
  museumName: ["museumName", "museum", "所属博物馆", "博物馆", "馆藏单位", "收藏单位", "馆名"],
  name: ["name", "文物名称", "名称", "藏品名称", "题名", "title"],
  dynasty: ["dynasty", "period", "era", "朝代", "时代", "年代"],
  category: ["category", "类别", "文物类别", "藏品类别", "类型", "classification"],
  shortIntro: ["shortIntro", "short_intro", "一句话简介", "短简介", "摘要", "summary"],
  description: ["description", "详细介绍", "文物描述", "文物简介", "简介", "介绍", "说明"],
  sourceUrl: ["sourceUrl", "source_url", "来源链接", "数据来源", "source", "sourceLink"],
  material: ["material", "材质", "质地", "材料"],
  dimensions: ["dimensions", "尺寸", "规格", "体量", "长宽高"],
  size: ["size", "尺寸", "规格", "体量", "长宽高"],
  level: ["level", "等级", "级别", "文物等级", "保护级别"],
  remarks: ["remarks", "备注", "附注", "notes", "note"],
  remark: ["remark", "备注", "附注", "notes", "note"],
  note: ["note", "notes", "备注", "附注"],
};

function artifactDbValue(artifact: Artifact, field: ArtifactDbField): unknown {
  const record = artifact as unknown as Record<string, unknown>;
  for (const source of FIELD_SOURCES[field]) {
    const value = record?.[source];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return "";
}

function isBlankValue(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  if (typeof raw === "string") {
    const value = raw.trim();
    return value === "" || value === "undefined" || value === "null";
  }
  return false;
}

function isBlankAttributeValue(raw: unknown): boolean {
  if (isBlankValue(raw)) return true;
  if (typeof raw === "string") {
    const value = raw.trim();
    return value === "未知" || value === INFO_EMPTY_PLACEHOLDER;
  }
  return false;
}

function displayValue(raw: unknown, fallback = INFO_EMPTY_PLACEHOLDER): string {
  if (isBlankValue(raw)) return fallback;
  if (typeof raw === "string") return raw;
  return String(raw);
}

function normalizeAttributeGroups(artifact: Artifact): ArtifactAttributeGroup[] {
  const rawAttributes = (artifact as unknown as Record<string, unknown>).attributes;
  const groups = new Map<string, { order: number; items: { name: string; value: string; order: number }[] }>();

  const addItem = (groupRaw: unknown, nameRaw: unknown, valueRaw: unknown, orderRaw: unknown) => {
    if (isBlankAttributeValue(valueRaw) || isBlankValue(nameRaw)) return;
    const group = displayValue(groupRaw, "基础信息");
    const name = displayValue(nameRaw);
    const value = displayValue(valueRaw);
    const order = Number(orderRaw);
    const sortOrder = Number.isFinite(order) ? order : 0;
    const existing = groups.get(group) || { order: sortOrder, items: [] };
    existing.order = Math.min(existing.order, sortOrder);
    existing.items.push({ name, value, order: sortOrder });
    groups.set(group, existing);
  };

  if (Array.isArray(rawAttributes)) {
    for (const rawGroup of rawAttributes) {
      const groupRecord = rawGroup as Record<string, unknown>;
      if (Array.isArray(groupRecord?.items)) {
        for (const rawItem of groupRecord.items) {
          const item = rawItem as Record<string, unknown>;
          addItem(
            groupRecord.group ?? groupRecord.attribute_group,
            item.name ?? item.attribute_name,
            item.value ?? item.attribute_value,
            item.sortOrder ?? item.sort_order,
          );
        }
      } else {
        addItem(
          groupRecord.group ?? groupRecord.attribute_group,
          groupRecord.name ?? groupRecord.attribute_name,
          groupRecord.value ?? groupRecord.attribute_value,
          groupRecord.sortOrder ?? groupRecord.sort_order,
        );
      }
    }
  }

  const normalized = Array.from(groups.entries())
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

  if (normalized.length > 0) return normalized;

  const legacyItems = [
    { group: "基础信息", name: "材质", value: artifactDbValue(artifact, "material"), sortOrder: 1 },
    {
      group: "基础信息",
      name: "尺寸",
      value: artifactDbValue(artifact, "dimensions") || artifactDbValue(artifact, "size"),
      sortOrder: 2,
    },
    { group: "基础信息", name: "等级", value: artifactDbValue(artifact, "level"), sortOrder: 3 },
    {
      group: "其他信息",
      name: "备注",
      value: artifactDbValue(artifact, "remarks") || artifactDbValue(artifact, "remark") || artifactDbValue(artifact, "note"),
      sortOrder: 4,
    },
  ].filter((item) => !isBlankAttributeValue(item.value));

  if (legacyItems.length === 0) return [];
  return [
    {
      group: "基础信息",
      items: legacyItems
        .filter((item) => item.group === "基础信息")
        .map((item) => ({ name: item.name, value: displayValue(item.value) })),
    },
    {
      group: "其他信息",
      items: legacyItems
        .filter((item) => item.group === "其他信息")
        .map((item) => ({ name: item.name, value: displayValue(item.value) })),
    },
  ].filter((group) => group.items.length > 0);
}

function normalizeTags(artifact: Artifact): Array<{ type: string; name: string }> {
  return (Array.isArray(artifact.tags) ? artifact.tags : [])
    .map((tag) => {
      if (typeof tag === "string") return { type: "文化标签", name: tag };
      return {
        type: displayValue(tag.type, "文化标签"),
        name: displayValue(tag.name, ""),
      };
    })
    .filter((tag) => !isBlankValue(tag.name) && tag.name !== INFO_EMPTY_PLACEHOLDER);
}

function RequiredValue({ value }: { value: unknown }) {
  const synthetic = isBlankValue(value);
  return <span className={synthetic ? "text-gray-400" : undefined}>{displayValue(value)}</span>;
}

export type ArtifactDetailProps = {
  artifact: Artifact;
  onClose: () => void;
  allArtifacts: Artifact[];
  isFavorite: boolean;
  toggleFavorite: (id: string) => void | Promise<void>;
  onArtifactClick: (artifact: Artifact) => void;
};

export function ArtifactDetail({
  artifact,
  onClose,
  allArtifacts,
  isFavorite,
  toggleFavorite,
  onArtifactClick,
}: ArtifactDetailProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [detailArtifact, setDetailArtifact] = useState<Artifact | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [recommendations, setRecommendations] = useState<Artifact[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const currentArtifact = detailArtifact ?? artifact;
  const rawImageUrl = artifactDbValue(currentArtifact, "imageUrl");
  const imageUrl = typeof rawImageUrl === "string" ? rawImageUrl : "";

  useEffect(() => {
    let active = true;
    setDetailArtifact(null);

    const fetchDetail = async () => {
      try {
        const data = await apiFetch<{ artifact?: Artifact }>(
          `/api/artifacts/${encodeURIComponent(String(artifact.id))}?source=merged`,
        );
        if (active && data.artifact) {
          setDetailArtifact(data.artifact);
        }
      } catch (error) {
        console.warn("Fetch artifact detail failed, using list artifact:", error);
      }
    };

    void fetchDetail();
    return () => {
      active = false;
    };
  }, [artifact.id]);

  useEffect(() => {
    setHeroImageFailed(false);
    setHeroImageLoaded(false);
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [currentArtifact.id, imageUrl]);

  useEffect(() => {
    let active = true;

    const fetchRecs = async () => {
      setLoadingRecs(true);
      try {
        const recs = await curatorService.getRelatedArtifacts(currentArtifact, allArtifacts);
        if (!active) return;
        const mappedRecs = recs
          .map((r) => allArtifacts.find((a) => a.id === r.artifactId))
          .filter((a): a is Artifact => Boolean(a));
        setRecommendations(mappedRecs);
      } catch (error) {
        console.error(error);
        if (active) setRecommendations([]);
      } finally {
        if (active) setLoadingRecs(false);
      }
    };

    fetchRecs();
    return () => {
      active = false;
    };
  }, [currentArtifact, allArtifacts]);

  const hasImageUrl = imageUrl.trim() !== "";

  const onFavoriteTap = useCallback(() => {
    void toggleFavorite(currentArtifact.id);
  }, [currentArtifact.id, toggleFavorite]);

  const nameRaw = artifactDbValue(currentArtifact, "name");
  const museumRaw = artifactDbValue(currentArtifact, "museumName");
  const dynastyRaw = artifactDbValue(currentArtifact, "dynasty");
  const categoryRaw = artifactDbValue(currentArtifact, "category");
  const shortIntroRaw = artifactDbValue(currentArtifact, "shortIntro");
  const descriptionRaw = artifactDbValue(currentArtifact, "description");
  const sourceUrlRaw = artifactDbValue(currentArtifact, "sourceUrl");
  const sourceUrl = typeof sourceUrlRaw === "string" ? sourceUrlRaw.trim() : "";
  const nameForAlt = displayValue(nameRaw);

  const attributeGroups = useMemo(() => normalizeAttributeGroups(currentArtifact), [currentArtifact]);
  const tags = useMemo(() => normalizeTags(currentArtifact), [currentArtifact]);

  return (
    <motion.div
      ref={scrollRef}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      className="fixed inset-0 z-[110] flex flex-col overflow-y-auto bg-white pb-[max(20px,env(safe-area-inset-bottom,0px))]"
    >
      <header className="sticky top-0 z-30 flex min-h-12 shrink-0 items-center gap-2 border-b border-gray-100 bg-white/90 px-4 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-700"
          aria-label="返回"
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <div className="min-w-0 flex-1 px-1 text-center">
          <h1 className="break-words text-xs font-medium text-gray-400">{DETAIL_NAV_TITLE}</h1>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.88 }}
          transition={{ type: "spring", stiffness: 520, damping: 30 }}
          onClick={onFavoriteTap}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          aria-pressed={isFavorite}
        >
          <Heart
            size={24}
            className={isFavorite ? "text-red-500" : "text-gray-400"}
            fill={isFavorite ? "currentColor" : "none"}
            strokeWidth={2}
          />
        </motion.button>
      </header>

      <section
        className="relative flex w-full items-center justify-center overflow-hidden bg-neutral-100"
        style={{ minHeight: "max(45vh, 420px)" }}
        aria-label="文物图片"
      >
        {hasImageUrl && !heroImageFailed ? (
          <>
            {!heroImageLoaded ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-sm text-gray-400">
                图片加载中
              </div>
            ) : null}
            <img
              src={imageUrl}
              alt={nameForAlt}
              className="block w-full cursor-zoom-in"
              style={{
                maxHeight: "78vh",
                minHeight: "max(45vh, 420px)",
                objectFit: "contain",
                objectPosition: "center",
                opacity: heroImageLoaded ? 1 : 0,
              }}
              onLoad={() => setHeroImageLoaded(true)}
              onError={() => {
                setHeroImageFailed(true);
                setHeroImageLoaded(false);
              }}
              referrerPolicy="no-referrer"
              onClick={() => setLightboxUrl(imageUrl)}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-100 p-4 text-center">
            <ImageOff size={32} className="text-gray-300" />
            <span className="text-sm text-gray-500">{IMAGE_UNAVAILABLE_TEXT}</span>
          </div>
        )}
      </section>

      <section className="mx-4 mt-4 rounded-2xl px-4 py-5 text-left" style={{ backgroundColor: "#F8F9FA" }}>
        <p className="break-words text-[22px] font-bold leading-tight text-gray-950">
          <RequiredValue value={nameRaw} />
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-[14px] leading-relaxed text-gray-700">
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-gray-400">所属博物馆</dt>
            <dd className="min-w-0 flex-1 break-words"><RequiredValue value={museumRaw} /></dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-gray-400">时代/朝代</dt>
            <dd className="min-w-0 flex-1 break-words"><RequiredValue value={dynastyRaw} /></dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-gray-400">类别</dt>
            <dd className="min-w-0 flex-1 break-words"><RequiredValue value={categoryRaw} /></dd>
          </div>
        </dl>
        <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-gray-600">
          {displayValue(shortIntroRaw, INTRO_EMPTY_PLACEHOLDER)}
        </p>
      </section>

      <section className="mx-4 mt-5 rounded-2xl px-4 py-5 text-left" style={{ backgroundColor: "#F8F9FA" }}>
        <h2 className="text-sm font-bold text-gray-900">详细介绍</h2>
        <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-gray-700">
          {displayValue(descriptionRaw, DESCRIPTION_EMPTY_PLACEHOLDER)}
        </p>
      </section>

      <section className="mx-4 mt-5 rounded-2xl px-4 py-5 text-left" style={{ backgroundColor: "#F8F9FA" }}>
        <h2 className="text-sm font-bold text-gray-900">扩展信息</h2>
        {attributeGroups.length > 0 ? (
          <div className="mt-4 space-y-5">
            {attributeGroups.map((group) => (
              <div key={group.group}>
                <h3 className="break-words text-xs font-bold text-amber-700">{group.group}</h3>
                <dl className="mt-2 divide-y divide-gray-100">
                  {group.items.map((item) => (
                    <div key={`${group.group}-${item.name}`} className="flex gap-4 py-2.5 text-sm leading-relaxed">
                      <dt className="w-20 shrink-0 break-words text-gray-400">{item.name}</dt>
                      <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-gray-800">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-400">{MORE_EMPTY_PLACEHOLDER}</p>
        )}
      </section>

      {tags.length > 0 ? (
        <section className="mx-4 mt-5 rounded-2xl px-4 py-5 text-left" style={{ backgroundColor: "#F8F9FA" }}>
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <Tag size={15} className="text-amber-700" />
            标签信息
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={`${tag.type}-${tag.name}`}
                className="max-w-full rounded-full bg-white px-3 py-1.5 text-xs leading-tight text-gray-700 shadow-sm"
              >
                <span className="text-gray-400">{tag.type}</span>
                <span className="px-1 text-gray-300">/</span>
                <span className="break-words">{tag.name}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {sourceUrl ? (
        <section className="mx-4 mt-5 rounded-2xl px-4 py-5 text-left" style={{ backgroundColor: "#F8F9FA" }}>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center justify-between gap-3 text-sm font-bold text-gray-900"
          >
            <span>数据来源</span>
            <ExternalLink size={16} className="shrink-0 text-amber-700" />
          </a>
        </section>
      ) : null}

      <section className="mx-4 mt-6 pb-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
            <Sparkles size={14} className="text-amber-600" />
            AI 关联推荐
          </h2>
          {loadingRecs ? <Loader2 size={14} className="animate-spin text-amber-600" /> : null}
        </div>
        <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
          {recommendations.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onArtifactClick(item)}
              className="w-40 shrink-0 space-y-2 text-left"
            >
              <SafeImage
                src={String(artifactDbValue(item, "imageUrl") ?? "")}
                alt={displayValue(artifactDbValue(item, "name"))}
                className="aspect-square overflow-hidden rounded-2xl bg-gray-100"
              />
              <p className="break-words text-xs font-bold leading-snug text-gray-900">
                {displayValue(artifactDbValue(item, "name"))}
              </p>
              <p className="break-words text-[10px] leading-snug text-gray-400">
                {displayValue(artifactDbValue(item, "museumName"))}
              </p>
            </button>
          ))}
          {!loadingRecs && recommendations.length === 0 ? (
            <p className="py-6 text-xs text-gray-400">暂无相关推荐</p>
          ) : null}
        </div>
      </section>
      <div className="h-5 shrink-0" />

      {lightboxUrl ? (
        <button
          type="button"
          className="fixed inset-0 z-[200] flex flex-col bg-black/95 p-4"
          onClick={() => setLightboxUrl(null)}
          aria-label="关闭"
        >
          <div className="mb-3 flex justify-end">
            <span className="rounded-full p-2 text-white">
              <X size={28} />
            </span>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <img
              src={lightboxUrl}
              alt={nameForAlt}
              className="max-h-[85vh] max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
              referrerPolicy="no-referrer"
            />
          </div>
        </button>
      ) : null}
    </motion.div>
  );
}
