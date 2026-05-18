import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Heart, ImageOff, Loader2, Sparkles, X } from "lucide-react";
import type { Artifact } from "../types";
import { curatorService } from "../services/curatorService";
import { SafeImage } from "./SafeImage";

/** 文物详情顶栏标题（非业务字段）。 */
const DETAIL_NAV_TITLE = "文物详情";
const IMAGE_UNAVAILABLE_TEXT = "暂无图片";
const DB_EMPTY_PLACEHOLDER = "暂无信息";

type ArtifactDbField =
  | "图片链接"
  | "所属博物馆"
  | "文物名称"
  | "朝代"
  | "类别"
  | "等级"
  | "材质"
  | "尺寸"
  | "备注";

type BackendMappedField =
  | "imageUrl"
  | "museum"
  | "name"
  | "period"
  | "category"
  | "level"
  | "material"
  | "dimensions"
  | "remarks";

const FIELD_SOURCES: Record<ArtifactDbField, readonly [ArtifactDbField, BackendMappedField?]> = {
  图片链接: ["图片链接", "imageUrl"],
  所属博物馆: ["所属博物馆", "museum"],
  文物名称: ["文物名称", "name"],
  朝代: ["朝代", "period"],
  类别: ["类别", "category"],
  等级: ["等级", "level"],
  材质: ["材质", "material"],
  尺寸: ["尺寸", "dimensions"],
  备注: ["备注", "remarks"],
};

const OPTIONAL_FIELDS: ArtifactDbField[] = [
  "类别",
  "等级",
  "材质",
  "尺寸",
];

function artifactDbValue(artifact: Artifact, field: ArtifactDbField): unknown {
  const record = artifact as unknown as Record<string, unknown>;
  const sources = FIELD_SOURCES[field];
  for (const source of sources) {
    const value = record?.[source];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return record?.[sources[0]];
}

function isEmptyRequiredValue(raw: unknown): boolean {
  return raw === null || raw === undefined || raw === "";
}

function isEmptyOptionalValue(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  if (typeof raw === "string") {
    const value = raw.trim();
    return value === "" || value === "未知" || value === DB_EMPTY_PLACEHOLDER;
  }
  return false;
}

function displayRequiredValue(raw: unknown): string {
  if (isEmptyRequiredValue(raw)) return DB_EMPTY_PLACEHOLDER;
  if (typeof raw === "string") return raw;
  return String(raw);
}

function displayOptionalValue(raw: unknown): string {
  return typeof raw === "string" ? raw : String(raw);
}

function RequiredValue({ value }: { value: unknown }) {
  const synthetic = isEmptyRequiredValue(value);
  return <span className={synthetic ? "text-gray-400" : undefined}>{displayRequiredValue(value)}</span>;
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [recommendations, setRecommendations] = useState<Artifact[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const rawImageUrl = artifactDbValue(artifact, "图片链接");
  const imageUrl = typeof rawImageUrl === "string" ? rawImageUrl : "";

  useEffect(() => {
    setHeroImageFailed(false);
    setHeroImageLoaded(false);
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [artifact.id, imageUrl]);

  useEffect(() => {
    const id = artifact.id;
    console.log("当前文物ID:", id);
    console.log("数据库返回的文物详情:", artifact);
    console.log("图片链接:", (artifact as unknown as Record<string, unknown>)?.["图片链接"]);
    console.log("后端映射图片链接 imageUrl:", (artifact as unknown as Record<string, unknown>)?.imageUrl);
  }, [artifact]);

  useEffect(() => {
    let active = true;

    const fetchRecs = async () => {
      setLoadingRecs(true);
      try {
        const recs = await curatorService.getRelatedArtifacts(artifact, allArtifacts);
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
  }, [artifact, allArtifacts]);

  const hasImageUrl = imageUrl.trim() !== "";

  const onFavoriteTap = useCallback(() => {
    void toggleFavorite(artifact.id);
  }, [artifact.id, toggleFavorite]);

  const extendedItems = OPTIONAL_FIELDS.map((field) => {
    const raw = artifactDbValue(artifact, field);
    if (isEmptyOptionalValue(raw)) return null;
    return { field, label: field, value: displayOptionalValue(raw) };
  }).filter(Boolean) as { field: ArtifactDbField; label: string; value: string }[];

  const museumRaw = artifactDbValue(artifact, "所属博物馆");
  const nameRaw = artifactDbValue(artifact, "文物名称");
  const eraRaw = artifactDbValue(artifact, "朝代");
  const remarksRaw = artifactDbValue(artifact, "备注");
  const showRemarks = !isEmptyOptionalValue(remarksRaw);
  const nameForAlt = displayRequiredValue(nameRaw);

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
            <span className="text-sm text-gray-500">
              {IMAGE_UNAVAILABLE_TEXT}
            </span>
          </div>
        )}
      </section>

      <section className="mx-4 mt-4 rounded-2xl px-4 py-4 text-left" style={{ backgroundColor: "#F8F9FA" }}>
        <p className="break-words text-[22px] font-bold leading-tight text-gray-950">
          <RequiredValue value={nameRaw} />
        </p>
        <p className="mt-2 break-words text-[15px] font-normal leading-relaxed text-gray-600">
          <RequiredValue value={museumRaw} />
          <span className="px-1 text-gray-300">·</span>
          <RequiredValue value={eraRaw} />
        </p>
      </section>

      {extendedItems.length > 0 && (
        <div className="grid grid-cols-2 gap-4 px-4 pt-5">
          {extendedItems.map((item) => (
            <div
              key={item.field}
              className="flex min-h-24 flex-col justify-center rounded-2xl px-4 py-5 text-left"
              style={{ backgroundColor: "#F8F9FA" }}
            >
              <p className="text-xs font-normal leading-tight" style={{ color: "#999999" }}>
                {item.label}
              </p>
              <p
                className="mt-1.5 break-words text-[17px] font-bold leading-snug"
                style={{ color: "#111111" }}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {showRemarks ? (
        <section className="mx-4 mt-5 rounded-2xl px-4 py-5 text-left" style={{ backgroundColor: "#F8F9FA" }}>
          <p className="text-xs font-normal leading-tight" style={{ color: "#999999" }}>
            备注
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-[16px] font-normal leading-relaxed" style={{ color: "#111111" }}>
            {displayOptionalValue(remarksRaw)}
          </p>
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
                src={String(artifactDbValue(item, "图片链接") ?? "")}
                alt={displayRequiredValue(artifactDbValue(item, "文物名称"))}
                className="aspect-square overflow-hidden rounded-2xl bg-gray-100"
              />
              <p className="break-words text-xs font-bold leading-snug text-gray-900">
                {displayRequiredValue(artifactDbValue(item, "文物名称"))}
              </p>
              <p className="break-words text-[10px] leading-snug text-gray-400">
                {displayRequiredValue(artifactDbValue(item, "所属博物馆"))}
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
