import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ExternalLink, ImageOff, Landmark, MapPin } from "lucide-react";
import type { Artifact, Museum } from "../../../types";
import { SafeImage } from "../../../components/SafeImage";
import { ArtifactCard } from "../../artifacts/components/ArtifactCard";
import { fetchMuseumDetail } from "../services/museumsService";
import {
  artifactImageUrlRaw,
  artifactMuseumRaw,
  displayDbString,
  isStrictDbEmpty,
} from "../../../lib/dbDisplay";

const EMPTY_TEXT = "暂无信息";

type MuseumDetailProps = {
  museumId: string;
  museum?: Museum | null;
  allArtifacts: Artifact[];
  onClose: () => void;
  onArtifactClick: (artifact: Artifact) => void;
};

type MuseumField =
  | "name"
  | "description"
  | "location"
  | "province"
  | "city"
  | "address"
  | "type"
  | "level"
  | "grade"
  | "openingHours"
  | "officialWebsite"
  | "imageUrl";

const MUSEUM_FIELD_KEYS: Record<MuseumField, readonly string[]> = {
  name: ["name", "名称", "馆名"],
  description: ["description", "简介", "介绍", "说明"],
  location: ["location", "所在地", "地区"],
  province: ["province", "省份"],
  city: ["city", "城市"],
  address: ["address", "地址"],
  type: ["type", "类型", "museumType"],
  level: ["level", "级别"],
  grade: ["grade", "等级"],
  openingHours: ["openingHours", "opening_hours", "开放时间"],
  officialWebsite: ["officialWebsite", "official_website", "website", "官网"],
  imageUrl: [
    "localCoverImageUrl",
    "local_cover_image_url",
    "storageCoverImageUrl",
    "storage_cover_image_url",
    "coverImageUrl",
    "cover_image_url",
    "displayCoverUrl",
    "localCoverThumbnailUrl",
    "local_cover_thumbnail_url",
    "coverThumbnailUrl",
    "cover_thumbnail_url",
    "imageUrl",
    "image_url",
  ],
};

function museumField(museum: Museum | null | undefined, field: MuseumField): unknown {
  if (!museum) return "";
  const record = museum as unknown as Record<string, unknown>;
  for (const key of MUSEUM_FIELD_KEYS[field]) {
    const value = record[key];
    if (!isStrictDbEmpty(value)) return value;
  }
  return "";
}

function museumImageUrl(museum: Museum | null | undefined) {
  const raw = museumField(museum, "imageUrl");
  if (!isStrictDbEmpty(raw)) return typeof raw === "string" ? raw.trim() : String(raw);
  const id = museum?.id ? String(museum.id).trim() : "";
  return id && Number.isFinite(Number(id)) ? `/museum-images/${id}/cover.jpg` : "";
}

function museumIdOfArtifact(artifact: Artifact) {
  const record = artifact as unknown as Record<string, unknown>;
  const raw = artifact.museumId ?? record.museum_id;
  return raw === null || raw === undefined ? "" : String(raw);
}

function mergeArtifactsById(items: Artifact[]) {
  const map = new Map<string, Artifact>();
  items.forEach((item) => {
    if (!item?.id) return;
    const existing = map.get(item.id);
    map.set(item.id, existing ? { ...item, ...existing } : item);
  });
  return Array.from(map.values());
}

function museumRegion(museum: Museum | null | undefined) {
  const province = displayDbString(museumField(museum, "province"));
  const city = displayDbString(museumField(museum, "city"));
  const location = displayDbString(museumField(museum, "location"));
  const compact = [province, city].filter((item) => item && item !== EMPTY_TEXT).join(" / ");
  return compact || (location !== EMPTY_TEXT ? location : EMPTY_TEXT);
}

export function MuseumDetail({ museumId, museum, allArtifacts, onClose, onArtifactClick }: MuseumDetailProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [detailMuseum, setDetailMuseum] = useState<Museum | null>(null);
  const [detailArtifacts, setDetailArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [museumId]);

  useEffect(() => {
    const numericId = Number(museumId);
    if (!Number.isFinite(numericId)) {
      setDetailMuseum(null);
      setDetailArtifacts([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setLoadError("");

    fetchMuseumDetail(museumId, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setDetailMuseum(data.museum ?? null);
        setDetailArtifacts(Array.isArray(data.artifacts) ? data.artifacts : []);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.warn("Fetch museum detail failed, using local museum data:", error);
        setDetailMuseum(null);
        setDetailArtifacts([]);
        setLoadError("详情数据暂时不可用，已显示本地缓存内容");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [museumId]);

  const currentMuseum = detailMuseum ?? museum ?? null;
  const name = displayDbString(museumField(currentMuseum, "name"));
  const region = museumRegion(currentMuseum);
  const description = displayDbString(museumField(currentMuseum, "description"));
  const address = displayDbString(museumField(currentMuseum, "address"));
  const type = displayDbString(museumField(currentMuseum, "type"));
  const level = displayDbString(museumField(currentMuseum, "level"));
  const grade = displayDbString(museumField(currentMuseum, "grade"));
  const openingHours = displayDbString(museumField(currentMuseum, "openingHours"));
  const officialWebsiteRaw = museumField(currentMuseum, "officialWebsite");
  const officialWebsite = typeof officialWebsiteRaw === "string" ? officialWebsiteRaw.trim() : "";

  const artifacts = useMemo(() => {
    const museumName = name === EMPTY_TEXT ? "" : name;
    const directIds = Array.isArray(currentMuseum?.artifactIds) ? currentMuseum.artifactIds.map(String) : [];
    const idSet = new Set(directIds);
    detailArtifacts.forEach((artifact) => idSet.add(String(artifact.id)));

    const fromPool = allArtifacts.filter((artifact) => {
      if (idSet.has(String(artifact.id))) return true;
      if (String(museumIdOfArtifact(artifact)) === String(museumId)) return true;
      return museumName && displayDbString(artifactMuseumRaw(artifact)) === museumName;
    });

    const poolById = new Map(allArtifacts.map((artifact) => [String(artifact.id), artifact]));
    const fromDetail = detailArtifacts.map((artifact) => ({
      ...artifact,
      ...(poolById.get(String(artifact.id)) || {}),
    }));

    return mergeArtifactsById([...fromPool, ...fromDetail]);
  }, [allArtifacts, currentMuseum?.artifactIds, detailArtifacts, museumId, name]);

  const heroImageUrl = museumImageUrl(currentMuseum) || String(artifactImageUrlRaw(artifacts[0], "full") ?? "");
  const stats = [
    { label: "馆藏文物", value: String(Math.max(artifacts.length, Number(currentMuseum?.artifactCount || 0) || 0)) },
    { label: "地区", value: region },
    { label: "类型", value: type },
  ].filter((item) => item.value && item.value !== EMPTY_TEXT);

  return (
    <motion.div
      ref={scrollRef}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      className="fixed inset-0 z-[108] flex flex-col overflow-y-auto bg-[#F7F4EF] pb-[max(24px,env(safe-area-inset-bottom,0px))]"
    >
      <header className="sticky top-0 z-30 flex min-h-12 shrink-0 items-center gap-2 border-b border-black/5 bg-white/90 px-4 backdrop-blur-md">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-700"
          aria-label="返回"
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <div className="min-w-0 flex-1 px-1 text-center">
          <h1 className="break-words text-xs font-medium text-gray-400">博物馆主页</h1>
        </div>
        <div className="h-10 w-10 shrink-0" />
      </header>

      <section className="relative min-h-[420px] overflow-hidden bg-[#E7E0D4]">
        {heroImageUrl ? (
          <SafeImage
            src={heroImageUrl}
            alt={name}
            loading="eager"
            decoding="async"
            width={1400}
            height={900}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
            <ImageOff size={34} />
            <span className="text-sm">暂无博物馆图片</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-gray-800">
              <MapPin size={12} className="shrink-0 text-amber-700" />
              <span className="break-words">{region}</span>
            </span>
            {loading ? (
              <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold text-white">加载中</span>
            ) : null}
          </div>
          <h2 className="break-words text-[30px] font-black leading-tight">{name}</h2>
          <p className="mt-3 line-clamp-3 max-w-3xl break-words text-sm leading-relaxed text-white/90">
            {description}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2 px-4 py-4">
        {stats.map((item) => (
          <div key={item.label} className="min-w-0 rounded-[8px] bg-white p-3 shadow-sm">
            <p className="truncate text-[10px] font-bold text-gray-400">{item.label}</p>
            <p className="mt-1 line-clamp-2 break-words text-sm font-black text-gray-900">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="px-4 pb-2">
        <div className="rounded-[8px] bg-white p-4 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-black text-gray-900">
            <Landmark size={16} className="text-amber-700" />
            本馆介绍
          </h3>
          <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-gray-700">
            {description}
          </p>
          <dl className="mt-4 divide-y divide-gray-100 text-sm leading-relaxed">
            {[
              ["详细地址", address],
              ["馆舍级别", [level, grade].filter((item) => item && item !== EMPTY_TEXT).join(" / ") || EMPTY_TEXT],
              ["开放时间", openingHours],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-4 py-2.5">
                <dt className="w-20 shrink-0 text-gray-400">{label}</dt>
                <dd className="min-w-0 flex-1 break-words text-gray-800">{value}</dd>
              </div>
            ))}
          </dl>
          {officialWebsite ? (
            <a
              href={officialWebsite}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-700"
            >
              官方网站
              <ExternalLink size={13} />
            </a>
          ) : null}
        </div>
      </section>

      <section className="px-4 pt-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Collection</p>
            <h3 className="break-words text-lg font-black text-gray-950">馆藏文物</h3>
          </div>
          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-amber-700 shadow-sm">
            {artifacts.length} 件
          </span>
        </div>

        {loadError ? <p className="mb-3 text-xs text-amber-700">{loadError}</p> : null}

        {artifacts.length > 0 ? (
          <div className="columns-2 gap-1.5">
            {artifacts.map((artifact) => (
              <div key={artifact.id} className="mb-1.5 break-inside-avoid">
                <ArtifactCard
                  artifact={artifact}
                  onClick={() => onArtifactClick(artifact)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[8px] bg-white py-16 text-center text-sm text-gray-400 shadow-sm">
            暂无该馆藏品数据
          </div>
        )}
      </section>
    </motion.div>
  );
}
