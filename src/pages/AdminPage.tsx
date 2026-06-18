import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Artifact, Exhibition } from "../types";
import { AuthService } from "../auth/AuthService";
import { UserSession } from "../auth/UserSession";
import { apiFetch, apiUrl, getAuthToken, setAuthToken } from "../lib/api";
import { getAdminStats, getAdminUsers, type AdminStatsResponse, type AdminUserSummary } from "../lib/adminClient";
import { me } from "../lib/authClient";
import { ForbiddenPage } from "./ForbiddenPage";
import { goBackOrNavigate, navigate } from "../router/router";
import { SafeImage } from "../components/SafeImage";
import { artifactImageUrlRaw } from "../lib/dbDisplay";
import {
  emptyHomeRecommendationsConfig,
  fetchAdminRecommendations,
  saveAdminRecommendations,
  searchRecommendationArtifactCandidates,
  searchRecommendationExhibitionCandidates,
  type HomeRecommendationItem,
  type HomeRecommendationsConfig,
  type RecommendationTargetType,
  type ResolvedHomeRecommendations,
} from "../modules/recommendations/services/homeRecommendationsService";
import {
  CITY_OPTIONS_BY_PROVINCE,
  MUSEUM_GRADE_OPTIONS,
  MUSEUM_LEVEL_OPTIONS,
  MUSEUM_TYPE_OPTIONS,
  PROVINCE_OPTIONS,
  normalizeMuseumGrade,
  normalizeMuseumLevel,
  normalizeMuseumProvince,
  normalizeMuseumType,
} from "../constants/locationOptions";

type AdminTab = "artifacts" | "museums" | "import" | "users";
type AdminRoute = "/admin" | `/admin/${string}`;
type ArtifactImageFilter = "all" | "no-image" | "remote-only" | "local-broken" | "local-complete" | "no-local";
type ArtifactImageStatus = "local-complete" | "remote-only" | "no-image" | "local-broken";
type MuseumStatusFilter = "all" | "with-artifacts" | "without-artifacts" | "created-by-import" | "no-cover" | "duplicates";

type ArtifactLocalImageFileStatus = {
  artifactId: string;
  localImageUrl: string;
  localThumbnailUrl: string;
  localImageExists: boolean | null;
  localThumbnailExists: boolean | null;
};

type ArtifactImageStatusInfo = {
  status: ArtifactImageStatus;
  fields: ReturnType<typeof getArtifactImageFields>;
  hasMissingLocalFile: boolean;
};

type AiRagSyncSummary = {
  ok: boolean;
  artifactCount: number;
  aiReadyCount: number;
  ragDocumentCount: number;
  relationCount: number;
  coverage: string;
  message: string;
  error?: string;
};

type RowImageSelection = {
  file: File;
  previewUrl: string;
};

type EditorRecommendationDraft = {
  isEditorRecommended: boolean;
  editorRecommendationOrder: number;
};

type CropTarget =
  | { kind: "artifact-form"; file: File; previewUrl: string; aspect: number; title: string }
  | { kind: "artifact-row"; artifactId: string; artifactName: string; file: File; previewUrl: string; aspect: number; title: string }
  | { kind: "museum-cover"; file: File; previewUrl: string; aspect: number; title: string };

type CropBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ArtifactFormState = {
  id?: string;
  name: string;
  museum: string;
  dynasty: string;
  category: string;
  shortIntro: string;
  description: string;
  imageUrl: string;
  sourceUrl: string;
  tags: string;
  material: string;
  dimensions: string;
  level: string;
  remarks: string;
};

type MuseumAlias = {
  id: string;
  alias: string;
  normalizedAlias: string;
  source: string;
  confidence: number;
};

type MuseumAdminItem = {
  id: string;
  name: string;
  normalizedName?: string;
  aliases?: string[];
  type?: string;
  level?: string;
  grade?: string;
  province?: string;
  city?: string;
  address?: string;
  officialWebsite?: string;
  description?: string;
  history?: string;
  highlights?: string;
  openingHours?: string;
  ticketInfo?: string;
  contact?: string;
  localCoverImageUrl?: string;
  localCoverThumbnailUrl?: string;
  storageCoverImageUrl?: string;
  storageCoverThumbnailUrl?: string;
  coverImageUrl?: string;
  coverThumbnailUrl?: string;
  displayCoverUrl?: string;
  source?: string;
  createdByImport?: boolean;
  artifactCount?: number;
  isFeatured?: boolean;
  hasCover?: boolean;
  updatedAt?: string;
};

type MuseumDetailResponse = {
  museum: MuseumAdminItem;
  aliases: MuseumAlias[];
  artifacts: Artifact[];
  stats: { artifactCount: number };
};

type MuseumFormState = {
  id?: string;
  name: string;
  type: string;
  level: string;
  grade: string;
  province: string;
  city: string;
  address: string;
  officialWebsite: string;
  description: string;
  history: string;
  openingHours: string;
  ticketInfo: string;
  highlights: string;
  contact: string;
  isFeatured: boolean;
};

const emptyForm: ArtifactFormState = {
  name: "",
  museum: "",
  dynasty: "",
  category: "",
  shortIntro: "",
  description: "",
  imageUrl: "",
  sourceUrl: "",
  tags: "",
  material: "",
  dimensions: "",
  level: "",
  remarks: "",
};

const emptyMuseumForm: MuseumFormState = {
  name: "",
  type: "其他",
  level: "未定级",
  grade: "未定级",
  province: "",
  city: "",
  address: "",
  officialWebsite: "",
  description: "",
  history: "",
  openingHours: "",
  ticketInfo: "",
  highlights: "",
  contact: "",
  isFeatured: false,
};

const genderLabels: Record<AdminUserSummary["gender"], string> = {
  male: "男",
  female: "女",
  other: "其他",
  secret: "保密",
};

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function fieldText(record: unknown, keys: string[]) {
  if (!record || typeof record !== "object") return "";
  const source = record as Record<string, unknown>;
  for (const key of keys) {
    const value = text(source[key]).trim();
    if (value) return value;
  }
  return "";
}

function artifactIsEditorRecommended(artifact: Artifact) {
  return Boolean(artifact.isEditorRecommended ?? artifact.is_editor_recommended);
}

function artifactEditorRecommendationOrder(artifact: Artifact) {
  const value = Number(artifact.editorRecommendationOrder ?? artifact.editor_recommendation_order ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function isPlaceholderImageUrl(value: unknown) {
  const url = text(value).trim().toLowerCase();
  if (!url) return false;
  return [
    "placeholder",
    "placehold",
    "占位",
    "no-image",
    "no_image",
    "noimage",
    "fallback",
    "default-image",
    "default_image",
    "暂无信息",
  ].some((marker) => url.includes(marker));
}

function isUsableImageUrl(value: unknown) {
  const url = text(value).trim();
  if (!url) return false;
  if (isPlaceholderImageUrl(url)) return false;
  return true;
}

function getArtifactImageFields(artifact: Artifact) {
  const record = artifact as Artifact & Record<string, unknown>;
  const localImageUrl = fieldText(record, ["localImageUrl", "local_image_url"]);
  const localThumbnailUrl = fieldText(record, ["localThumbnailUrl", "local_thumbnail_url"]);
  const imageUrl = fieldText(record, ["imageUrl", "image_url", "externalImageUrl", "external_image_url", "image", "图片", "图片链接"]);
  const thumbnailUrl = fieldText(record, ["thumbnailUrl", "thumbnail_url", "thumbnail"]);
  const hasLocalImage = isUsableImageUrl(localImageUrl) || isUsableImageUrl(localThumbnailUrl);
  const hasRemoteImage = isUsableImageUrl(imageUrl) || isUsableImageUrl(thumbnailUrl);
  const hasPlaceholderImage = [localImageUrl, localThumbnailUrl, imageUrl, thumbnailUrl].some(isPlaceholderImageUrl);

  return {
    localImageUrl,
    localThumbnailUrl,
    imageUrl,
    thumbnailUrl,
    hasLocalImage,
    hasRemoteImage,
    hasPlaceholderImage,
  };
}

function getArtifactImageStatusInfo(
  artifact: Artifact,
  failed: boolean,
  fileStatus?: ArtifactLocalImageFileStatus,
): ArtifactImageStatusInfo {
  const image = getArtifactImageFields(artifact);
  const hasMissingLocalFile = (
    (isUsableImageUrl(image.localImageUrl) && fileStatus?.localImageExists === false) ||
    (isUsableImageUrl(image.localThumbnailUrl) && fileStatus?.localThumbnailExists === false)
  );

  if (image.hasLocalImage && (hasMissingLocalFile || failed)) {
    return { status: "local-broken", fields: image, hasMissingLocalFile };
  }
  if (image.hasLocalImage) {
    return { status: "local-complete", fields: image, hasMissingLocalFile: false };
  }
  if (image.hasRemoteImage) {
    return { status: "remote-only", fields: image, hasMissingLocalFile: false };
  }
  return { status: "no-image", fields: image, hasMissingLocalFile: false };
}

function artifactMatchesImageFilter(status: ArtifactImageStatusInfo, filter: ArtifactImageFilter) {
  if (filter === "all") return true;
  if (filter === "no-local") return !status.fields.hasLocalImage;
  return status.status === filter;
}

function imageStatusLabel(status: ArtifactImageStatus) {
  const labels: Record<ArtifactImageStatus, string> = {
    "local-complete": "本地图",
    "remote-only": "仅有外链图",
    "no-image": "完全无图",
    "local-broken": "本地图异常",
  };
  return labels[status];
}

function imageStatusClassName(status: ArtifactImageStatus) {
  const classes: Record<ArtifactImageStatus, string> = {
    "local-complete": "bg-emerald-50 text-emerald-700",
    "remote-only": "bg-sky-50 text-sky-700",
    "no-image": "bg-gray-100 text-gray-700",
    "local-broken": "bg-rose-50 text-rose-700",
  };
  return classes[status];
}

function suggestedRemoteImageUrl(fields: ArtifactImageStatusInfo["fields"]) {
  return fields.thumbnailUrl || fields.imageUrl;
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function validateArtifactImageFile(file: File) {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(file.type)) return "仅支持 jpg/png/webp 图片。";
  if (file.size > 10 * 1024 * 1024) return "图片不能超过 10MB。";
  return null;
}

function validateImageDownloadUrl(value: string) {
  const url = value.trim();
  if (!url) return "请先粘贴图片链接。";
  if (!/^https?:\/\//i.test(url)) return "图片链接必须以 http 或 https 开头。";
  return null;
}

function tagNames(tags: Artifact["tags"] | undefined) {
  if (!Array.isArray(tags)) return "";
  return tags
    .map((tag) => (typeof tag === "string" ? tag : tag.name))
    .filter(Boolean)
    .join("，");
}

function attributeValue(artifact: Artifact, name: string) {
  const groups = Array.isArray(artifact.attributes) ? artifact.attributes : [];
  for (const group of groups) {
    const item = group.items.find((entry) => entry.name === name);
    if (item?.value) return item.value;
  }
  return "";
}

function formFromArtifact(artifact: Artifact): ArtifactFormState {
  return {
    id: text(artifact.id),
    name: text(artifact.name),
    museum: text(artifact.museumName || artifact.museum),
    dynasty: text(artifact.dynasty || artifact.period),
    category: text(artifact.category),
    shortIntro: text(artifact.shortIntro),
    description: text(artifact.description),
    imageUrl: text(artifact.imageUrl || (artifact as any).image_url),
    sourceUrl: text(artifact.sourceUrl || (artifact as any).source_url),
    tags: tagNames(artifact.tags),
    material: text(artifact.material || attributeValue(artifact, "材质")),
    dimensions: text(artifact.dimensions || attributeValue(artifact, "尺寸")),
    level: text(artifact.level || attributeValue(artifact, "等级")),
    remarks: text(artifact.remarks || attributeValue(artifact, "备注")),
  };
}

function buildArtifactPayload(form: ArtifactFormState) {
  const attributes = [
    { group: "基础信息", items: [{ name: "材质", value: form.material }, { name: "尺寸", value: form.dimensions }, { name: "等级", value: form.level }] },
    { group: "其他信息", items: [{ name: "备注", value: form.remarks }] },
  ].map((group) => ({
    ...group,
    items: group.items.filter((item) => item.value.trim()),
  })).filter((group) => group.items.length > 0);

  return {
    name: form.name.trim(),
    museum: form.museum.trim(),
    dynasty: form.dynasty.trim(),
    category: form.category.trim(),
    shortIntro: form.shortIntro.trim(),
    description: form.description.trim(),
    imageUrl: form.imageUrl.trim(),
    sourceUrl: form.sourceUrl.trim(),
    tags: form.tags.split(/[,，、\n]/).map((tag) => tag.trim()).filter(Boolean),
    attributes,
  };
}

function museumFormFromMuseum(museum: MuseumAdminItem): MuseumFormState {
  return {
    id: museum.id,
    name: text(museum.name),
    type: normalizeMuseumType(museum.type),
    level: normalizeMuseumLevel(museum.level),
    grade: normalizeMuseumGrade(museum.grade),
    province: normalizeMuseumProvince(museum.province),
    city: text(museum.city),
    address: text(museum.address),
    officialWebsite: text(museum.officialWebsite),
    description: text(museum.description),
    history: text(museum.history),
    openingHours: text(museum.openingHours),
    ticketInfo: text(museum.ticketInfo),
    highlights: text(museum.highlights),
    contact: text(museum.contact),
    isFeatured: Boolean(museum.isFeatured),
  };
}

function museumPayloadFromForm(form: MuseumFormState) {
  return {
    name: form.name.trim(),
    type: form.type.trim(),
    level: form.level.trim(),
    grade: form.grade.trim(),
    province: form.province.trim(),
    city: form.city.trim() === "__custom__" ? "" : form.city.trim(),
    address: form.address.trim(),
    officialWebsite: form.officialWebsite.trim(),
    description: form.description.trim(),
    history: form.history.trim(),
    openingHours: form.openingHours.trim(),
    ticketInfo: form.ticketInfo.trim(),
    highlights: form.highlights.trim(),
    contact: form.contact.trim(),
    isFeatured: form.isFeatured,
  };
}

function museumCoverUrl(museum: MuseumAdminItem) {
  return (
    museum.storageCoverThumbnailUrl ||
    museum.localCoverThumbnailUrl ||
    museum.coverThumbnailUrl ||
    museum.storageCoverImageUrl ||
    museum.localCoverImageUrl ||
    museum.coverImageUrl ||
    museum.displayCoverUrl ||
    ""
  );
}

function museumOriginalCoverUrl(museum: MuseumAdminItem) {
  return (
    museum.storageCoverImageUrl ||
    museum.localCoverImageUrl ||
    museum.coverImageUrl ||
    museum.displayCoverUrl ||
    ""
  );
}

function museumThumbnailCoverUrl(museum: MuseumAdminItem) {
  return (
    museum.storageCoverThumbnailUrl ||
    museum.localCoverThumbnailUrl ||
    museum.coverThumbnailUrl ||
    museumCoverUrl(museum)
  );
}

function artifactMuseumId(artifact: Artifact) {
  const record = artifact as Artifact & Record<string, unknown>;
  return text(record.museumId ?? record.museum_id);
}

function artifactCanonicalMuseumName(artifact: Artifact) {
  const record = artifact as Artifact & Record<string, unknown>;
  return text(record.canonicalMuseumName ?? record.canonical_museum_name ?? artifact.museumName ?? artifact.museum);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function formatShortDate(value?: string) {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.length > 16 ? value.slice(0, 16).replace("T", " ") : value;
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function aiRagMessage(sync?: AiRagSyncSummary) {
  if (!sync) return "";
  if (!sync.ok) return `AI/RAG 生成失败：${sync.error || sync.message}`;
  return `文物已入库；AI/RAG 文档已生成；关系候选已更新；当前 AI/RAG 覆盖率：${sync.coverage}`;
}

const ARTIFACT_CARD_CROP_ASPECT = 4 / 3;
const MUSEUM_CARD_CROP_ASPECT = 16 / 9;
const CROP_HELP_TEXT = "裁剪框内区域 = 前端卡片中可见区域，框外部分可能不会显示。";

function cropOutputSize(aspect: number) {
  return Math.abs(aspect - MUSEUM_CARD_CROP_ASPECT) < 0.01
    ? { width: 1600, height: 900 }
    : { width: 1200, height: 900 };
}

function clampCropBox(box: CropBox, bounds: { width: number; height: number }) {
  const width = Math.min(box.width, bounds.width);
  const height = Math.min(box.height, bounds.height);
  return {
    width,
    height,
    x: Math.min(Math.max(0, box.x), Math.max(0, bounds.width - width)),
    y: Math.min(Math.max(0, box.y), Math.max(0, bounds.height - height)),
  };
}

function initialCropBox(bounds: { width: number; height: number }, aspect: number, scale = 0.84): CropBox {
  let width = bounds.width * scale;
  let height = width / aspect;
  if (height > bounds.height * scale) {
    height = bounds.height * scale;
    width = height * aspect;
  }
  return {
    x: (bounds.width - width) / 2,
    y: (bounds.height - height) / 2,
    width,
    height,
  };
}

function ImageCropperPanel({
  request,
  onCancel,
  onConfirm,
}: {
  request: CropTarget;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [box, setBox] = useState<CropBox | null>(null);
  const [imageBounds, setImageBounds] = useState({ width: 0, height: 0 });
  const [cropScale, setCropScale] = useState(84);
  const [dragStart, setDragStart] = useState<{
    pointerId: number;
    pointerX: number;
    pointerY: number;
    box: CropBox;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const resetCrop = () => {
    const image = imgRef.current;
    if (!image) return;
    const width = image.clientWidth;
    const height = image.clientHeight;
    if (!width || !height) return;
    const bounds = { width, height };
    setImageBounds(bounds);
    setBox(initialCropBox(bounds, request.aspect, cropScale / 100));
  };

  useEffect(() => {
    setBox(null);
    setCropScale(84);
    setError("");
  }, [request.previewUrl]);

  useEffect(() => {
    if (!imageBounds.width || !imageBounds.height) return;
    const centered = initialCropBox(imageBounds, request.aspect, cropScale / 100);
    setBox((current) => {
      if (!current) return centered;
      const width = centered.width;
      const height = centered.height;
      return clampCropBox(
        {
          x: current.x + (current.width - width) / 2,
          y: current.y + (current.height - height) / 2,
          width,
          height,
        },
        imageBounds,
      );
    });
  }, [cropScale, imageBounds, request.aspect]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!box) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart({
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      box,
    });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart || !box) return;
    const next = clampCropBox(
      {
        ...dragStart.box,
        x: dragStart.box.x + event.clientX - dragStart.pointerX,
        y: dragStart.box.y + event.clientY - dragStart.pointerY,
      },
      imageBounds,
    );
    setBox(next);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart?.pointerId === event.pointerId) setDragStart(null);
  };

  const confirmCrop = async () => {
    const image = imgRef.current;
    if (!image || !box || !imageBounds.width || !imageBounds.height) return;
    setSaving(true);
    setError("");
    try {
      const output = cropOutputSize(request.aspect);
      const canvas = document.createElement("canvas");
      canvas.width = output.width;
      canvas.height = output.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("当前浏览器不支持图片裁剪。");
      const sourceX = (box.x / imageBounds.width) * image.naturalWidth;
      const sourceY = (box.y / imageBounds.height) * image.naturalHeight;
      const sourceWidth = (box.width / imageBounds.width) * image.naturalWidth;
      const sourceHeight = (box.height / imageBounds.height) * image.naturalHeight;
      ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, output.width, output.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) throw new Error("裁剪图片生成失败。");
      const originalName = request.file.name.replace(/\.[^.]+$/, "");
      onConfirm(new File([blob], `${originalName}-card-crop.jpg`, { type: "image/jpeg" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-gray-950/70 p-2">
      <div className="max-h-none w-full max-w-5xl overflow-visible rounded-3xl bg-white p-3 shadow-2xl">
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-black text-gray-900">{request.title}</h2>
            <div className="mt-1 text-sm font-bold text-amber-800">{CROP_HELP_TEXT}</div>
          </div>
          <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-600">
            比例 {Math.abs(request.aspect - MUSEUM_CARD_CROP_ASPECT) < 0.01 ? "16:9" : "4:3"}
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          <div className="overflow-auto rounded-2xl bg-gray-950 p-3">
            <div className="relative mx-auto w-fit max-w-full">
              <img
                ref={imgRef}
                src={request.previewUrl}
                alt=""
                draggable={false}
                onLoad={resetCrop}
                className="block max-h-[44vh] max-w-full select-none"
              />
              {box && (
                <div className="absolute inset-0">
                  <div className="absolute left-0 right-0 top-0 bg-gray-950/55" style={{ height: box.y }} />
                  <div className="absolute left-0 bg-gray-950/55" style={{ top: box.y, width: box.x, height: box.height }} />
                  <div
                    className="absolute right-0 bg-gray-950/55"
                    style={{ top: box.y, left: box.x + box.width, height: box.height }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gray-950/55" style={{ top: box.y + box.height }} />
                  <div
                    role="presentation"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    className="absolute cursor-move border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                    style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
                  >
                    <div className="h-full w-full bg-white/5" />
                    <div className="absolute left-1/3 top-0 h-full w-px bg-white/55" />
                    <div className="absolute left-2/3 top-0 h-full w-px bg-white/55" />
                    <div className="absolute left-0 top-1/3 h-px w-full bg-white/55" />
                    <div className="absolute left-0 top-2/3 h-px w-full bg-white/55" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl bg-gray-50 p-4">
            <div>
              <label className="text-xs font-black text-gray-500" htmlFor="crop-scale">
                裁剪框大小
              </label>
              <input
                id="crop-scale"
                type="range"
                min={38}
                max={96}
                value={cropScale}
                onChange={(event) => setCropScale(Number(event.target.value))}
                className="mt-2 w-full"
              />
            </div>
            <div className="rounded-2xl bg-white p-3 text-xs leading-relaxed text-gray-500">
              拖动白色裁剪框调整位置；框内内容会保存为本地图片，并同步生成缩略图。
            </div>
            <div className="text-xs text-gray-500">
              <div className="truncate font-bold text-gray-800">{request.file.name}</div>
              <div className="mt-1">{formatFileSize(request.file.size)}</div>
            </div>
            {error && <div className="rounded-2xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={saving || !box}
                onClick={confirmCrop}
                className="rounded-xl bg-gray-900 px-4 py-3 text-xs font-black text-white disabled:opacity-50"
              >
                {saving ? "正在生成..." : "使用裁剪结果"}
              </button>
              <button type="button" onClick={onCancel} className="rounded-xl bg-white px-4 py-3 text-xs font-black text-gray-700">
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminPage({ adminPath = "/admin" }: { adminPath?: AdminRoute }) {
  const [tab, setTab] = useState<AdminTab>("artifacts");
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [museums, setMuseums] = useState<MuseumAdminItem[]>([]);
  const [allMuseums, setAllMuseums] = useState<MuseumAdminItem[]>([]);
  const [selectedMuseum, setSelectedMuseum] = useState<MuseumDetailResponse | null>(null);
  const [form, setForm] = useState<ArtifactFormState>(emptyForm);
  const [museumForm, setMuseumForm] = useState<MuseumFormState>(emptyMuseumForm);
  const [query, setQuery] = useState("");
  const [artifactFilterOpen, setArtifactFilterOpen] = useState(false);
  const [artifactProvinceFilter, setArtifactProvinceFilter] = useState("");
  const [artifactCityFilter, setArtifactCityFilter] = useState("");
  const [artifactCategoryFilter, setArtifactCategoryFilter] = useState("");
  const [artifactMuseumFilter, setArtifactMuseumFilter] = useState("");
  const [museumQuery, setMuseumQuery] = useState("");
  const [museumTypeFilter, setMuseumTypeFilter] = useState("");
  const [museumGradeFilter, setMuseumGradeFilter] = useState("");
  const [museumProvinceFilter, setMuseumProvinceFilter] = useState("");
  const [museumCityFilter, setMuseumCityFilter] = useState("");
  const [museumStatusFilter, setMuseumStatusFilter] = useState<MuseumStatusFilter>("all");
  const [museumOnlyWithArtifacts, setMuseumOnlyWithArtifacts] = useState(false);
  const [museumOnlyCreatedByImport, setMuseumOnlyCreatedByImport] = useState(false);
  const [museumOnlyDuplicates, setMuseumOnlyDuplicates] = useState(false);
  const [museumArtifactQuery, setMuseumArtifactQuery] = useState("");
  const [newMuseumAlias, setNewMuseumAlias] = useState("");
  const [museumCoverFile, setMuseumCoverFile] = useState<File | null>(null);
  const [museumCoverPreviewUrl, setMuseumCoverPreviewUrl] = useState<string | null>(null);
  const [museumCoverUrlToDownload, setMuseumCoverUrlToDownload] = useState("");
  const [downloadingMuseumCoverUrl, setDownloadingMuseumCoverUrl] = useState(false);
  const [museumMessage, setMuseumMessage] = useState<string | null>(null);
  const [imageFilter, setImageFilter] = useState<ArtifactImageFilter>("all");
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageFilePreviewUrl, setImageFilePreviewUrl] = useState<string | null>(null);
  const [imageUrlToDownload, setImageUrlToDownload] = useState("");
  const [imageUploadMessage, setImageUploadMessage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [downloadingImageUrl, setDownloadingImageUrl] = useState(false);
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
  const [rowImageSelections, setRowImageSelections] = useState<Record<string, RowImageSelection>>({});
  const [rowImageUrls, setRowImageUrls] = useState<Record<string, string>>({});
  const [rowUploadingIds, setRowUploadingIds] = useState<Record<string, boolean>>({});
  const [rowDownloadingIds, setRowDownloadingIds] = useState<Record<string, boolean>>({});
  const [rowImageErrors, setRowImageErrors] = useState<Record<string, string>>({});
  const [editorRecommendationDrafts, setEditorRecommendationDrafts] = useState<Record<string, EditorRecommendationDraft>>({});
  const [editorRecommendationSavingIds, setEditorRecommendationSavingIds] = useState<Record<string, boolean>>({});
  const [failedImageIds, setFailedImageIds] = useState<Record<string, boolean>>({});
  const [localImageFileStatuses, setLocalImageFileStatuses] = useState<Record<string, ArtifactLocalImageFileStatus>>({});
  const [adminTokenInput, setAdminTokenInput] = useState(() => getAuthToken() || "");
  const [recommendationsConfig, setRecommendationsConfig] = useState<HomeRecommendationsConfig>(() => emptyHomeRecommendationsConfig());
  const [resolvedRecommendations, setResolvedRecommendations] = useState<ResolvedHomeRecommendations | null>(null);
  const [recommendationTab, setRecommendationTab] = useState<"artifacts" | "exhibitions" | "editor-picks">("artifacts");
  const [recommendationSearchQuery, setRecommendationSearchQuery] = useState("");
  const [recommendationArtifactCandidates, setRecommendationArtifactCandidates] = useState<Artifact[]>([]);
  const [recommendationExhibitionCandidates, setRecommendationExhibitionCandidates] = useState<Exhibition[]>([]);
  const [recommendationsSaving, setRecommendationsSaving] = useState(false);
  const [recommendationsMessage, setRecommendationsMessage] = useState<string | null>(null);
  const rowImageSelectionsRef = useRef(rowImageSelections);
  const imageFilePreviewUrlRef = useRef<string | null>(null);
  const museumCoverPreviewUrlRef = useRef<string | null>(null);
  const cropTargetRef = useRef<CropTarget | null>(null);
  const adminScrollRef = useRef<HTMLDivElement | null>(null);
  const artifactFormRef = useRef<HTMLFormElement | null>(null);
  const artifactListRef = useRef<HTMLElement | null>(null);
  const museumListRef = useRef<HTMLElement | null>(null);
  const museumDetailRef = useRef<HTMLElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const markArtifactImageFailed = (artifactId: string, failed: boolean) => {
    setFailedImageIds((current) => {
      if (Boolean(current[artifactId]) === failed) return current;
      return { ...current, [artifactId]: failed };
    });
  };

  const clearArtifactImageFile = () => {
    if (imageFilePreviewUrlRef.current) URL.revokeObjectURL(imageFilePreviewUrlRef.current);
    imageFilePreviewUrlRef.current = null;
    setImageFile(null);
    setImageFilePreviewUrl(null);
  };

  const setArtifactImageFileSelection = (file: File, previewUrl: string) => {
    if (imageFilePreviewUrlRef.current) URL.revokeObjectURL(imageFilePreviewUrlRef.current);
    imageFilePreviewUrlRef.current = previewUrl;
    setImageFile(file);
    setImageFilePreviewUrl(previewUrl);
  };

  const clearMuseumCoverFile = () => {
    if (museumCoverPreviewUrlRef.current) URL.revokeObjectURL(museumCoverPreviewUrlRef.current);
    museumCoverPreviewUrlRef.current = null;
    setMuseumCoverFile(null);
    setMuseumCoverPreviewUrl(null);
  };

  const setMuseumCoverFileSelection = (file: File, previewUrl: string) => {
    if (museumCoverPreviewUrlRef.current) URL.revokeObjectURL(museumCoverPreviewUrlRef.current);
    museumCoverPreviewUrlRef.current = previewUrl;
    setMuseumCoverFile(file);
    setMuseumCoverPreviewUrl(previewUrl);
  };

  const closeCropTarget = () => {
    if (cropTargetRef.current) URL.revokeObjectURL(cropTargetRef.current.previewUrl);
    cropTargetRef.current = null;
    setCropTarget(null);
  };

  const openCropTarget = (target: CropTarget) => {
    closeCropTarget();
    cropTargetRef.current = target;
    setCropTarget(target);
  };

  const openArtifactCrop = (file: File, title: string, artifact?: Artifact) => {
    const validationError = validateArtifactImageFile(file);
    if (validationError) {
      if (artifact) {
        setRowImageErrors((current) => ({ ...current, [String(artifact.id)]: validationError }));
      } else {
        setError(validationError);
      }
      return;
    }

    const base = {
      file,
      previewUrl: URL.createObjectURL(file),
      aspect: ARTIFACT_CARD_CROP_ASPECT,
      title,
    };
    if (artifact) {
      openCropTarget({
        ...base,
        kind: "artifact-row",
        artifactId: String(artifact.id),
        artifactName: artifact.name || String(artifact.id),
      });
      return;
    }
    openCropTarget({ ...base, kind: "artifact-form" });
  };

  const openMuseumCoverCrop = (file: File) => {
    const validationError = validateArtifactImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    openCropTarget({
      kind: "museum-cover",
      file,
      previewUrl: URL.createObjectURL(file),
      aspect: MUSEUM_CARD_CROP_ASPECT,
      title: "裁剪博物馆卡片封面",
    });
  };

  const onConfirmCrop = (file: File) => {
    const target = cropTargetRef.current;
    if (!target) return;
    const previewUrl = URL.createObjectURL(file);

    if (target.kind === "artifact-form") {
      setArtifactImageFileSelection(file, previewUrl);
      setImageUploadMessage("裁剪预览已生成，点击“保存裁剪图并同步”后才会写入本地图片和缩略图。");
    }
    if (target.kind === "artifact-row") {
      setRowImageSelections((current) => {
        const existing = current[target.artifactId];
        if (existing) URL.revokeObjectURL(existing.previewUrl);
        return {
          ...current,
          [target.artifactId]: { file, previewUrl },
        };
      });
      setRowImageErrors((current) => ({ ...current, [target.artifactId]: "" }));
    }
    if (target.kind === "museum-cover") {
      setMuseumCoverFileSelection(file, previewUrl);
      setMuseumMessage("裁剪预览已生成，点击“保存裁剪封面”后才会写入本地图片和缩略图。");
    }

    closeCropTarget();
  };

  const loadArtifacts = async () => {
    const [data, imageStatusData] = await Promise.all([
      apiFetch<{ artifacts?: Artifact[] }>("/api/artifacts?limit=5000"),
      apiFetch<{ statuses?: ArtifactLocalImageFileStatus[] }>("/api/admin/artifact-image-file-status"),
    ]);
    setArtifacts(Array.isArray(data.artifacts) ? data.artifacts : []);
    setLocalImageFileStatuses(
      Object.fromEntries((imageStatusData.statuses || []).map((item) => [String(item.artifactId), item])),
    );
  };

  const loadMuseums = async () => {
    const params = new URLSearchParams();
    params.set("pageSize", "300");
    if (museumQuery.trim()) params.set("q", museumQuery.trim());
    if (museumTypeFilter) params.set("type", museumTypeFilter);
    if (museumGradeFilter) params.set("grade", museumGradeFilter);
    if (museumProvinceFilter) params.set("province", museumProvinceFilter);
    if (museumCityFilter) params.set("city", museumCityFilter);
    if (museumStatusFilter === "with-artifacts") params.set("hasArtifacts", "true");
    if (museumStatusFilter === "without-artifacts") params.set("hasArtifacts", "false");
    if (museumStatusFilter === "created-by-import") params.set("createdByImport", "true");
    if (museumStatusFilter === "no-cover") params.set("hasCover", "false");
    if (museumStatusFilter === "duplicates") params.set("suspectedDuplicate", "true");
    const data = await apiFetch<{ museums?: MuseumAdminItem[] }>(`/api/admin/museums?${params.toString()}`);
    setMuseums(Array.isArray(data.museums) ? data.museums : []);
  };

  const loadMuseumCatalog = async () => {
    const data = await apiFetch<{ museums?: MuseumAdminItem[] }>("/api/admin/museums?pageSize=500");
    const items = Array.isArray(data.museums) ? data.museums : [];
    setAllMuseums(items);
    setMuseums((current) => current.length ? current : items);
  };

  const loadMuseumDetail = async (id: string) => {
    const data = await apiFetch<MuseumDetailResponse>(`/api/admin/museums/${encodeURIComponent(id)}`);
    setSelectedMuseum(data);
    setMuseumForm(museumFormFromMuseum(data.museum));
    setMuseumCoverUrlToDownload("");
    setMuseumMessage(null);
  };

  useEffect(() => {
    let cancelled = false;

    const loadAdminData = async () => {
      setLoading(true);
      setError(null);
      setForbidden(false);

      try {
        const currentUser = await me();
        if (currentUser.profile.role !== "admin") {
          if (!cancelled) setForbidden(true);
          return;
        }

        const [usersResponse, statsResponse, artifactsResponse, imageStatusResponse, museumsResponse, recommendationsResponse] = await Promise.all([
          getAdminUsers(),
          getAdminStats(),
          apiFetch<{ artifacts?: Artifact[] }>("/api/artifacts?limit=5000"),
          apiFetch<{ statuses?: ArtifactLocalImageFileStatus[] }>("/api/admin/artifact-image-file-status"),
          apiFetch<{ museums?: MuseumAdminItem[] }>("/api/admin/museums?pageSize=300"),
          fetchAdminRecommendations(),
        ]);
        if (cancelled) return;

        setUsers(usersResponse.users);
        setStats(statsResponse);
        setArtifacts(Array.isArray(artifactsResponse.artifacts) ? artifactsResponse.artifacts : []);
        setMuseums(Array.isArray(museumsResponse.museums) ? museumsResponse.museums : []);
        setAllMuseums(Array.isArray(museumsResponse.museums) ? museumsResponse.museums : []);
        setRecommendationsConfig(recommendationsResponse.config);
        setResolvedRecommendations(recommendationsResponse.resolved);
        setLocalImageFileStatuses(
          Object.fromEntries((imageStatusResponse.statuses || []).map((item) => [String(item.artifactId), item])),
        );
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes("Forbidden")) {
          setForbidden(true);
          return;
        }
        if (message.includes("Authorization") || message.includes("401")) {
          navigate("/login");
          return;
        }
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAdminData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    rowImageSelectionsRef.current = rowImageSelections;
  }, [rowImageSelections]);

  useEffect(() => {
    cropTargetRef.current = cropTarget;
  }, [cropTarget]);

  useEffect(() => {
    if (loading || (!adminPath.startsWith("/admin/museums") && tab !== "museums")) return;
    const handle = window.setTimeout(() => {
      loadMuseums().catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [adminPath, loading, museumCityFilter, museumGradeFilter, museumProvinceFilter, museumQuery, museumStatusFilter, museumTypeFilter, tab]);

  useEffect(() => {
    if (loading || adminPath !== "/admin/recommendations") return;
    const handle = window.setTimeout(() => {
      refreshRecommendationCandidates();
    }, 250);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPath, loading, recommendationSearchQuery, recommendationTab]);

  useEffect(() => {
    return () => {
      Object.values(rowImageSelectionsRef.current).forEach((selection) => URL.revokeObjectURL(selection.previewUrl));
      if (imageFilePreviewUrlRef.current) URL.revokeObjectURL(imageFilePreviewUrlRef.current);
      if (museumCoverPreviewUrlRef.current) URL.revokeObjectURL(museumCoverPreviewUrlRef.current);
      if (cropTargetRef.current) URL.revokeObjectURL(cropTargetRef.current.previewUrl);
    };
  }, []);

  const filteredArtifacts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return artifacts.filter((artifact) => {
      const artifactId = String(artifact.id);
      const status = getArtifactImageStatusInfo(
        artifact,
        Boolean(failedImageIds[artifactId]),
        localImageFileStatuses[artifactId],
      );
      if (!artifactMatchesImageFilter(status, imageFilter)) return false;
      const currentMuseumId = artifactMuseumId(artifact);
      const currentMuseumName = artifactCanonicalMuseumName(artifact);
      const legacyMuseumName = text(artifact.museumName || artifact.museum);
      const currentMuseumItem = allMuseums.find((museum) => (
        museum.id === currentMuseumId ||
        museum.name === currentMuseumName ||
        museum.name === legacyMuseumName
      ));
      if (artifactMuseumFilter) {
        const selectedMuseumItem = allMuseums.find((museum) => museum.id === artifactMuseumFilter);
        const selectedName = selectedMuseumItem?.name || "";
        if (currentMuseumId !== artifactMuseumFilter && currentMuseumName !== selectedName && legacyMuseumName !== selectedName) {
          return false;
        }
      }
      if (artifactProvinceFilter && currentMuseumItem?.province !== artifactProvinceFilter) return false;
      if (artifactCityFilter && currentMuseumItem?.city !== artifactCityFilter) return false;
      if (artifactCategoryFilter && text(artifact.category) !== artifactCategoryFilter) return false;
      if (!keyword) return true;
      const haystack = [
        artifact.name,
        artifact.museumName,
        artifact.museum,
        artifactCanonicalMuseumName(artifact),
        artifact.dynasty,
        artifact.period,
        artifact.category,
      ].map(text).join(" ").toLowerCase();
      return haystack.includes(keyword);
    });
  }, [allMuseums, artifactCategoryFilter, artifactCityFilter, artifactMuseumFilter, artifactProvinceFilter, artifacts, failedImageIds, imageFilter, localImageFileStatuses, query]);

  const imageFilterCounts = useMemo(() => {
    const counts: Record<ArtifactImageFilter, number> = {
      all: artifacts.length,
      "no-image": 0,
      "remote-only": 0,
      "local-broken": 0,
      "local-complete": 0,
      "no-local": 0,
    };

    artifacts.forEach((artifact) => {
      const artifactId = String(artifact.id);
      const status = getArtifactImageStatusInfo(
        artifact,
        Boolean(failedImageIds[artifactId]),
        localImageFileStatuses[artifactId],
      );
      counts[status.status] += 1;
      if (!status.fields.hasLocalImage) counts["no-local"] += 1;
    });

    return counts;
  }, [artifacts, failedImageIds, localImageFileStatuses]);

  const artifactMuseumOptions = useMemo(() => {
    const counts = new Map<string, number>();
    artifacts.forEach((artifact) => {
      const id = artifactMuseumId(artifact);
      const canonical = artifactCanonicalMuseumName(artifact);
      const key = id || canonical;
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const fromMuseums = allMuseums
      .map((museum) => ({ id: museum.id, name: museum.name, count: counts.get(museum.id) || counts.get(museum.name) || museum.artifactCount || 0 }))
      .filter((museum) => museum.count > 0)
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-CN"));
    const knownNames = new Set(fromMuseums.map((museum) => museum.name));
    const legacy = Array.from(counts.entries())
      .filter(([key]) => !allMuseums.some((museum) => museum.id === key || museum.name === key) && !knownNames.has(key))
      .map(([key, count]) => ({ id: key, name: key, count }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-CN"));
    return [...fromMuseums, ...legacy];
  }, [allMuseums, artifacts]);

  const artifactCategoryOptions = useMemo(() => (
    Array.from(new Set(artifacts.map((artifact) => text(artifact.category)).filter(Boolean)))
      .sort((left, right) => left.localeCompare(right, "zh-CN"))
  ), [artifacts]);

  const artifactCityOptions = useMemo(() => (
    artifactProvinceFilter
      ? [...(CITY_OPTIONS_BY_PROVINCE[artifactProvinceFilter] || [])]
      : Array.from(new Set(allMuseums.map((museum) => museum.city).filter(Boolean) as string[]))
        .sort((left, right) => left.localeCompare(right, "zh-CN"))
  ), [allMuseums, artifactProvinceFilter]);

  const imageFilterLabel = (filter: ArtifactImageFilter) => {
    const labels: Record<ArtifactImageFilter, string> = {
      all: "全部",
      "local-complete": "本地图已完成",
      "remote-only": "仅有外链图",
      "no-local": "无本地图",
      "local-broken": "本地图异常",
      "no-image": "完全无图",
    };
    return labels[filter];
  };

  const activeArtifactFilterTags = useMemo(() => {
    const tags: string[] = [];
    if (query.trim()) tags.push(`搜索：${query.trim()}`);
    if (artifactProvinceFilter) tags.push(`省份：${artifactProvinceFilter}`);
    if (artifactCityFilter) tags.push(`城市：${artifactCityFilter}`);
    if (artifactCategoryFilter) tags.push(`类型：${artifactCategoryFilter}`);
    if (imageFilter !== "all") tags.push(`图片：${imageFilterLabel(imageFilter)}`);
    if (artifactMuseumFilter) {
      tags.push(`馆藏：${artifactMuseumOptions.find((museum) => museum.id === artifactMuseumFilter)?.name || artifactMuseumFilter}`);
    }
    return tags;
  }, [artifactCategoryFilter, artifactCityFilter, artifactMuseumFilter, artifactMuseumOptions, artifactProvinceFilter, imageFilter, query]);

  const museumFilterOptions = useMemo(() => {
    const source = allMuseums.length ? allMuseums : museums;
    const types = [...MUSEUM_TYPE_OPTIONS];
    const grades = [...MUSEUM_GRADE_OPTIONS];
    const provinces = [...PROVINCE_OPTIONS];
    const cities = museumProvinceFilter
      ? [...(CITY_OPTIONS_BY_PROVINCE[museumProvinceFilter] || [])]
      : Array.from(new Set(Object.values(CITY_OPTIONS_BY_PROVINCE).flat())).sort((a, b) => a.localeCompare(b, "zh-CN"));
    const provinceCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();
    const gradeCounts = new Map<string, number>();
    source.forEach((museum) => {
      const province = museum.province || "其他";
      const type = museum.type || "其他";
      const grade = museum.grade || "未定级";
      provinceCounts.set(province, (provinceCounts.get(province) || 0) + 1);
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      gradeCounts.set(grade, (gradeCounts.get(grade) || 0) + 1);
    });
    return { types, grades, provinces, cities, provinceCounts, typeCounts, gradeCounts };
  }, [allMuseums, museumProvinceFilter, museums]);

  const museumFormCityOptions = useMemo(() => CITY_OPTIONS_BY_PROVINCE[museumForm.province] || [], [museumForm.province]);
  const museumFormUsesCustomCity = museumForm.city === "__custom__" || Boolean(museumForm.city && !museumFormCityOptions.includes(museumForm.city));

  const museumStatusCounts = useMemo(() => {
    const source = allMuseums.length ? allMuseums : museums;
    return {
      all: source.length,
      "with-artifacts": source.filter((museum) => (museum.artifactCount || 0) > 0).length,
      "without-artifacts": source.filter((museum) => (museum.artifactCount || 0) === 0).length,
      "created-by-import": source.filter((museum) => museum.createdByImport).length,
      "no-cover": source.filter((museum) => !museum.hasCover).length,
      duplicates: 0,
    } as Record<MuseumStatusFilter, number>;
  }, [allMuseums, museums]);

  const selectedMuseumArtifacts = useMemo(() => {
    const keyword = museumArtifactQuery.trim().toLowerCase();
    const source = selectedMuseum?.artifacts || [];
    if (!keyword) return source;
    return source.filter((artifact) => [
      artifact.name,
      artifact.dynasty,
      artifact.period,
      artifact.category,
      artifact.material,
      artifact.description,
    ].map(text).join(" ").toLowerCase().includes(keyword));
  }, [museumArtifactQuery, selectedMuseum]);

  const activeMuseumFilterTags = useMemo(() => {
    const tags: string[] = [];
    if (museumQuery.trim()) tags.push(`搜索：${museumQuery.trim()}`);
    if (museumProvinceFilter) tags.push(`省份：${museumProvinceFilter}`);
    if (museumCityFilter) tags.push(`城市：${museumCityFilter}`);
    if (museumTypeFilter) tags.push(`类型：${museumTypeFilter}`);
    if (museumGradeFilter) tags.push(`等级：${museumGradeFilter}`);
    const statusLabels: Record<MuseumStatusFilter, string> = {
      all: "",
      "with-artifacts": "有文物",
      "without-artifacts": "无文物",
      "created-by-import": "自动创建",
      "no-cover": "无封面图",
      duplicates: "疑似重复",
    };
    if (museumStatusFilter !== "all") tags.push(statusLabels[museumStatusFilter]);
    return tags;
  }, [museumCityFilter, museumGradeFilter, museumProvinceFilter, museumQuery, museumStatusFilter, museumTypeFilter]);

  const onLogout = async () => {
    await AuthService.logout();
    navigate("/login");
  };

  const onSaveArtifact = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = buildArtifactPayload(form);
      if (!payload.name || !payload.museum) {
        throw new Error("请填写文物名称和馆藏单位。");
      }

      const path = form.id ? `/api/artifacts/${encodeURIComponent(form.id)}` : "/api/artifacts";
      const result = await apiFetch<{ aiRagSync?: AiRagSyncSummary }>(path, {
        method: form.id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      const message = aiRagMessage(result.aiRagSync);
      if (message) setImageUploadMessage(message);
      setForm(emptyForm);
      await loadArtifacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const onUploadArtifactImage = async () => {
    if (!form.id) {
      setError("请先选择要编辑的文物。");
      return;
    }
    if (!imageFile) {
      setError("请先选择要上传的图片。");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setError("请先登录管理员账号后再上传图片。");
      return;
    }

    setUploadingImage(true);
    setError(null);
    setImageUploadMessage(null);

    try {
      const formData = new FormData();
      formData.set("image", imageFile);
      const response = await fetch(apiUrl(`/api/admin/artifacts/${encodeURIComponent(form.id)}/image`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : await response.text();
      if (!response.ok) {
        const message = typeof data === "object" && data && "error" in data ? String(data.error) : String(data);
        throw new Error(message || `上传失败：${response.status}`);
      }

      const localImageUrl = String(data.localImageUrl || data.originalPath || "");
      const localThumbnailUrl = String(data.localThumbnailUrl || data.thumbnailPath || "");
      setForm((current) => ({ ...current, imageUrl: localImageUrl || current.imageUrl }));
      clearArtifactImageFile();
      const syncMessage = aiRagMessage(data.aiRagSync);
      setImageUploadMessage(`图片已上传：${localImageUrl || "-"}，缩略图：${localThumbnailUrl || "-"}。${syncMessage}`);
      await loadArtifacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingImage(false);
    }
  };

  const onDownloadArtifactImageUrl = async () => {
    if (!form.id) {
      setError("请先选择要编辑的文物。");
      return;
    }

    const validationError = validateImageDownloadUrl(imageUrlToDownload);
    if (validationError) {
      setError(validationError);
      return;
    }

    const token = (getAuthToken() || adminTokenInput).trim();
    if (!token) {
      setError("请先登录管理员账号或填写管理员 token。");
      return;
    }
    setAuthToken(token);
    setAdminTokenInput(token);

    setDownloadingImageUrl(true);
    setError(null);
    setImageUploadMessage(null);

    try {
      const response = await fetch(apiUrl(`/api/admin/artifacts/${encodeURIComponent(form.id)}/image-url`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl: imageUrlToDownload.trim() }),
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : await response.text();
      if (!response.ok) {
        const message = typeof data === "object" && data && "error" in data ? String(data.error) : String(data);
        throw new Error(message || `下载失败：${response.status}`);
      }

      const localImageUrl = String(data.localImageUrl || data.originalPath || "");
      const localThumbnailUrl = String(data.localThumbnailUrl || data.thumbnailPath || "");
      const savedImageUrl = String(data.imageUrl || data.sourceImageUrl || imageUrlToDownload.trim());
      setForm((current) => ({ ...current, imageUrl: savedImageUrl || current.imageUrl }));
      setImageUrlToDownload("");
      const syncMessage = aiRagMessage(data.aiRagSync);
      setImageUploadMessage(`图片已下载：${localImageUrl || "-"}，缩略图：${localThumbnailUrl || "-"}。${syncMessage}`);
      await loadArtifacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloadingImageUrl(false);
    }
  };

  const saveAdminTokenInput = () => {
    const token = adminTokenInput.trim();
    if (!token) {
      setError("请填写管理员 token。");
      return;
    }
    setAuthToken(token);
    setError(null);
    setImageUploadMessage("管理员 token 已保存。");
  };

  const getEditorRecommendationDraft = (artifact: Artifact): EditorRecommendationDraft => {
    const artifactId = String(artifact.id);
    return editorRecommendationDrafts[artifactId] || {
      isEditorRecommended: artifactIsEditorRecommended(artifact),
      editorRecommendationOrder: artifactEditorRecommendationOrder(artifact),
    };
  };

  const updateEditorRecommendationDraft = (
    artifact: Artifact,
    patch: Partial<EditorRecommendationDraft>,
  ) => {
    const artifactId = String(artifact.id);
    setEditorRecommendationDrafts((current) => ({
      ...current,
      [artifactId]: {
        ...(current[artifactId] || {
          isEditorRecommended: artifactIsEditorRecommended(artifact),
          editorRecommendationOrder: artifactEditorRecommendationOrder(artifact),
        }),
        ...patch,
      },
    }));
  };

  const onSaveEditorRecommendation = async (artifact: Artifact) => {
    const artifactId = String(artifact.id);
    const draft = getEditorRecommendationDraft(artifact);

    setEditorRecommendationSavingIds((current) => ({ ...current, [artifactId]: true }));
    setError(null);
    setImageUploadMessage(null);

    try {
      const data = await apiFetch<{ artifact?: Artifact }>(
        `/api/admin/artifacts/${encodeURIComponent(artifactId)}/editor-recommendation`,
        {
          method: "PATCH",
          body: JSON.stringify({
            isEditorRecommended: draft.isEditorRecommended,
            editorRecommendationOrder: draft.editorRecommendationOrder,
          }),
        },
      );
      if (!data.artifact) throw new Error("接口没有返回更新后的文物。");
      setArtifacts((current) => current.map((item) => String(item.id) === artifactId ? data.artifact! : item));
      setEditorRecommendationDrafts((current) => {
        const next = { ...current };
        delete next[artifactId];
        return next;
      });
      setImageUploadMessage(`「${data.artifact.name || artifact.name || artifactId}」首页推荐设置已保存。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEditorRecommendationSavingIds((current) => ({ ...current, [artifactId]: false }));
    }
  };

  const onSelectRowImage = (artifactId: string, file: File | null) => {
    setRowImageErrors((current) => ({ ...current, [artifactId]: "" }));
    if (!file) {
      setRowImageSelections((current) => {
        const existing = current[artifactId];
        if (existing) URL.revokeObjectURL(existing.previewUrl);
        const next = { ...current };
        delete next[artifactId];
        return next;
      });
      return;
    }

    const artifact = artifacts.find((item) => String(item.id) === artifactId);
    if (!artifact) {
      setRowImageErrors((current) => ({ ...current, [artifactId]: "未找到对应文物。" }));
      return;
    }
    openArtifactCrop(file, `裁剪文物卡片图片：${artifact.name || artifactId}`, artifact);
  };

  const onUploadRowImage = async (artifact: Artifact) => {
    const artifactId = String(artifact.id);
    const selection = rowImageSelections[artifactId];
    if (!selection) {
      setRowImageErrors((current) => ({ ...current, [artifactId]: "请先选择要上传的图片。" }));
      return;
    }

    const token = (getAuthToken() || adminTokenInput).trim();
    if (!token) {
      setRowImageErrors((current) => ({ ...current, [artifactId]: "请先填写管理员 token。" }));
      return;
    }
    setAuthToken(token);
    setAdminTokenInput(token);

    setRowUploadingIds((current) => ({ ...current, [artifactId]: true }));
    setRowImageErrors((current) => ({ ...current, [artifactId]: "" }));
    setError(null);
    setImageUploadMessage(null);

    try {
      const formData = new FormData();
      formData.set("image", selection.file);
      const response = await fetch(apiUrl(`/api/admin/artifacts/${encodeURIComponent(artifactId)}/image`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : await response.text();
      if (!response.ok) {
        const message = typeof data === "object" && data && "error" in data ? String(data.error) : String(data);
        throw new Error(message || `上传失败：${response.status}`);
      }

      setRowImageSelections((current) => {
        const existing = current[artifactId];
        if (existing) URL.revokeObjectURL(existing.previewUrl);
        const next = { ...current };
        delete next[artifactId];
        return next;
      });
      setFailedImageIds((current) => {
        const next = { ...current };
        delete next[artifactId];
        return next;
      });
      const syncMessage = aiRagMessage(data.aiRagSync);
      setImageUploadMessage(`「${artifact.name || artifactId}」图片上传成功。${syncMessage}`);
      await loadArtifacts();
    } catch (e) {
      setRowImageErrors((current) => ({ ...current, [artifactId]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setRowUploadingIds((current) => ({ ...current, [artifactId]: false }));
    }
  };

  const onDownloadRowImageUrl = async (artifact: Artifact) => {
    const artifactId = String(artifact.id);
    const imageFields = getArtifactImageFields(artifact);
    const rowHasCustomUrl = Object.prototype.hasOwnProperty.call(rowImageUrls, artifactId);
    const imageUrl = (rowHasCustomUrl ? rowImageUrls[artifactId] : suggestedRemoteImageUrl(imageFields)).trim();
    const validationError = validateImageDownloadUrl(imageUrl);
    if (validationError) {
      setRowImageErrors((current) => ({ ...current, [artifactId]: validationError }));
      return;
    }

    const token = (getAuthToken() || adminTokenInput).trim();
    if (!token) {
      setRowImageErrors((current) => ({ ...current, [artifactId]: "请先填写管理员 token。" }));
      return;
    }
    setAuthToken(token);
    setAdminTokenInput(token);

    setRowDownloadingIds((current) => ({ ...current, [artifactId]: true }));
    setRowImageErrors((current) => ({ ...current, [artifactId]: "" }));
    setError(null);
    setImageUploadMessage(null);

    try {
      const response = await fetch(apiUrl(`/api/admin/artifacts/${encodeURIComponent(artifactId)}/image-url`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl }),
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : await response.text();
      if (!response.ok) {
        const message = typeof data === "object" && data && "error" in data ? String(data.error) : String(data);
        throw new Error(message || `下载失败：${response.status}`);
      }

      setRowImageUrls((current) => ({ ...current, [artifactId]: "" }));
      setFailedImageIds((current) => {
        const next = { ...current };
        delete next[artifactId];
        return next;
      });
      const syncMessage = aiRagMessage(data.aiRagSync);
      setImageUploadMessage(`「${artifact.name || artifactId}」图片下载成功。${syncMessage}`);
      await loadArtifacts();
    } catch (e) {
      setRowImageErrors((current) => ({ ...current, [artifactId]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setRowDownloadingIds((current) => ({ ...current, [artifactId]: false }));
    }
  };

  const onEditArtifact = (artifact: Artifact) => {
    setTab("artifacts");
    setForm(formFromArtifact(artifact));
    clearArtifactImageFile();
    setImageUrlToDownload("");
    setImageUploadMessage(null);
    navigate("/admin/artifacts/new");
    adminScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDeleteArtifact = async (artifact: Artifact) => {
    const name = artifact.name || artifact.id;
    if (!window.confirm(`确定要删除「${name}」吗？`)) return;
    setSaving(true);
    setError(null);

    try {
      const result = await apiFetch<{ aiRagSync?: AiRagSyncSummary }>(`/api/artifacts/${encodeURIComponent(String(artifact.id))}`, { method: "DELETE" });
      const message = aiRagMessage(result.aiRagSync);
      if (message) setImageUploadMessage(message);
      if (form.id === String(artifact.id)) setForm(emptyForm);
      await loadArtifacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const loadImportTemplate = async () => {
    setError(null);
    try {
      const data = await apiFetch<{ template: unknown }>("/api/import/template");
      setImportText(JSON.stringify(data.template, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const runImport = async () => {
    setSaving(true);
    setError(null);
    setImportResult(null);

    try {
      const job = JSON.parse(importText);
      const result = await apiFetch<{ validRecords?: number; fileStoreCount?: number; dbSync?: { inserted: number; updated: number; aiRagSync?: AiRagSyncSummary }; aiRagSync?: AiRagSyncSummary }>(
        "/api/import/run",
        { method: "POST", body: JSON.stringify(job) },
      );
      const sync = result.dbSync?.aiRagSync || result.aiRagSync;
      const syncMessage = aiRagMessage(sync);
      const museumReport = (result.dbSync as any)?.museumReport;
      const museumText = museumReport
        ? ` 博物馆识别：已有 ${museumReport.matched?.length || 0}，新增 ${museumReport.created?.length || 0}，疑似重复 ${museumReport.possibleDuplicates?.length || 0}。`
        : "";
      setImportResult(
        `导入成功：${result.validRecords ?? 0} 条有效记录，文件库 ${result.fileStoreCount ?? 0} 条，DB 新增 ${result.dbSync?.inserted ?? 0}、更新 ${result.dbSync?.updated ?? 0}。${museumText}${syncMessage}`,
      );
      await loadArtifacts();
      await loadMuseumCatalog();
      await loadMuseums();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const onSelectMuseum = async (museum: MuseumAdminItem) => {
    setTab("museums");
    setError(null);
    try {
      await loadMuseumDetail(museum.id);
      navigate("/admin/museums/list");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onSaveMuseum = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!museumForm.id) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ museum: MuseumAdminItem; aiRagSync?: AiRagSyncSummary }>(`/api/admin/museums/${encodeURIComponent(museumForm.id)}`, {
        method: "PUT",
        body: JSON.stringify(museumPayloadFromForm(museumForm)),
      });
      setMuseumMessage(`博物馆信息已保存。${aiRagMessage(result.aiRagSync)}`);
      await loadMuseumCatalog();
      await loadMuseums();
      await loadMuseumDetail(result.museum.id);
      await loadArtifacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const onUploadMuseumCover = async () => {
    if (!museumForm.id || !museumCoverFile) return;
    const token = (getAuthToken() || adminTokenInput).trim();
    if (!token) {
      setError("请先登录管理员账号或填写管理员 token。");
      return;
    }
    setAuthToken(token);
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("image", museumCoverFile);
      const response = await fetch(apiUrl(`/api/admin/museums/${encodeURIComponent(museumForm.id)}/cover`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "上传失败");
      clearMuseumCoverFile();
      setMuseumMessage(`博物馆封面已上传。${aiRagMessage(data.aiRagSync)}`);
      await loadMuseumCatalog();
      await loadMuseums();
      await loadMuseumDetail(museumForm.id);
      await loadArtifacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const onDownloadMuseumCoverUrl = async () => {
    if (!museumForm.id) {
      setError("请先选择要编辑的博物馆。");
      return;
    }

    const validationError = validateImageDownloadUrl(museumCoverUrlToDownload);
    if (validationError) {
      setError(validationError);
      return;
    }

    const token = (getAuthToken() || adminTokenInput).trim();
    if (!token) {
      setError("请先登录管理员账号或填写管理员 token。");
      return;
    }
    setAuthToken(token);
    setAdminTokenInput(token);

    setDownloadingMuseumCoverUrl(true);
    setError(null);
    setMuseumMessage(null);
    try {
      const response = await fetch(apiUrl(`/api/admin/museums/${encodeURIComponent(museumForm.id)}/cover-url`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl: museumCoverUrlToDownload.trim() }),
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : await response.text();
      if (!response.ok) {
        const message = typeof data === "object" && data && "error" in data ? String(data.error) : String(data);
        throw new Error(message || `下载失败：${response.status}`);
      }

      setMuseumCoverUrlToDownload("");
      const localCoverImageUrl = String(data.localCoverImageUrl || "");
      const localCoverThumbnailUrl = String(data.localCoverThumbnailUrl || "");
      setMuseumMessage(
        `博物馆封面已下载：${localCoverImageUrl || "-"}，缩略图：${localCoverThumbnailUrl || "-"}。${aiRagMessage(data.aiRagSync)}`,
      );
      await loadMuseumCatalog();
      await loadMuseums();
      await loadMuseumDetail(museumForm.id);
      await loadArtifacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloadingMuseumCoverUrl(false);
    }
  };

  const onDeleteMuseumCover = async () => {
    if (!museumForm.id) return;
    const token = (getAuthToken() || adminTokenInput).trim();
    if (!token) {
      setError("请先登录管理员账号或填写管理员 token。");
      return;
    }
    setAuthToken(token);
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(apiUrl(`/api/admin/museums/${encodeURIComponent(museumForm.id)}/cover`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "删除失败");
      clearMuseumCoverFile();
      setMuseumMessage(`博物馆封面已删除。${aiRagMessage(data.aiRagSync)}`);
      await loadMuseumCatalog();
      await loadMuseums();
      await loadMuseumDetail(museumForm.id);
      await loadArtifacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const onAddMuseumAlias = async () => {
    if (!museumForm.id || !newMuseumAlias.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ aiRagSync?: AiRagSyncSummary }>(`/api/admin/museums/${encodeURIComponent(museumForm.id)}/aliases`, {
        method: "POST",
        body: JSON.stringify({ alias: newMuseumAlias.trim() }),
      });
      setNewMuseumAlias("");
      setMuseumMessage(`别名已新增。${aiRagMessage(result.aiRagSync)}`);
      await loadMuseumCatalog();
      await loadMuseums();
      await loadMuseumDetail(museumForm.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const onDeleteMuseumAlias = async (aliasId: string) => {
    if (!museumForm.id) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/museums/${encodeURIComponent(museumForm.id)}/aliases/${encodeURIComponent(aliasId)}`, { method: "DELETE" });
      setMuseumMessage("别名已删除。");
      await loadMuseumCatalog();
      await loadMuseums();
      await loadMuseumDetail(museumForm.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const refreshRecommendationCandidates = async () => {
    setError(null);
    try {
      if (recommendationTab === "artifacts") {
        const data = await searchRecommendationArtifactCandidates(recommendationSearchQuery);
        setRecommendationArtifactCandidates(Array.isArray(data.artifacts) ? data.artifacts : []);
        return;
      }
      if (recommendationTab === "exhibitions") {
        const data = await searchRecommendationExhibitionCandidates(recommendationSearchQuery);
        setRecommendationExhibitionCandidates(Array.isArray(data.exhibitions) ? data.exhibitions : []);
        return;
      }
      const [artifactData, exhibitionData] = await Promise.all([
        searchRecommendationArtifactCandidates(recommendationSearchQuery),
        searchRecommendationExhibitionCandidates(recommendationSearchQuery),
      ]);
      setRecommendationArtifactCandidates(Array.isArray(artifactData.artifacts) ? artifactData.artifacts : []);
      setRecommendationExhibitionCandidates(Array.isArray(exhibitionData.exhibitions) ? exhibitionData.exhibitions : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const recommendationItemsForTab = (config = recommendationsConfig) => {
    if (recommendationTab === "artifacts") return config.artifactRecommendations;
    if (recommendationTab === "exhibitions") return config.exhibitionRecommendations;
    return config.editorPicks.items;
  };

  const setRecommendationItemsForTab = (items: HomeRecommendationItem[]) => {
    const normalizedItems = items
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((item, index) => ({ ...item, order: index + 1 }));
    setRecommendationsConfig((current) => {
      if (recommendationTab === "artifacts") return { ...current, artifactRecommendations: normalizedItems };
      if (recommendationTab === "exhibitions") return { ...current, exhibitionRecommendations: normalizedItems };
      return { ...current, editorPicks: { ...current.editorPicks, items: normalizedItems } };
    });
  };

  const addRecommendationItem = (type: RecommendationTargetType, targetId: string) => {
    const currentItems = recommendationItemsForTab();
    if (currentItems.some((item) => item.type === type && item.targetId === targetId)) {
      setRecommendationsMessage("这个内容已经在当前栏目里。");
      return;
    }
    const item: HomeRecommendationItem = {
      id: `rec-${type}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      type,
      targetId,
      title: "",
      reason: "",
      coverUrl: "",
      order: currentItems.length + 1,
      enabled: true,
    };
    setRecommendationItemsForTab([...currentItems, item]);
    setRecommendationsMessage("已加入当前推荐栏目，记得保存。");
  };

  const patchRecommendationItem = (id: string, patch: Partial<HomeRecommendationItem>) => {
    setRecommendationItemsForTab(recommendationItemsForTab().map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const removeRecommendationItem = (id: string) => {
    setRecommendationItemsForTab(recommendationItemsForTab().filter((item) => item.id !== id));
  };

  const moveRecommendationItem = (id: string, direction: -1 | 1) => {
    const items = recommendationItemsForTab().slice().sort((left, right) => left.order - right.order);
    const index = items.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return;
    const nextItems = items.slice();
    [nextItems[index], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[index]];
    setRecommendationItemsForTab(nextItems);
  };

  const onSaveRecommendations = async () => {
    setRecommendationsSaving(true);
    setError(null);
    setRecommendationsMessage(null);
    try {
      const data = await saveAdminRecommendations(recommendationsConfig);
      setRecommendationsConfig(data.config);
      setResolvedRecommendations(data.resolved);
      setRecommendationsMessage("推荐配置已保存，刷新首页即可同步看到。");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRecommendationsSaving(false);
    }
  };

  const updateEditorPicksMeta = (patch: Partial<HomeRecommendationsConfig["editorPicks"]>) => {
    setRecommendationsConfig((current) => ({
      ...current,
      editorPicks: { ...current.editorPicks, ...patch },
    }));
  };

  if (forbidden) return <ForbiddenPage />;

  const regularUserCount = stats ? Math.max(stats.totalUsers - stats.adminCount, 0) : 0;

  const scrollToAdminSection = (ref: React.RefObject<HTMLElement | HTMLFormElement | null>) => {
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const featureEntries: Array<{
    title: string;
    description: string;
    actionLabel: string;
    onClick: () => void;
  }> = [
    {
      title: "文物本地上传",
      description: "进入文物表单；编辑已有文物后可选择图片并裁剪。",
      actionLabel: "去文物表单",
      onClick: () => {
        setTab("artifacts");
        scrollToAdminSection(artifactFormRef);
      },
    },
    {
      title: "文物列表补图",
      description: "筛选无本地图文物，逐条上传或从链接下载补图。",
      actionLabel: "去补图列表",
      onClick: () => {
        setTab("artifacts");
        setImageFilter("no-local");
        scrollToAdminSection(artifactListRef);
      },
    },
    {
      title: "博物馆封面上传",
      description: "筛选无封面博物馆，选择后在详情里上传封面。",
      actionLabel: "去博物馆",
      onClick: () => {
        setTab("museums");
        setMuseumStatusFilter("no-cover");
        scrollToAdminSection(selectedMuseum ? museumDetailRef : museumListRef);
      },
    },
    {
      title: "图片裁剪预览弹窗",
      description: "选择文物图片或博物馆封面后，会自动打开裁剪预览。",
      actionLabel: "去裁剪入口",
      onClick: () => {
        setTab("artifacts");
        setImageFilter("no-local");
        scrollToAdminSection(artifactListRef);
      },
    },
  ];

  const renderArtifactMobileCard = (artifact: Artifact) => {
    const artifactId = String(artifact.id);
    const imageStatus = getArtifactImageStatusInfo(
      artifact,
      Boolean(failedImageIds[artifactId]),
      localImageFileStatuses[artifactId],
    );
    const rowSelection = rowImageSelections[artifactId];
    const suggestedDownloadUrl = suggestedRemoteImageUrl(imageStatus.fields);
    const rowHasCustomUrl = Object.prototype.hasOwnProperty.call(rowImageUrls, artifactId);
    const rowDownloadUrl = rowHasCustomUrl ? rowImageUrls[artifactId] : suggestedDownloadUrl;
    const showInlineUploader = imageStatus.status !== "local-complete";
    const uploadButtonLabel = "保存裁剪图";
    const downloadButtonLabel = imageStatus.status === "local-broken" ? "从外链下载补图" : "下载补图";
    const rowHint = imageStatus.status === "remote-only"
      ? "当前只有外链图，可直接下载成本地图。"
      : imageStatus.status === "no-image"
        ? "当前完全无图，请上传图片或粘贴图片链接。"
        : imageStatus.hasMissingLocalFile
          ? "本地图片文件不存在，请重新上传或从外链补图。"
          : "图片加载失败，请重新上传或从外链补图。";
    const editorRecommendationDraft = getEditorRecommendationDraft(artifact);
    const isSavingEditorRecommendation = Boolean(editorRecommendationSavingIds[artifactId]);

    return (
      <article key={artifact.id} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex min-w-0 gap-3">
          <SafeImage
            src={String(artifactImageUrlRaw(artifact, "thumbnail") ?? "")}
            alt={artifact.name || "文物图片"}
            width={56}
            height={56}
            onLoad={() => markArtifactImageFailed(artifactId, false)}
            onError={() => markArtifactImageFailed(artifactId, true)}
            className="h-14 w-14 shrink-0 rounded-2xl bg-gray-100 object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="break-words font-black text-gray-900">{artifact.name || "未命名文物"}</div>
            <div className="mt-1 line-clamp-2 text-xs text-gray-500">{artifact.shortIntro || artifact.description || "暂无简介"}</div>
            <div className="mt-1 font-mono text-[11px] text-gray-400">#{artifact.id}</div>
          </div>
        </div>

        <div className="grid gap-2 text-xs text-gray-600">
          <div><span className="font-black text-gray-900">馆藏：</span>{artifact.museumName || artifact.museum || "-"}</div>
          <div><span className="font-black text-gray-900">时代：</span>{artifact.dynasty || artifact.period || "-"}</div>
          <div><span className="font-black text-gray-900">类别：</span>{artifact.category || "-"}</div>
        </div>

        <div className="rounded-2xl bg-gray-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${imageStatusClassName(imageStatus.status)}`}>
              {imageStatusLabel(imageStatus.status)}
            </span>
            <span className="text-xs font-bold text-gray-400">图片状态</span>
          </div>
          <div className="mt-2 text-xs leading-relaxed text-gray-500">
            {imageStatus.status === "local-complete" && "本地文件存在，可正常显示。"}
            {imageStatus.status === "remote-only" && "无本地图，使用外链预览。"}
            {imageStatus.status === "no-image" && "四个图片字段均为空。"}
            {imageStatus.status === "local-broken" && rowHint}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 p-3">
          <div className="text-xs font-black text-gray-500">首页推荐</div>
          <div className="mt-3 space-y-3">
            <label className="inline-flex items-center gap-2 text-xs font-black text-gray-700">
              <input
                type="checkbox"
                checked={editorRecommendationDraft.isEditorRecommended}
                onChange={(event) => updateEditorRecommendationDraft(artifact, { isEditorRecommended: event.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-amber-800 focus:ring-amber-500"
              />
              首页推荐
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">排序</span>
              <input
                type="number"
                min={0}
                max={9999}
                value={editorRecommendationDraft.editorRecommendationOrder}
                disabled={!editorRecommendationDraft.isEditorRecommended}
                onChange={(event) => updateEditorRecommendationDraft(artifact, {
                  editorRecommendationOrder: Math.max(0, Math.min(9999, Number(event.target.value) || 0)),
                })}
                className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-amber-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                type="button"
                disabled={isSavingEditorRecommendation}
                onClick={() => onSaveEditorRecommendation(artifact)}
                className="min-w-0 flex-1 rounded-xl bg-gray-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                {isSavingEditorRecommendation ? "保存中..." : "保存推荐"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-3">
          <div className="text-xs font-black text-gray-500">文物列表补图</div>
          {showInlineUploader ? (
            <div className="mt-3 space-y-3">
              <div className="text-xs font-bold leading-relaxed text-gray-500">{rowHint}</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="cursor-pointer rounded-xl bg-white px-3 py-2 text-center text-xs font-black text-gray-700">
                  选择并裁剪
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      e.currentTarget.value = "";
                      onSelectRowImage(artifactId, file);
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={Boolean(rowUploadingIds[artifactId]) || !rowSelection}
                  onClick={() => onUploadRowImage(artifact)}
                  className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                >
                  {rowUploadingIds[artifactId] ? "上传中..." : uploadButtonLabel}
                </button>
              </div>
              <input
                value={rowDownloadUrl || ""}
                onChange={(e) => setRowImageUrls((current) => ({ ...current, [artifactId]: e.target.value }))}
                placeholder="粘贴图片链接：https://..."
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-amber-500"
              />
              <button
                type="button"
                disabled={Boolean(rowDownloadingIds[artifactId]) || !String(rowDownloadUrl || "").trim()}
                onClick={() => onDownloadRowImageUrl(artifact)}
                className="w-full rounded-xl bg-amber-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                {rowDownloadingIds[artifactId] ? "下载中..." : downloadButtonLabel}
              </button>
              {rowSelection && (
                <div className="flex gap-3 rounded-2xl bg-white p-3">
                  <img src={rowSelection.previewUrl} alt="" className="aspect-[4/3] w-20 shrink-0 rounded-xl bg-gray-100 object-cover" />
                  <div className="min-w-0 text-xs text-gray-500">
                    <div className="truncate font-bold text-gray-800">{rowSelection.file.name}</div>
                    <div className="mt-1">{formatFileSize(rowSelection.file.size)}</div>
                    <div className="mt-1 font-bold text-amber-800">裁剪结果尚未保存</div>
                  </div>
                </div>
              )}
              {rowImageErrors[artifactId] && <div className="text-xs font-bold text-rose-700">{rowImageErrors[artifactId]}</div>}
            </div>
          ) : (
            <div className="mt-2 text-xs text-gray-400">本地图已完成，无需补图。</div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onEditArtifact(artifact)} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
            编辑
          </button>
          <button type="button" onClick={() => onDeleteArtifact(artifact)} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">
            删除
          </button>
        </div>
      </article>
    );
  };

  const renderMuseumMobileCard = (museum: MuseumAdminItem) => {
    const cover = museumCoverUrl(museum);
    return (
      <article key={museum.id} className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex min-w-0 gap-3">
          {cover ? (
            <button type="button" onClick={() => onSelectMuseum(museum)} className="shrink-0">
              <img src={cover} alt="" className="h-14 w-20 rounded-xl bg-gray-100 object-cover" />
            </button>
          ) : (
            <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs font-black text-gray-400">无封面</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="break-words font-black text-gray-900">{museum.name}</div>
            <div className="mt-1 line-clamp-2 text-xs text-gray-500">{(museum.aliases || []).join("，") || "暂无别名"}</div>
            <div className="mt-1 text-xs text-gray-400">{museum.createdByImport ? "自动创建" : "人工维护"} · {museum.hasCover ? "有封面" : "无封面"}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div className="rounded-xl bg-gray-50 p-2"><div className="font-black text-gray-900">类型/等级</div><div className="mt-1">{museum.type || "-"} / {museum.grade || museum.level || "-"}</div></div>
          <div className="rounded-xl bg-gray-50 p-2"><div className="font-black text-gray-900">省市</div><div className="mt-1">{[museum.province, museum.city].filter(Boolean).join(" / ") || "-"}</div></div>
          <div className="rounded-xl bg-gray-50 p-2"><div className="font-black text-gray-900">文物</div><div className="mt-1">{museum.artifactCount || 0}</div></div>
          <div className="rounded-xl bg-gray-50 p-2"><div className="font-black text-gray-900">更新时间</div><div className="mt-1">{formatShortDate(museum.updatedAt)}</div></div>
        </div>
        <button type="button" onClick={() => onSelectMuseum(museum)} className="w-full rounded-xl bg-gray-900 px-3 py-2 text-xs font-black text-white">
          查看 / 编辑
        </button>
      </article>
    );
  };

  const renderUserMobileCard = (user: AdminUserSummary) => (
    <article key={user.id} className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start gap-3">
        <img src={user.photoURL} alt="" className="h-12 w-12 shrink-0 rounded-2xl bg-gray-100 object-cover" referrerPolicy="no-referrer" />
        <div className="min-w-0 flex-1">
          <div className="break-words font-black text-gray-900">{user.displayName || "未命名用户"}</div>
          <div className="mt-1 font-mono text-xs text-gray-500">#{user.id}</div>
          <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${user.role === "admin" ? "bg-amber-100 text-amber-900" : "bg-gray-100 text-gray-700"}`}>
            {user.role === "admin" ? "管理员" : "用户"}
          </span>
        </div>
      </div>
      <div className="grid gap-2 text-xs text-gray-600">
        <div><span className="font-black text-gray-900">MuseLink ID：</span><span className="font-mono">{user.museId || "-"}</span></div>
        <div><span className="font-black text-gray-900">登录方式：</span>{user.contact.hasPassword ? "密码" : "验证码"}</div>
        <div><span className="font-black text-gray-900">可见性：</span>{user.profileVisibility === "all" ? "所有人" : "关注者"}</div>
        <div><span className="font-black text-gray-900">性别：</span>{genderLabels[user.gender]}</div>
        <div><span className="font-black text-gray-900">生日：</span>{user.birthday || "-"}</div>
        <div><span className="font-black text-gray-900">地区：</span>{user.location || "-"}</div>
        <div className="break-words"><span className="font-black text-gray-900">简介：</span>{user.bio || "暂无简介"}</div>
        <div className="break-words"><span className="font-black text-gray-900">邮箱：</span>{user.contact.email || "-"}</div>
        <div><span className="font-black text-gray-900">手机：</span>{user.contact.phone || "-"}</div>
        <div><span className="font-black text-gray-900">创建时间：</span>{formatDate(user.createdAt)}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl bg-gray-50 p-3"><div className="font-black text-gray-900">{user.activity.favoriteArtifacts}</div><div className="mt-1 text-gray-400">文物收藏</div></div>
        <div className="rounded-2xl bg-gray-50 p-3"><div className="font-black text-gray-900">{user.activity.favoriteExhibitions}</div><div className="mt-1 text-gray-400">展陈收藏</div></div>
        <div className="rounded-2xl bg-gray-50 p-3"><div className="font-black text-gray-900">{user.activity.exhibitions}</div><div className="mt-1 text-gray-400">总展陈</div></div>
        <div className="rounded-2xl bg-gray-50 p-3"><div className="font-black text-gray-900">{user.activity.publicExhibitions}</div><div className="mt-1 text-gray-400">公开展陈</div></div>
      </div>
    </article>
  );

  const navigateAdmin = (path: AdminRoute) => {
    navigate(path);
    adminScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearArtifactFilters = () => {
    setQuery("");
    setArtifactProvinceFilter("");
    setArtifactCityFilter("");
    setArtifactCategoryFilter("");
    setImageFilter("all");
    setArtifactMuseumFilter("");
  };

  const imageRepairArtifacts = filteredArtifacts.filter((artifact) => {
    const artifactId = String(artifact.id);
    const status = getArtifactImageStatusInfo(
      artifact,
      Boolean(failedImageIds[artifactId]),
      localImageFileStatuses[artifactId],
    );
    return status.status === "no-image" || status.status === "remote-only" || status.status === "local-broken";
  });

  const noCoverMuseums = museums.filter((museum) => !museum.hasCover && !museumCoverUrl(museum));

  const renderAdminShell = (children: React.ReactNode) => (
    <div
      ref={adminScrollRef}
      className="absolute inset-x-0 bottom-0 overflow-y-auto overflow-x-hidden bg-[#F7F4ED] p-3 text-gray-950"
      style={{ top: "var(--app-status-bar-height)", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
    >
      <div className="mx-auto max-w-6xl space-y-4 pb-6">
        <header className="rounded-[8px] border border-stone-200 bg-white px-4 py-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-800">Admin Console</div>
              <h1 className="mt-1 text-2xl font-black leading-tight text-[#17211f]">MuseLink 后台管理</h1>
              <div className="mt-1 text-xs font-bold leading-relaxed text-stone-500">
                当前管理员：{UserSession.getMuseId() || "jiangzhong"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => goBackOrNavigate("/home")} className="rounded-[5px] bg-stone-100 px-3 py-2 text-xs font-black text-stone-700">
                返回前台
              </button>
              <button type="button" onClick={onLogout} className="rounded-[5px] bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">
                退出登录
              </button>
            </div>
          </div>
        </header>

        {loading && <div className="rounded-[8px] border border-stone-200 bg-white p-4 text-sm font-bold text-stone-500 shadow-sm">正在加载后台数据...</div>}
        {!loading && error && <div className="rounded-[8px] border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">后台操作失败：{error}</div>}
        {!loading && children}
        {cropTarget && (
          <ImageCropperPanel
            request={cropTarget}
            onCancel={closeCropTarget}
            onConfirm={onConfirmCrop}
          />
        )}
      </div>
    </div>
  );

  const AdminSectionHeader = ({ title, description, backTo }: { title: string; description?: string; backTo?: AdminRoute }) => (
    <div className="flex flex-col gap-3 rounded-[8px] border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-xl font-black leading-tight text-[#17211f]">{title}</h2>
        {description && <p className="mt-1 text-sm font-bold leading-relaxed text-stone-500">{description}</p>}
      </div>
      {backTo && (
        <button type="button" onClick={() => navigateAdmin(backTo)} className="rounded-[5px] bg-stone-100 px-3 py-2 text-xs font-black text-stone-700">
          返回上级
        </button>
      )}
    </div>
  );

  const AdminEntryCard = ({
    title,
    description,
    action,
    onClick,
    muted = false,
  }: {
    title: string;
    description: string;
    action: string;
    onClick: () => void;
    muted?: boolean;
  }) => (
    <article className="flex min-h-40 flex-col justify-between rounded-[8px] border border-stone-200 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-lg font-black text-[#17211f]">{title}</h3>
        <p className="mt-2 text-sm font-bold leading-relaxed text-stone-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        className={`mt-5 rounded-[5px] px-4 py-2 text-sm font-black ${muted ? "bg-stone-100 text-stone-600" : "bg-[#17211f] text-white"}`}
      >
        {action}
      </button>
    </article>
  );

  const AdminDashboard = () => (
    <div className="space-y-4">
      <AdminSectionHeader title="控制台首页" description="选择一个管理模块进入，首页不直接展示长列表或表单。" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AdminEntryCard title="文物管理" description={`管理 ${artifacts.length} 件文物的列表、编辑、补图和推荐。`} action="进入文物管理" onClick={() => navigateAdmin("/admin/artifacts")} />
        <AdminEntryCard title="博物馆管理" description={`维护 ${museums.length} 个馆藏机构、封面和地区信息。`} action="进入博物馆管理" onClick={() => navigateAdmin("/admin/museums")} />
        <AdminEntryCard title="导入文物" description="使用现有导入任务接口导入文物，并同步到统一数据源。" action="进入导入文物" onClick={() => navigateAdmin("/admin/import")} />
        <AdminEntryCard title="用户统计" description="查看管理员、普通用户、联系方式和内容数据统计。" action="进入用户统计" onClick={() => navigateAdmin("/admin/users")} />
        <AdminEntryCard title="图片工具" description="集中处理裁剪、异常图片检查和补图入口。" action="进入图片工具" onClick={() => navigateAdmin("/admin/image-tools")} />
        <AdminEntryCard title="编辑推荐管理" description="管理首页展示的文物推荐、展览推荐和编辑精选内容。" action="进入推荐管理" onClick={() => navigateAdmin("/admin/recommendations")} />
      </div>
    </div>
  );

  const AdminArtifactsHome = () => (
    <div className="space-y-4">
      <AdminSectionHeader title="文物管理" description="选择一个文物管理任务，避免在入口页堆叠列表和表单。" backTo="/admin" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AdminEntryCard title="文物列表" description="查看、搜索、筛选和编辑已有文物。" action="进入列表" onClick={() => navigateAdmin("/admin/artifacts/list")} />
        <AdminEntryCard title="新增文物" description="按基础信息、图片信息、扩展信息分组录入文物。" action="新建文物" onClick={() => { setForm(emptyForm); clearArtifactImageFile(); navigateAdmin("/admin/artifacts/new"); }} />
        <AdminEntryCard title="文物补图" description={`处理完全无图、仅外链图、本地图异常的文物。`} action="进入补图" onClick={() => { setImageFilter("no-local"); navigateAdmin("/admin/artifacts/images"); }} />
        <AdminEntryCard title="首页推荐管理" description="在列表中编辑文物首页推荐状态与排序。" action="管理推荐" onClick={() => navigateAdmin("/admin/artifacts/list")} />
        <AdminEntryCard title="批量操作" description="保留为后续批量任务入口；当前不新增接口。" action="查看说明" muted onClick={() => navigateAdmin("/admin/artifacts/bulk")} />
      </div>
    </div>
  );

  const AdminArtifactFilterPanel = () => (
    <div className="rounded-[8px] border border-stone-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <select value={artifactProvinceFilter} onChange={(e) => { setArtifactProvinceFilter(e.target.value); setArtifactCityFilter(""); }} className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700">
          <option value="">全部省份</option>
          {PROVINCE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={artifactCityFilter} onChange={(e) => setArtifactCityFilter(e.target.value)} className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700">
          <option value="">全部城市</option>
          {artifactCityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={artifactCategoryFilter} onChange={(e) => setArtifactCategoryFilter(e.target.value)} className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700">
          <option value="">全部类型</option>
          {artifactCategoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={imageFilter} onChange={(e) => setImageFilter(e.target.value as ArtifactImageFilter)} className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700">
          <option value="all">全部</option>
          <option value="local-complete">本地图已完成</option>
          <option value="remote-only">仅有外链图</option>
          <option value="no-local">无本地图</option>
          <option value="local-broken">本地图异常</option>
          <option value="no-image">完全无图</option>
        </select>
        <select value={artifactMuseumFilter} onChange={(e) => setArtifactMuseumFilter(e.target.value)} className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700 sm:col-span-2">
          <option value="">全部馆藏机构</option>
          {artifactMuseumOptions.map((museum) => (
            <option key={museum.id} value={museum.id}>{museum.name}（{museum.count}）</option>
          ))}
        </select>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
        <button type="button" onClick={() => setArtifactFilterOpen(false)} className="rounded-[5px] bg-[#17211f] px-4 py-2 text-xs font-black text-white">
          应用筛选
        </button>
        <button type="button" onClick={clearArtifactFilters} className="rounded-[5px] bg-stone-100 px-4 py-2 text-xs font-black text-stone-700">
          重置筛选
        </button>
      </div>
    </div>
  );

  const renderArtifactListCard = (artifact: Artifact) => {
    const artifactId = String(artifact.id);
    const imageStatus = getArtifactImageStatusInfo(artifact, Boolean(failedImageIds[artifactId]), localImageFileStatuses[artifactId]);
    const editorRecommendationDraft = getEditorRecommendationDraft(artifact);
    const isSavingEditorRecommendation = Boolean(editorRecommendationSavingIds[artifactId]);
    return (
      <article key={artifact.id} className="rounded-[8px] border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex min-w-0 gap-3">
          <SafeImage
            src={String(artifactImageUrlRaw(artifact, "thumbnail") ?? "")}
            alt={artifact.name || "文物图片"}
            width={64}
            height={64}
            onLoad={() => markArtifactImageFailed(artifactId, false)}
            onError={() => markArtifactImageFailed(artifactId, true)}
            className="h-16 w-16 shrink-0 rounded-[5px] bg-stone-100 object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="break-words text-base font-black text-[#17211f]">{artifact.name || "未命名文物"}</div>
            <div className="mt-1 text-xs font-bold leading-relaxed text-stone-500">{artifact.museumName || artifact.museum || "-"} · {artifact.dynasty || artifact.period || "-"} · {artifact.category || "-"}</div>
            <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${imageStatusClassName(imageStatus.status)}`}>
              {imageStatusLabel(imageStatus.status)}
            </span>
          </div>
        </div>
        <div className="mt-4 rounded-[5px] bg-stone-50 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-black text-stone-700">
              <input type="checkbox" checked={editorRecommendationDraft.isEditorRecommended} onChange={(event) => updateEditorRecommendationDraft(artifact, { isEditorRecommended: event.target.checked })} />
              首页推荐
            </label>
            <input
              type="number"
              min={0}
              max={9999}
              value={editorRecommendationDraft.editorRecommendationOrder}
              disabled={!editorRecommendationDraft.isEditorRecommended}
              onChange={(event) => updateEditorRecommendationDraft(artifact, { editorRecommendationOrder: Math.max(0, Math.min(9999, Number(event.target.value) || 0)) })}
              className="w-24 rounded-[5px] border border-stone-200 px-2 py-2 text-xs disabled:bg-stone-100 disabled:text-stone-400"
            />
            <button type="button" disabled={isSavingEditorRecommendation} onClick={() => onSaveEditorRecommendation(artifact)} className="rounded-[5px] bg-stone-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50">
              {isSavingEditorRecommendation ? "保存中" : "保存推荐"}
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onEditArtifact(artifact)} className="rounded-[5px] bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">编辑</button>
          <button type="button" onClick={() => onDeleteArtifact(artifact)} className="rounded-[5px] bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">删除</button>
        </div>
      </article>
    );
  };

  const AdminArtifactList = () => (
    <div className="space-y-4">
      <AdminSectionHeader title="文物列表" description={`查看、搜索、筛选、编辑已有文物。当前显示 ${filteredArtifacts.length} / ${artifacts.length} 件。`} backTo="/admin/artifacts" />
      {imageUploadMessage && <div className="rounded-[8px] border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{imageUploadMessage}</div>}
      <section className="rounded-[8px] border border-stone-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索名称、馆藏机构、朝代、类别" className="min-w-0 rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700" />
          <button type="button" onClick={() => setArtifactFilterOpen((value) => !value)} className="rounded-[5px] bg-[#17211f] px-4 py-3 text-sm font-black text-white">
            筛选条件
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {activeArtifactFilterTags.length === 0 ? (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-black text-stone-500">当前筛选：全部文物</span>
          ) : activeArtifactFilterTags.map((tag) => (
            <span key={tag} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-black text-stone-700">{tag}</span>
          ))}
        </div>
      </section>
      {artifactFilterOpen && <AdminArtifactFilterPanel />}
      <div className="grid gap-3 lg:grid-cols-2">
        {filteredArtifacts.map(renderArtifactListCard)}
        {filteredArtifacts.length === 0 && <div className="rounded-[8px] bg-white px-4 py-12 text-center text-sm font-bold text-stone-400">当前筛选下没有文物。</div>}
      </div>
    </div>
  );

  const AdminArtifactNew = () => (
    <form onSubmit={onSaveArtifact} className="space-y-4 pb-20">
      <AdminSectionHeader title={form.id ? "编辑文物" : "新增文物"} description={form.id ? `正在编辑 ID ${form.id}` : "按分组填写文物信息，保存时仍使用现有文物接口。"} backTo="/admin/artifacts" />
      <section className="rounded-[8px] border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black text-[#17211f]">基础信息</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="名称 *" className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700" />
          <input value={form.museum} onChange={(e) => setForm({ ...form, museum: e.target.value })} placeholder="馆藏单位 *" className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700" />
          <input value={form.dynasty} onChange={(e) => setForm({ ...form, dynasty: e.target.value })} placeholder="时代" className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700" />
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="类别" className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700" />
          <input value={form.shortIntro} onChange={(e) => setForm({ ...form, shortIntro: e.target.value })} placeholder="一句话简介" className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700 sm:col-span-2" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="描述" rows={5} className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700 sm:col-span-2" />
        </div>
      </section>
      <section className="rounded-[8px] border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black text-[#17211f]">图片信息</h3>
        <div className="mt-4 grid gap-3">
          <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="图片 URL" className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700" />
          <input value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} placeholder="来源 URL" className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700" />
          {form.id && (
            <div className="rounded-[5px] border border-dashed border-stone-200 bg-stone-50 p-3">
              <div className="text-xs font-black text-stone-600">本地上传</div>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0] || null; e.currentTarget.value = ""; if (file) openArtifactCrop(file, "裁剪文物卡片图片"); }} className="mt-2 block w-full rounded-[5px] border border-stone-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-[5px] file:border-0 file:bg-[#17211f] file:px-3 file:py-2 file:text-xs file:font-black file:text-white" />
              {imageFile && imageFilePreviewUrl && <img src={imageFilePreviewUrl} alt="" className="mt-3 aspect-[4/3] w-32 rounded-[5px] object-cover" />}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button type="button" disabled={uploadingImage || !imageFile} onClick={onUploadArtifactImage} className="rounded-[5px] bg-[#17211f] px-3 py-2 text-xs font-black text-white disabled:opacity-50">{uploadingImage ? "保存中..." : "保存裁剪图并同步"}</button>
                <button type="button" disabled={downloadingImageUrl || !imageUrlToDownload.trim()} onClick={onDownloadArtifactImageUrl} className="rounded-[5px] bg-amber-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50">{downloadingImageUrl ? "下载中..." : "从链接下载"}</button>
              </div>
              <input value={imageUrlToDownload} onChange={(e) => setImageUrlToDownload(e.target.value)} placeholder="粘贴图片链接下载到本地" className="mt-2 w-full rounded-[5px] border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-700" />
              {imageUploadMessage && <div className="mt-2 break-all text-xs font-bold text-emerald-700">{imageUploadMessage}</div>}
            </div>
          )}
        </div>
      </section>
      <section className="rounded-[8px] border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black text-[#17211f]">扩展信息</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="标签，用逗号分隔" className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700 sm:col-span-2" />
          <input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="材质" className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700" />
          <input value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder="尺寸" className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700" />
          <input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="级别" className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700" />
          <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="地区 / 备注" className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700" />
        </div>
      </section>
      <div className="sticky bottom-0 z-20 -mx-3 border-t border-stone-200 bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-6xl">
          <button disabled={saving} className="w-full rounded-[5px] bg-[#17211f] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "保存中..." : form.id ? "保存修改" : "新增文物"}</button>
        </div>
      </div>
    </form>
  );

  const renderArtifactImageRepairCard = (artifact: Artifact) => {
    const artifactId = String(artifact.id);
    const imageStatus = getArtifactImageStatusInfo(artifact, Boolean(failedImageIds[artifactId]), localImageFileStatuses[artifactId]);
    const rowSelection = rowImageSelections[artifactId];
    const rowHasCustomUrl = Object.prototype.hasOwnProperty.call(rowImageUrls, artifactId);
    const rowDownloadUrl = rowHasCustomUrl ? rowImageUrls[artifactId] : suggestedRemoteImageUrl(imageStatus.fields);
    return (
      <article key={artifact.id} className="rounded-[8px] border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          <SafeImage src={String(artifactImageUrlRaw(artifact, "thumbnail") ?? "")} alt={artifact.name || "文物图片"} width={64} height={64} onError={() => markArtifactImageFailed(artifactId, true)} className="h-16 w-16 shrink-0 rounded-[5px] bg-stone-100 object-cover" />
          <div className="min-w-0 flex-1">
            <div className="break-words font-black text-[#17211f]">{artifact.name || "未命名文物"}</div>
            <div className="mt-1 text-xs font-bold text-stone-500">{artifact.museumName || artifact.museum || "-"}</div>
            <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${imageStatusClassName(imageStatus.status)}`}>{imageStatusLabel(imageStatus.status)}</span>
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          <label className="rounded-[5px] bg-stone-100 px-3 py-2 text-center text-xs font-black text-stone-700">
            上传图片
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0] || null; e.currentTarget.value = ""; onSelectRowImage(artifactId, file); }} />
          </label>
          <button type="button" disabled={Boolean(rowUploadingIds[artifactId]) || !rowSelection} onClick={() => onUploadRowImage(artifact)} className="rounded-[5px] bg-[#17211f] px-3 py-2 text-xs font-black text-white disabled:opacity-50">
            {rowUploadingIds[artifactId] ? "上传中..." : "保存裁剪图"}
          </button>
          <input value={rowDownloadUrl || ""} onChange={(e) => setRowImageUrls((current) => ({ ...current, [artifactId]: e.target.value }))} placeholder="粘贴图片链接下载" className="rounded-[5px] border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-700" />
          <button type="button" disabled={Boolean(rowDownloadingIds[artifactId]) || !String(rowDownloadUrl || "").trim()} onClick={() => onDownloadRowImageUrl(artifact)} className="rounded-[5px] bg-amber-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50">
            {rowDownloadingIds[artifactId] ? "下载中..." : "粘贴图片链接下载"}
          </button>
          <button type="button" onClick={() => navigateAdmin("/admin/image-tools")} className="rounded-[5px] bg-stone-100 px-3 py-2 text-xs font-black text-stone-700">进入裁剪</button>
          {rowSelection && <img src={rowSelection.previewUrl} alt="" className="aspect-[4/3] w-28 rounded-[5px] object-cover" />}
          {rowImageErrors[artifactId] && <div className="text-xs font-bold text-rose-700">{rowImageErrors[artifactId]}</div>}
        </div>
      </article>
    );
  };

  const AdminArtifactImages = () => (
    <div className="space-y-4">
      <AdminSectionHeader title="文物补图" description={`只显示完全无图、仅有外链图、本地图异常的文物。当前 ${imageRepairArtifacts.length} 件。`} backTo="/admin/artifacts" />
      <div className="grid gap-3 lg:grid-cols-2">
        {imageRepairArtifacts.map(renderArtifactImageRepairCard)}
        {imageRepairArtifacts.length === 0 && <div className="rounded-[8px] bg-white px-4 py-12 text-center text-sm font-bold text-stone-400">当前没有需要补图的文物。</div>}
      </div>
    </div>
  );

  const AdminImageTools = () => (
    <div className="space-y-4">
      <AdminSectionHeader title="图片工具" description="图片相关能力集中入口，不在后台首页直接展开。" backTo="/admin" />
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminEntryCard title="文物图片裁剪" description="从文物补图或编辑页上传图片后自动进入 4:3 裁剪。" action="去文物补图" onClick={() => navigateAdmin("/admin/artifacts/images")} />
        <AdminEntryCard title="博物馆封面裁剪" description="选择博物馆后上传封面，自动进入 16:9 裁剪。" action="去封面补图" onClick={() => navigateAdmin("/admin/museums/images")} />
        <AdminEntryCard title="检查异常图片" description="筛出本地图异常文物，便于重新上传或从外链下载。" action="检查异常" onClick={() => { setImageFilter("local-broken"); navigateAdmin("/admin/artifacts/images"); }} />
        <AdminEntryCard title="批量生成缩略图" description="当前项目未提供独立批量缩略图接口，保留为工具入口说明。" action="查看补图队列" muted onClick={() => navigateAdmin("/admin/artifacts/images")} />
      </div>
    </div>
  );

  const AdminMuseumsHome = () => (
    <div className="space-y-4">
      <AdminSectionHeader title="博物馆管理" description="选择博物馆管理任务，入口页不展开长列表。" backTo="/admin" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminEntryCard title="博物馆列表" description="查看、搜索、筛选和编辑馆藏机构。" action="进入列表" onClick={() => navigateAdmin("/admin/museums/list")} />
        <AdminEntryCard title="新增博物馆" description="当前后端以导入创建和编辑为主，不新增接口。" action="查看说明" muted onClick={() => navigateAdmin("/admin/museums/new")} />
        <AdminEntryCard title="封面补图" description={`处理 ${noCoverMuseums.length} 个缺少封面的博物馆。`} action="进入补图" onClick={() => navigateAdmin("/admin/museums/images")} />
        <AdminEntryCard title="地区信息管理" description="通过博物馆列表筛选省市并编辑地区字段。" action="管理地区" onClick={() => navigateAdmin("/admin/museums/list")} />
      </div>
    </div>
  );

  const AdminMuseumList = () => (
    <div className="space-y-4">
      <AdminSectionHeader title="博物馆列表" description={`当前显示 ${museums.length} 个博物馆机构。`} backTo="/admin/museums" />
      <section className="rounded-[8px] border border-stone-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input value={museumQuery} onChange={(e) => setMuseumQuery(e.target.value)} placeholder="搜索标准名、别名、省市" className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700 sm:col-span-2" />
          <select value={museumProvinceFilter} onChange={(e) => { setMuseumProvinceFilter(e.target.value); setMuseumCityFilter(""); }} className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700">
            <option value="">全部省份</option>
            {museumFilterOptions.provinces.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={museumCityFilter} onChange={(e) => setMuseumCityFilter(e.target.value)} className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700">
            <option value="">全部城市</option>
            {museumFilterOptions.cities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={museumStatusFilter} onChange={(e) => setMuseumStatusFilter(e.target.value as MuseumStatusFilter)} className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700">
            <option value="all">全部状态</option>
            <option value="with-artifacts">有文物</option>
            <option value="without-artifacts">无文物</option>
            <option value="created-by-import">自动创建</option>
            <option value="no-cover">无封面图</option>
            <option value="duplicates">疑似重复</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => { setMuseumQuery(""); setMuseumProvinceFilter(""); setMuseumCityFilter(""); setMuseumTypeFilter(""); setMuseumGradeFilter(""); setMuseumStatusFilter("all"); }} className="rounded-[5px] bg-stone-100 px-3 py-2 text-xs font-black text-stone-700">重置筛选</button>
          {activeMuseumFilterTags.map((tag) => <span key={tag} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-black text-stone-700">{tag}</span>)}
        </div>
      </section>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="space-y-3">{museums.map(renderMuseumMobileCard)}</div>
        <section className="rounded-[8px] border border-stone-200 bg-white p-4 shadow-sm">
          {selectedMuseum ? (
            <form onSubmit={onSaveMuseum} className="space-y-4">
              <h3 className="text-lg font-black text-[#17211f]">博物馆详情</h3>
              <input value={museumForm.name} onChange={(e) => setMuseumForm({ ...museumForm, name: e.target.value })} placeholder="标准名称" className="w-full rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700" />
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={museumForm.type} onChange={(e) => setMuseumForm({ ...museumForm, type: e.target.value })} className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700">{MUSEUM_TYPE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                <select value={museumForm.grade} onChange={(e) => setMuseumForm({ ...museumForm, grade: e.target.value })} className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700">{MUSEUM_GRADE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                <select value={museumForm.province} onChange={(e) => setMuseumForm({ ...museumForm, province: e.target.value, city: "" })} className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700"><option value="">未填写省份</option>{PROVINCE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                <input value={museumForm.city} onChange={(e) => setMuseumForm({ ...museumForm, city: e.target.value })} placeholder="城市" className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700" />
              </div>
              <input value={museumForm.address} onChange={(e) => setMuseumForm({ ...museumForm, address: e.target.value })} placeholder="地址" className="w-full rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700" />
              <textarea value={museumForm.description} onChange={(e) => setMuseumForm({ ...museumForm, description: e.target.value })} placeholder="简介" rows={3} className="w-full rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700" />
              <div className="rounded-[5px] border border-dashed border-stone-200 bg-stone-50 p-3">
                <div className="text-xs font-black text-stone-600">封面图</div>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0] || null; e.currentTarget.value = ""; if (file) openMuseumCoverCrop(file); }} className="mt-2 block w-full rounded-[5px] border border-stone-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-[5px] file:border-0 file:bg-[#17211f] file:px-3 file:py-2 file:text-xs file:font-black file:text-white" />
                <input value={museumCoverUrlToDownload} onChange={(e) => setMuseumCoverUrlToDownload(e.target.value)} placeholder="粘贴封面图片链接" className="mt-2 w-full rounded-[5px] border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-700" />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" disabled={saving || !museumCoverFile} onClick={onUploadMuseumCover} className="rounded-[5px] bg-[#17211f] px-3 py-2 text-xs font-black text-white disabled:opacity-50">保存裁剪封面</button>
                  <button type="button" disabled={downloadingMuseumCoverUrl || !museumCoverUrlToDownload.trim()} onClick={onDownloadMuseumCoverUrl} className="rounded-[5px] bg-amber-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50">链接下载</button>
                </div>
              </div>
              {museumMessage && <div className="rounded-[5px] bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{museumMessage}</div>}
              <button disabled={saving || !museumForm.name.trim()} className="w-full rounded-[5px] bg-[#17211f] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "保存中..." : "保存博物馆信息"}</button>
            </form>
          ) : (
            <div className="py-16 text-center text-sm font-bold text-stone-400">选择一个博物馆查看详情、编辑信息和上传封面。</div>
          )}
        </section>
      </div>
    </div>
  );

  const AdminMuseumNew = () => (
    <div className="space-y-4">
      <AdminSectionHeader title="新增博物馆" description="当前项目没有独立的新建博物馆 API；保持接口不变，此页作为入口说明。" backTo="/admin/museums" />
      <div className="rounded-[8px] border border-stone-200 bg-white p-6 text-sm font-bold leading-relaxed text-stone-600 shadow-sm">
        新博物馆目前通过“导入文物”流程自动识别并创建，或在“博物馆列表”中选择已有机构编辑资料。这里不新增数据源和接口逻辑。
      </div>
    </div>
  );

  const AdminMuseumImages = () => (
    <div className="space-y-4">
      <AdminSectionHeader title="博物馆封面补图" description={`只显示缺少封面的博物馆。当前 ${noCoverMuseums.length} 个。`} backTo="/admin/museums" />
      <div className="grid gap-3 lg:grid-cols-2">
        {noCoverMuseums.map((museum) => (
          <article key={museum.id} className="rounded-[8px] border border-stone-200 bg-white p-4 shadow-sm">
            <div className="font-black text-[#17211f]">{museum.name}</div>
            <div className="mt-1 text-xs font-bold text-stone-500">{[museum.province, museum.city].filter(Boolean).join(" / ") || "未填写地区"} · 文物 {museum.artifactCount || 0}</div>
            <button type="button" onClick={() => onSelectMuseum(museum)} className="mt-4 rounded-[5px] bg-[#17211f] px-4 py-2 text-xs font-black text-white">选择并上传封面</button>
          </article>
        ))}
        {noCoverMuseums.length === 0 && <div className="rounded-[8px] bg-white px-4 py-12 text-center text-sm font-bold text-stone-400">当前没有需要补封面的博物馆。</div>}
      </div>
    </div>
  );

  const AdminImportPage = () => (
    <section className="space-y-4">
      <AdminSectionHeader title="导入文物" description="导入执行接口保持 /api/import/run，完成后同步到统一数据源。" backTo="/admin" />
      <div className="rounded-[8px] border border-stone-200 bg-white p-4 shadow-sm">
        <button type="button" onClick={loadImportTemplate} className="rounded-[5px] bg-stone-100 px-4 py-2 text-sm font-black text-stone-700">填入导入模板</button>
        <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='粘贴导入任务 JSON，例如 {"sourceType":"inline","format":"json","records":[...],"mode":"append"}' rows={18} className="mt-4 w-full rounded-[5px] border border-stone-200 px-3 py-3 font-mono text-sm outline-none focus:border-amber-700" />
        <button disabled={saving || !importText.trim()} onClick={runImport} className="mt-3 w-full rounded-[5px] bg-[#17211f] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "导入中..." : "执行导入"}</button>
        {importResult && <div className="mt-3 rounded-[5px] bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{importResult}</div>}
      </div>
    </section>
  );

  const AdminUsersPage = () => (
    <div className="space-y-4">
      <AdminSectionHeader title="用户统计" description="查看用户、管理员和内容活动数据。" backTo="/admin" />
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[["Total Users", stats.totalUsers], ["Admins", stats.adminCount], ["Members", regularUserCount], ["Contacts", stats.usersWithContact]].map(([label, value]) => (
            <div key={label} className="rounded-[8px] border border-stone-200 bg-white p-4 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-400">{label}</div>
              <div className="mt-2 text-2xl font-black text-[#17211f]">{value}</div>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">{users.map(renderUserMobileCard)}</div>
    </div>
  );

  const resolvedRecommendationItem = (item: HomeRecommendationItem) => {
    const allItems = [
      ...(resolvedRecommendations?.artifactRecommendations || []),
      ...(resolvedRecommendations?.exhibitionRecommendations || []),
      ...(resolvedRecommendations?.editorPicks.items || []),
    ];
    return allItems.find((resolved) => resolved.id === item.id);
  };

  const renderRecommendationItemCard = (item: HomeRecommendationItem) => {
    const resolved = resolvedRecommendationItem(item);
    const artifact = resolved?.artifact;
    const exhibition = resolved?.exhibition;
    const displayTitle = resolved?.displayTitle || item.title || artifact?.name || exhibition?.title || item.targetId;
    const displayReason = resolved?.displayReason || item.reason || artifact?.shortIntro || artifact?.description || exhibition?.intro || "";
    const coverUrl = resolved?.displayCoverUrl || item.coverUrl || (artifact ? String(artifactImageUrlRaw(artifact, "thumbnail") ?? "") : exhibition?.coverUrl || "");

    return (
      <article key={item.id} className="rounded-[8px] border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-16 w-16 shrink-0 rounded-[5px] bg-stone-100 object-cover" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[5px] bg-stone-100 text-[10px] font-black text-stone-400">无图</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800">{item.type === "artifact" ? "文物" : "展览"}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${item.enabled ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                {item.enabled ? "启用" : "停用"}
              </span>
              <span className="text-[10px] font-bold text-stone-400">Order {item.order}</span>
            </div>
            <div className="mt-1 break-words text-sm font-black text-[#17211f]">{displayTitle}</div>
            <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-stone-500">{displayReason || "暂无推荐理由"}</div>
            <div className="mt-1 break-all font-mono text-[10px] text-stone-400">{item.targetId}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <input value={item.title} onChange={(e) => patchRecommendationItem(item.id, { title: e.target.value })} placeholder="推荐标题（为空则使用原标题）" className="rounded-[5px] border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-700" />
          <textarea value={item.reason} onChange={(e) => patchRecommendationItem(item.id, { reason: e.target.value })} placeholder="推荐理由（为空则使用简介摘要）" rows={2} className="rounded-[5px] border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-700" />
          {item.type === "exhibition" && (
            <input value={item.coverUrl || ""} onChange={(e) => patchRecommendationItem(item.id, { coverUrl: e.target.value })} placeholder="推荐封面 URL（为空则使用展览封面）" className="rounded-[5px] border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-700" />
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded-[5px] bg-stone-50 px-3 py-2 text-xs font-black text-stone-700">
              <input type="checkbox" checked={item.enabled} onChange={(e) => patchRecommendationItem(item.id, { enabled: e.target.checked })} />
              启用
            </label>
            <input type="number" value={item.order} onChange={(e) => patchRecommendationItem(item.id, { order: Number(e.target.value) || 0 })} className="rounded-[5px] border border-stone-200 px-3 py-2 text-xs outline-none focus:border-amber-700" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => moveRecommendationItem(item.id, -1)} className="rounded-[5px] bg-stone-100 px-3 py-2 text-xs font-black text-stone-700">上移</button>
            <button type="button" onClick={() => moveRecommendationItem(item.id, 1)} className="rounded-[5px] bg-stone-100 px-3 py-2 text-xs font-black text-stone-700">下移</button>
            <button type="button" onClick={() => removeRecommendationItem(item.id)} className="rounded-[5px] bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">删除</button>
          </div>
        </div>
      </article>
    );
  };

  const renderArtifactCandidate = (artifact: Artifact) => (
    <button key={artifact.id} type="button" onClick={() => addRecommendationItem("artifact", artifact.id)} className="flex w-full gap-3 rounded-[5px] bg-white p-3 text-left shadow-sm">
      <SafeImage src={String(artifactImageUrlRaw(artifact, "thumbnail") ?? "")} alt={artifact.name} width={48} height={48} className="h-12 w-12 shrink-0 rounded-[5px] bg-stone-100 object-cover" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-[#17211f]">{artifact.name}</span>
        <span className="mt-1 block truncate text-xs font-bold text-stone-500">{artifact.museumName || artifact.museum || "-"} · {artifact.dynasty || artifact.period || "-"}</span>
      </span>
    </button>
  );

  const renderExhibitionCandidate = (exhibition: Exhibition) => (
    <button key={exhibition.id} type="button" onClick={() => addRecommendationItem("exhibition", exhibition.id)} className="flex w-full gap-3 rounded-[5px] bg-white p-3 text-left shadow-sm">
      {exhibition.coverUrl ? (
        <img src={exhibition.coverUrl} alt="" className="h-12 w-12 shrink-0 rounded-[5px] bg-stone-100 object-cover" />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[5px] bg-stone-100 text-[10px] font-black text-stone-400">无图</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-[#17211f]">{exhibition.title}</span>
        <span className="mt-1 block truncate text-xs font-bold text-stone-500">{exhibition.userName || "公开展览"} · {exhibition.artifactIds?.length || 0} 件文物</span>
      </span>
    </button>
  );

  const AdminRecommendationsPage = () => {
    const items = recommendationItemsForTab();
    return (
      <div className="space-y-4">
        <AdminSectionHeader title="编辑推荐管理" description="管理首页展示的文物推荐、展览推荐和编辑精选内容。" backTo="/admin" />
        <div className="grid grid-cols-3 gap-2 rounded-[8px] border border-stone-200 bg-white p-2 shadow-sm">
          {[
            ["artifacts", "首页文物推荐"],
            ["exhibitions", "首页展览推荐"],
            ["editor-picks", "编辑精选栏目"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setRecommendationTab(id as typeof recommendationTab);
                setRecommendationSearchQuery("");
              }}
              className={`rounded-[5px] px-2 py-2 text-xs font-black ${recommendationTab === id ? "bg-[#17211f] text-white" : "bg-stone-100 text-stone-700"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {recommendationTab === "editor-picks" && (
          <section className="grid gap-3 rounded-[8px] border border-stone-200 bg-white p-4 shadow-sm">
            <label className="flex items-center gap-2 text-xs font-black text-stone-700">
              <input type="checkbox" checked={recommendationsConfig.editorPicks.enabled} onChange={(e) => updateEditorPicksMeta({ enabled: e.target.checked })} />
              显示编辑精选栏目
            </label>
            <input value={recommendationsConfig.editorPicks.title} onChange={(e) => updateEditorPicksMeta({ title: e.target.value })} placeholder="栏目标题" className="rounded-[5px] border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-700" />
            <input value={recommendationsConfig.editorPicks.subtitle} onChange={(e) => updateEditorPicksMeta({ subtitle: e.target.value })} placeholder="栏目副标题" className="rounded-[5px] border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-700" />
          </section>
        )}

        <section className="rounded-[8px] border border-stone-200 bg-stone-50 p-4 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input value={recommendationSearchQuery} onChange={(e) => setRecommendationSearchQuery(e.target.value)} placeholder="搜索可推荐文物或公开展览" className="rounded-[5px] border border-stone-200 px-3 py-3 text-sm outline-none focus:border-amber-700" />
            <button type="button" onClick={refreshRecommendationCandidates} className="rounded-[5px] bg-[#17211f] px-4 py-3 text-sm font-black text-white">搜索</button>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {(recommendationTab === "artifacts" || recommendationTab === "editor-picks") && recommendationArtifactCandidates.map(renderArtifactCandidate)}
            {(recommendationTab === "exhibitions" || recommendationTab === "editor-picks") && recommendationExhibitionCandidates.map(renderExhibitionCandidate)}
          </div>
        </section>

        {recommendationsMessage && <div className="rounded-[8px] border border-emerald-100 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{recommendationsMessage}</div>}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-[#17211f]">当前推荐项（{items.length}）</h3>
            <button type="button" disabled={recommendationsSaving} onClick={onSaveRecommendations} className="rounded-[5px] bg-amber-900 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
              {recommendationsSaving ? "保存中..." : "保存推荐配置"}
            </button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map(renderRecommendationItemCard)}
            {items.length === 0 && <div className="rounded-[8px] bg-white px-4 py-12 text-center text-sm font-bold text-stone-400">当前栏目还没有推荐项。</div>}
          </div>
        </section>
      </div>
    );
  };

  const AdminBulkPlaceholder = () => (
    <div className="space-y-4">
      <AdminSectionHeader title="批量操作" description="不新增接口逻辑，当前作为后续批量能力入口。" backTo="/admin/artifacts" />
      <div className="rounded-[8px] border border-stone-200 bg-white p-6 text-sm font-bold text-stone-600 shadow-sm">当前可用的批量相关工作先通过“导入文物”和“文物补图”完成。</div>
    </div>
  );

  const renderAdminRoute = () => {
    if (adminPath === "/admin") return AdminDashboard();
    if (adminPath === "/admin/artifacts") return AdminArtifactsHome();
    if (adminPath === "/admin/artifacts/list") return AdminArtifactList();
    if (adminPath === "/admin/artifacts/new") return AdminArtifactNew();
    if (adminPath === "/admin/artifacts/images") return AdminArtifactImages();
    if (adminPath === "/admin/artifacts/bulk") return AdminBulkPlaceholder();
    if (adminPath === "/admin/image-tools") return AdminImageTools();
    if (adminPath === "/admin/museums") return AdminMuseumsHome();
    if (adminPath === "/admin/museums/list") return AdminMuseumList();
    if (adminPath === "/admin/museums/new") return AdminMuseumNew();
    if (adminPath === "/admin/museums/images") return AdminMuseumImages();
    if (adminPath === "/admin/recommendations") return AdminRecommendationsPage();
    if (adminPath === "/admin/import") return AdminImportPage();
    if (adminPath === "/admin/users") return AdminUsersPage();
    return AdminDashboard();
  };

  return renderAdminShell(renderAdminRoute());

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-gray-50 p-3">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="grid gap-4">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-amber-800">Admin Console</div>
              <h1 className="mt-1 break-words text-2xl font-black leading-tight text-gray-900">MuseLink 后台管理</h1>
              <div className="mt-1 text-sm leading-relaxed text-gray-500">
                当前管理员：{UserSession.getMuseId() || "jiangzhong"}，管理统一文物库、导入任务和用户数据。
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => goBackOrNavigate("/home")} className="rounded-2xl bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700">
                返回前台
              </button>
              <button onClick={onLogout} className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
                退出登录
              </button>
            </div>
          </div>

          <nav className="mt-5 grid grid-cols-2 gap-2">
            {[
              ["artifacts", "文物管理"],
              ["museums", "博物馆管理"],
              ["import", "导入文物"],
              ["users", "用户统计"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id as AdminTab)}
                className={`rounded-2xl px-3 py-2 text-sm font-black ${
                  tab === id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-4 grid gap-2">
            {featureEntries.map(({ title, description, actionLabel, onClick }) => (
              <button
                key={title}
                type="button"
                onClick={onClick}
                className="min-w-0 rounded-2xl bg-gray-50 px-3 py-3 text-left transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-800/20"
              >
                <div className="break-words text-sm font-black leading-snug text-gray-900">{title}</div>
                <div className="mt-1 text-xs font-bold leading-relaxed text-gray-500">{description}</div>
                <div className="mt-2 text-xs font-black text-amber-800">{actionLabel}</div>
              </button>
            ))}
          </div>
        </header>

        {loading && <div className="rounded-3xl border border-gray-100 bg-white p-4 text-sm text-gray-500 shadow-sm">正在加载后台数据...</div>}
        {!loading && error && <div className="rounded-3xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">后台操作失败：{error}</div>}

        {!loading && tab === "artifacts" && (
          <div className="grid min-w-0 gap-4">
            <form ref={artifactFormRef} onSubmit={onSaveArtifact} className="scroll-mt-3 min-w-0 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-gray-900">{form.id ? "编辑文物" : "新增文物"}</h2>
                  <div className="mt-1 text-xs text-gray-500">{form.id ? `ID ${form.id}` : "写入统一 JSON 数据源"}</div>
                </div>
                {form.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm(emptyForm);
                      clearArtifactImageFile();
                    }}
                    className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700"
                  >
                    取消编辑
                  </button>
                )}
              </div>

              <div className="mt-5 grid gap-3">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="文物名称 *" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                <input value={form.museum} onChange={(e) => setForm({ ...form, museum: e.target.value })} placeholder="馆藏单位 *" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                <div className="grid gap-3">
                  <input value={form.dynasty} onChange={(e) => setForm({ ...form, dynasty: e.target.value })} placeholder="时代/朝代" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="类别" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                </div>
                <input value={form.shortIntro} onChange={(e) => setForm({ ...form, shortIntro: e.target.value })} placeholder="一句话简介" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="文物描述" rows={5} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="图片 URL" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                {form.id && (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-black text-gray-900">上传本地图片</div>
                    <div className="mt-1 text-xs text-gray-500">支持 jpg/jpeg/png/webp，选择后先进入 4:3 卡片裁剪预览。</div>
                    <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">{CROP_HELP_TEXT}</div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        e.currentTarget.value = "";
                        if (file) openArtifactCrop(file, "裁剪文物卡片图片");
                      }}
                      className="mt-3 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-xs file:font-black file:text-white"
                    />
                    {imageFile && imageFilePreviewUrl && (
                      <div className="mt-3 flex gap-3 rounded-2xl bg-white p-3">
                        <img src={imageFilePreviewUrl} alt="" className="aspect-[4/3] w-24 rounded-xl bg-gray-100 object-cover" />
                        <div className="min-w-0 text-xs text-gray-500">
                          <div className="truncate font-bold text-gray-800">{imageFile.name}</div>
                          <div className="mt-1">{formatFileSize(imageFile.size)}</div>
                          <div className="mt-1 font-bold text-amber-800">裁剪结果尚未保存</div>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={uploadingImage || !imageFile}
                      onClick={onUploadArtifactImage}
                      className="mt-3 rounded-xl bg-gray-900 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                    >
                      {uploadingImage ? "保存中..." : "保存裁剪图并同步"}
                    </button>
                    <div className="mt-4 grid gap-2">
                      <input
                        value={imageUrlToDownload}
                        onChange={(e) => setImageUrlToDownload(e.target.value)}
                        placeholder="粘贴图片链接后自动下载到本地"
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        disabled={downloadingImageUrl || !imageUrlToDownload.trim()}
                        onClick={onDownloadArtifactImageUrl}
                        className="rounded-xl bg-amber-900 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                      >
                        {downloadingImageUrl ? "下载中..." : "从链接下载并同步图片"}
                      </button>
                    </div>
                    {imageUploadMessage && <div className="mt-2 break-all text-xs font-bold text-emerald-700">{imageUploadMessage}</div>}
                  </div>
                )}
                <input value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} placeholder="来源 URL" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="标签，用逗号分隔" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                <div className="grid gap-3">
                  <input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="材质" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                  <input value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder="尺寸" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                </div>
                <div className="grid gap-3">
                  <input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="等级" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                  <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="备注" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                </div>
              </div>

              <button disabled={saving} className="mt-5 w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                {saving ? "保存中..." : form.id ? "保存修改" : "新增文物"}
              </button>
            </form>

            <section ref={artifactListRef} className="scroll-mt-3 min-w-0 rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="space-y-4 border-b border-gray-100 p-4">
                {!getAuthToken() && (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                    <div className="text-sm font-black text-amber-900">管理员 token</div>
                    <div className="mt-2 flex flex-col gap-2">
                      <input
                        value={adminTokenInput}
                        onChange={(e) => setAdminTokenInput(e.target.value)}
                        placeholder="粘贴管理员 Bearer token"
                        className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
                      />
                      <button type="button" onClick={saveAdminTokenInput} className="rounded-xl bg-amber-900 px-4 py-2 text-xs font-black text-white">
                        保存 token
                      </button>
                    </div>
                  </div>
                )}

                {imageUploadMessage && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{imageUploadMessage}</div>}

                <div className="flex flex-col gap-3">
                  <div>
                    <h2 className="text-lg font-black text-gray-900">文物列表</h2>
                    <div className="mt-1 text-sm text-gray-500">统一 JSON 数据源当前 {artifacts.length} 条，筛选显示 {filteredArtifacts.length} 条。</div>
                  </div>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索名称、馆藏机构、朝代、类别" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                </div>

                <div className="grid gap-3">
                  <select
                    value={artifactMuseumFilter}
                    onChange={(e) => setArtifactMuseumFilter(e.target.value)}
                    className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="">全部博物馆</option>
                    {artifactMuseumOptions.map((museum) => (
                      <option key={museum.id} value={museum.id}>
                        {museum.name}（{museum.count}）
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setArtifactMuseumFilter("");
                      setImageFilter("all");
                    }}
                    className="rounded-2xl bg-gray-100 px-4 py-2 text-sm font-black text-gray-700"
                  >
                    重置筛选
                  </button>
                </div>

                {(query || artifactMuseumFilter || imageFilter !== "all") && (
                  <div className="flex flex-wrap gap-2">
                    {query && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-700">搜索：{query}</span>}
                    {artifactMuseumFilter && (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-700">
                        博物馆：{artifactMuseumOptions.find((museum) => museum.id === artifactMuseumFilter)?.name || artifactMuseumFilter}
                      </span>
                    )}
                    {imageFilter !== "all" && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-700">图片：{imageStatusLabel(imageFilter as ArtifactImageStatus) || imageFilter}</span>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["all", "全部文物"],
                    ["no-image", "完全无图"],
                    ["remote-only", "仅有外链图"],
                    ["local-broken", "本地图异常"],
                    ["local-complete", "本地图已完成"],
                    ["no-local", "无本地图"],
                  ] as Array<[ArtifactImageFilter, string]>).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setImageFilter(id as ArtifactImageFilter)}
                      className={`rounded-2xl px-3 py-2 text-xs font-black ${
                        imageFilter === id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {label} {imageFilterCounts[id]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 bg-gray-50 p-3">
                {filteredArtifacts.map(renderArtifactMobileCard)}
                {filteredArtifacts.length === 0 && (
                  <div className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-gray-400">
                    当前筛选下没有文物。
                  </div>
                )}
              </div>

              <div className="hidden">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-5 py-3 text-left font-bold">文物</th>
                      <th className="px-5 py-3 text-left font-bold">馆藏/时代</th>
                      <th className="px-5 py-3 text-left font-bold">图片状态</th>
                      <th className="px-5 py-3 text-left font-bold">首页推荐</th>
                      <th className="px-5 py-3 text-left font-bold">补图</th>
                      <th className="px-5 py-3 text-right font-bold">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArtifacts.map((artifact) => {
                      const artifactId = String(artifact.id);
                      const imageStatus = getArtifactImageStatusInfo(
                        artifact,
                        Boolean(failedImageIds[artifactId]),
                        localImageFileStatuses[artifactId],
                      );
                      const rowSelection = rowImageSelections[artifactId];
                      const suggestedDownloadUrl = suggestedRemoteImageUrl(imageStatus.fields);
                      const rowHasCustomUrl = Object.prototype.hasOwnProperty.call(rowImageUrls, artifactId);
                      const rowDownloadUrl = rowHasCustomUrl ? rowImageUrls[artifactId] : suggestedDownloadUrl;
                      const showInlineUploader = imageStatus.status !== "local-complete";
                      const uploadButtonLabel = "保存裁剪图";
                      const downloadButtonLabel = imageStatus.status === "local-broken" ? "从外链下载补图" : "下载补图";
                      const rowHint = imageStatus.status === "remote-only"
                        ? "当前只有外链图，可直接下载成本地图。"
                        : imageStatus.status === "no-image"
                          ? "当前完全无图，请上传图片或粘贴图片链接。"
                          : imageStatus.hasMissingLocalFile
                            ? "本地图片文件不存在，请重新上传或从外链补图。"
                            : "图片加载失败，请重新上传或从外链补图。";
                      const editorRecommendationDraft = getEditorRecommendationDraft(artifact);
                      const isSavingEditorRecommendation = Boolean(editorRecommendationSavingIds[artifactId]);

                      return (
                      <tr key={artifact.id} className="border-t border-gray-100">
                        <td className="px-5 py-4 align-top">
                          <div className="flex min-w-72 gap-3">
                            <SafeImage
                              src={String(artifactImageUrlRaw(artifact, "thumbnail") ?? "")}
                              alt={artifact.name || "文物图片"}
                              width={56}
                              height={56}
                              onLoad={() => markArtifactImageFailed(artifactId, false)}
                              onError={() => markArtifactImageFailed(artifactId, true)}
                              className="h-14 w-14 rounded-2xl bg-gray-100 object-cover"
                            />
                            <div>
                              <div className="font-black text-gray-900">{artifact.name || "未命名文物"}</div>
                              <div className="mt-1 line-clamp-2 text-xs text-gray-500">{artifact.shortIntro || artifact.description || "暂无简介"}</div>
                              <div className="mt-1 font-mono text-[11px] text-gray-400">#{artifact.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top text-gray-700">
                          <div>{artifact.museumName || artifact.museum || "-"}</div>
                          <div className="mt-1 text-xs text-gray-400">{artifact.dynasty || artifact.period || "-"}</div>
                          <div className="mt-1 text-xs text-gray-400">{artifact.category || "-"}</div>
                        </td>
                        <td className="px-5 py-4 align-top text-gray-500">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${imageStatusClassName(imageStatus.status)}`}>
                            {imageStatusLabel(imageStatus.status)}
                          </span>
                          <div className="mt-2 text-xs text-gray-400">
                            {imageStatus.status === "local-complete" && "本地文件存在，可正常显示。"}
                            {imageStatus.status === "remote-only" && "无本地图，使用外链预览。"}
                            {imageStatus.status === "no-image" && "四个图片字段均为空。"}
                            {imageStatus.status === "local-broken" && rowHint}
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="min-w-44 space-y-3">
                            <label className="inline-flex items-center gap-2 text-xs font-black text-gray-700">
                              <input
                                type="checkbox"
                                checked={editorRecommendationDraft.isEditorRecommended}
                                onChange={(event) => updateEditorRecommendationDraft(artifact, { isEditorRecommended: event.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-amber-800 focus:ring-amber-500"
                              />
                              首页推荐
                            </label>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-500">排序</span>
                              <input
                                type="number"
                                min={0}
                                max={9999}
                                value={editorRecommendationDraft.editorRecommendationOrder}
                                disabled={!editorRecommendationDraft.isEditorRecommended}
                                onChange={(event) => updateEditorRecommendationDraft(artifact, {
                                  editorRecommendationOrder: Math.max(0, Math.min(9999, Number(event.target.value) || 0)),
                                })}
                                className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-amber-500 disabled:bg-gray-50 disabled:text-gray-400"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={isSavingEditorRecommendation}
                              onClick={() => onSaveEditorRecommendation(artifact)}
                              className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                            >
                              {isSavingEditorRecommendation ? "保存中..." : "保存推荐"}
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          {showInlineUploader ? (
                            <div className="min-w-64 space-y-3">
                              <div className="text-xs font-bold text-gray-500">{rowHint}</div>
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="cursor-pointer rounded-xl bg-gray-100 px-3 py-2 text-xs font-black text-gray-700">
                                  选择并裁剪
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      e.currentTarget.value = "";
                                      onSelectRowImage(artifactId, file);
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  disabled={Boolean(rowUploadingIds[artifactId]) || !rowSelection}
                                  onClick={() => onUploadRowImage(artifact)}
                                  className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                                >
                                  {rowUploadingIds[artifactId] ? "上传中..." : uploadButtonLabel}
                                </button>
                              </div>
                              <div className="grid gap-2">
                                <input
                                  value={rowDownloadUrl || ""}
                                  onChange={(e) => setRowImageUrls((current) => ({ ...current, [artifactId]: e.target.value }))}
                                  placeholder="粘贴图片链接：https://..."
                                  className="rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-amber-500"
                                />
                                <button
                                  type="button"
                                  disabled={Boolean(rowDownloadingIds[artifactId]) || !String(rowDownloadUrl || "").trim()}
                                  onClick={() => onDownloadRowImageUrl(artifact)}
                                  className="rounded-xl bg-amber-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                                >
                                  {rowDownloadingIds[artifactId] ? "下载中..." : downloadButtonLabel}
                                </button>
                              </div>
                              {rowSelection && (
                                <div className="flex gap-3 rounded-2xl bg-gray-50 p-3">
                                  <img src={rowSelection.previewUrl} alt="" className="aspect-[4/3] w-20 rounded-xl bg-white object-cover" />
                                  <div className="min-w-0 text-xs text-gray-500">
                                    <div className="truncate font-bold text-gray-800">{rowSelection.file.name}</div>
                                    <div className="mt-1">{formatFileSize(rowSelection.file.size)}</div>
                                    <div className="mt-1 font-bold text-amber-800">裁剪结果尚未保存</div>
                                  </div>
                                </div>
                              )}
                              {rowImageErrors[artifactId] && <div className="text-xs font-bold text-rose-700">{rowImageErrors[artifactId]}</div>}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">本地图已完成，无需补图。</span>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => onEditArtifact(artifact)} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
                              编辑
                            </button>
                            <button type="button" onClick={() => onDeleteArtifact(artifact)} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                    {filteredArtifacts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                          当前筛选下没有文物。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {!loading && tab === "museums" && (
          <div className="grid min-w-0 gap-4">
            <section ref={museumListRef} className="scroll-mt-3 min-w-0 rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="space-y-4 border-b border-gray-100 p-4">
                <div className="flex flex-col gap-3">
                  <div>
                    <h2 className="text-lg font-black text-gray-900">博物馆列表</h2>
                    <div className="mt-1 text-sm text-gray-500">当前显示 {museums.length} 个博物馆机构，文物会通过 museumId 关联到这里。</div>
                  </div>
                  <input
                    value={museumQuery}
                    onChange={(e) => setMuseumQuery(e.target.value)}
                    placeholder="搜索标准名、别名、省市"
                    className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMuseumProvinceFilter("");
                      setMuseumCityFilter("");
                    }}
                    className={`rounded-2xl px-4 py-2 text-sm font-black ${!museumProvinceFilter ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}
                  >
                    全部省份 {museumStatusCounts.all}
                  </button>
                  {museumFilterOptions.provinces.map((province) => (
                    <button
                      key={province}
                      type="button"
                      onClick={() => {
                        setMuseumProvinceFilter(province);
                        setMuseumCityFilter("");
                      }}
                      className={`rounded-2xl px-4 py-2 text-sm font-black ${museumProvinceFilter === province ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}
                    >
                      {province} {museumFilterOptions.provinceCounts.get(province) || 0}
                    </button>
                  ))}
                </div>

                <div className="grid gap-3">
                  <select
                    value={museumProvinceFilter}
                    onChange={(e) => {
                      setMuseumProvinceFilter(e.target.value);
                      setMuseumCityFilter("");
                    }}
                    className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="">全部省份</option>
                    {museumFilterOptions.provinces.map((item) => <option key={item} value={item}>{item}（{museumFilterOptions.provinceCounts.get(item) || 0}）</option>)}
                  </select>
                  <select value={museumCityFilter} onChange={(e) => setMuseumCityFilter(e.target.value)} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500">
                    <option value="">全部城市</option>
                    {museumFilterOptions.cities.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select value={museumTypeFilter} onChange={(e) => setMuseumTypeFilter(e.target.value)} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500">
                    <option value="">全部类型</option>
                    {museumFilterOptions.types.map((item) => <option key={item} value={item}>{item}（{museumFilterOptions.typeCounts.get(item) || 0}）</option>)}
                  </select>
                  <select value={museumGradeFilter} onChange={(e) => setMuseumGradeFilter(e.target.value)} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500">
                    <option value="">全部等级</option>
                    {museumFilterOptions.grades.map((item) => <option key={item} value={item}>{item}（{museumFilterOptions.gradeCounts.get(item) || 0}）</option>)}
                  </select>
                  <select value={museumStatusFilter} onChange={(e) => setMuseumStatusFilter(e.target.value as MuseumStatusFilter)} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500">
                    <option value="all">全部状态（{museumStatusCounts.all}）</option>
                    <option value="with-artifacts">只看有文物（{museumStatusCounts["with-artifacts"]}）</option>
                    <option value="without-artifacts">只看无文物（{museumStatusCounts["without-artifacts"]}）</option>
                    <option value="created-by-import">只看自动创建（{museumStatusCounts["created-by-import"]}）</option>
                    <option value="no-cover">只看无封面图（{museumStatusCounts["no-cover"]}）</option>
                    <option value="duplicates">只看疑似重复</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMuseumQuery("");
                      setMuseumProvinceFilter("");
                      setMuseumCityFilter("");
                      setMuseumTypeFilter("");
                      setMuseumGradeFilter("");
                      setMuseumStatusFilter("all");
                    }}
                    className="rounded-2xl bg-gray-100 px-4 py-2 text-sm font-black text-gray-700"
                  >
                    重置筛选
                  </button>
                  {activeMuseumFilterTags.map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-700">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="space-y-3 bg-gray-50 p-3">
                {museums.map(renderMuseumMobileCard)}
                {museums.length === 0 && (
                  <div className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-gray-400">
                    当前筛选下没有博物馆。
                  </div>
                )}
              </div>

              <div className="hidden">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-5 py-3 text-left font-bold">博物馆</th>
                      <th className="px-5 py-3 text-left font-bold">类型/等级</th>
                      <th className="px-5 py-3 text-left font-bold">省市</th>
                      <th className="px-5 py-3 text-left font-bold">文物</th>
                      <th className="px-5 py-3 text-left font-bold">更新时间</th>
                      <th className="px-5 py-3 text-right font-bold">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {museums.map((museum) => {
                      const cover = museumCoverUrl(museum);
                      return (
                        <tr key={museum.id} className="border-t border-gray-100">
                          <td className="px-5 py-4 align-top">
                            <div className="flex min-w-72 gap-3">
                              {cover ? (
                                <button type="button" onClick={() => onSelectMuseum(museum)} className="shrink-0">
                                  <img src={cover} alt="" className="h-12 w-16 rounded-xl bg-gray-100 object-cover" />
                                </button>
                              ) : (
                                <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs font-black text-gray-400">无封面</div>
                              )}
                              <div>
                                <div className="font-black text-gray-900">{museum.name}</div>
                                <div className="mt-1 line-clamp-1 text-xs text-gray-500">{(museum.aliases || []).join("，") || "暂无别名"}</div>
                                <div className="mt-1 text-xs text-gray-400">{museum.createdByImport ? "自动创建" : "人工维护"} · {museum.hasCover ? "有封面" : "无封面"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top text-gray-700">
                            <div>{museum.type || "-"}</div>
                            <div className="mt-1 text-xs text-gray-400">{museum.grade || "-"} / {museum.level || "-"}</div>
                          </td>
                          <td className="px-5 py-4 align-top text-gray-700">{[museum.province, museum.city].filter(Boolean).join(" / ") || "-"}</td>
                          <td className="px-5 py-4 align-top font-black text-gray-900">{museum.artifactCount || 0}</td>
                          <td className="whitespace-nowrap px-5 py-4 align-top text-xs text-gray-500">{formatShortDate(museum.updatedAt)}</td>
                          <td className="px-5 py-4 align-top">
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => onSelectMuseum(museum)} className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-black text-white">
                                查看 / 编辑
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {museums.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">当前筛选下没有博物馆。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section ref={museumDetailRef} className="scroll-mt-3 min-w-0 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
              {selectedMuseum ? (
                <form onSubmit={onSaveMuseum} className="space-y-5">
                  <div>
                    <h2 className="text-lg font-black text-gray-900">博物馆详情</h2>
                    <div className="mt-1 text-xs text-gray-500">ID {selectedMuseum.museum.id} · 馆藏文物 {selectedMuseum.stats.artifactCount} 件</div>
                  </div>

                  <div className="grid gap-3">
                    <label className="grid gap-1 text-xs font-black text-gray-500">
                      标准名称
                      <input value={museumForm.name} onChange={(e) => setMuseumForm({ ...museumForm, name: e.target.value })} placeholder="标准名称" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-500" />
                    </label>
                    <div className="grid gap-3">
                      <label className="grid gap-1 text-xs font-black text-gray-500">
                        类型
                        <select value={museumForm.type} onChange={(e) => setMuseumForm({ ...museumForm, type: e.target.value })} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-500">
                          {MUSEUM_TYPE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-black text-gray-500">
                        等级
                        <select value={museumForm.grade} onChange={(e) => setMuseumForm({ ...museumForm, grade: e.target.value })} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-500">
                          {MUSEUM_GRADE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="grid gap-3">
                      <label className="grid gap-1 text-xs font-black text-gray-500">
                        定级
                        <select value={museumForm.level} onChange={(e) => setMuseumForm({ ...museumForm, level: e.target.value })} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-500">
                          {MUSEUM_LEVEL_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-black text-gray-500">
                        官网
                        <input value={museumForm.officialWebsite} onChange={(e) => setMuseumForm({ ...museumForm, officialWebsite: e.target.value })} placeholder="官网" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-500" />
                      </label>
                    </div>
                    <div className="grid gap-3">
                      <label className="grid gap-1 text-xs font-black text-gray-500">
                        省份
                        <select
                          value={museumForm.province}
                          onChange={(e) => setMuseumForm({ ...museumForm, province: e.target.value, city: "" })}
                          className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-500"
                        >
                          <option value="">未填写</option>
                          {PROVINCE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-black text-gray-500">
                        城市
                        <div className="grid gap-2">
                          <select
                            value={museumFormUsesCustomCity ? "__custom__" : museumForm.city}
                            onChange={(e) => setMuseumForm({ ...museumForm, city: e.target.value })}
                            className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-500"
                          >
                            <option value="">未填写</option>
                            {museumFormCityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                            <option value="__custom__">自定义城市...</option>
                          </select>
                        {museumFormUsesCustomCity && (
                          <input
                            value={museumForm.city === "__custom__" ? "" : museumForm.city}
                            onChange={(e) => setMuseumForm({ ...museumForm, city: e.target.value })}
                            placeholder="自定义城市、区县或特殊地区"
                            className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-500"
                          />
                        )}
                        </div>
                      </label>
                    </div>
                    <label className="grid gap-1 text-xs font-black text-gray-500">
                      地址
                      <input value={museumForm.address} onChange={(e) => setMuseumForm({ ...museumForm, address: e.target.value })} placeholder="地址" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-500" />
                    </label>
                    <label className="grid gap-1 text-xs font-black text-gray-500">
                      简介
                      <textarea value={museumForm.description} onChange={(e) => setMuseumForm({ ...museumForm, description: e.target.value })} placeholder="简介" rows={3} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-500" />
                    </label>
                    <label className="grid gap-1 text-xs font-black text-gray-500">
                      历史
                      <textarea value={museumForm.history} onChange={(e) => setMuseumForm({ ...museumForm, history: e.target.value })} placeholder="历史" rows={3} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-500" />
                    </label>
                    <div className="grid gap-3">
                      <label className="grid gap-1 text-xs font-black text-gray-500">
                        开放时间
                        <input value={museumForm.openingHours} onChange={(e) => setMuseumForm({ ...museumForm, openingHours: e.target.value })} placeholder="开放时间" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-500" />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-gray-500">
                        门票信息
                        <input value={museumForm.ticketInfo} onChange={(e) => setMuseumForm({ ...museumForm, ticketInfo: e.target.value })} placeholder="门票信息" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-500" />
                      </label>
                    </div>
                    <label className="grid gap-1 text-xs font-black text-gray-500">
                      联系方式
                      <input value={museumForm.contact} onChange={(e) => setMuseumForm({ ...museumForm, contact: e.target.value })} placeholder="联系方式" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-500" />
                    </label>
                    <label className="grid gap-1 text-xs font-black text-gray-500">
                      特色说明
                      <textarea value={museumForm.highlights} onChange={(e) => setMuseumForm({ ...museumForm, highlights: e.target.value })} placeholder="特色说明" rows={2} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-500" />
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-black text-gray-700">
                      <input type="checkbox" checked={museumForm.isFeatured} onChange={(e) => setMuseumForm({ ...museumForm, isFeatured: e.target.checked })} />
                      首页推荐
                    </label>
                  </div>

                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-black text-gray-900">博物馆封面图上传 / 替换</div>
                    <div className="mt-1 text-xs text-gray-500">当前博物馆 ID：{selectedMuseum.museum.id}，选择后先进入 16:9 卡片裁剪预览。</div>
                    <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">{CROP_HELP_TEXT}</div>
                    {museumCoverUrl(selectedMuseum.museum) ? (
                      <div className="mt-3 grid gap-3">
                        <div className="rounded-2xl border border-gray-100 bg-white p-3">
                          <div className="text-xs font-black text-gray-500">当前封面原图</div>
                          <img src={museumOriginalCoverUrl(selectedMuseum.museum) || museumCoverUrl(selectedMuseum.museum)} alt="" className="mt-2 h-40 w-full rounded-xl bg-gray-100 object-cover" />
                          <div className="mt-2 break-all rounded-xl bg-gray-50 p-2 font-mono text-xs text-gray-500">
                            {museumOriginalCoverUrl(selectedMuseum.museum) || "暂无原图路径"}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-white p-3">
                          <div className="text-xs font-black text-gray-500">当前封面缩略图</div>
                          <img src={museumThumbnailCoverUrl(selectedMuseum.museum)} alt="" className="mt-2 h-40 w-full rounded-xl bg-gray-100 object-cover" />
                          <div className="mt-2 break-all rounded-xl bg-gray-50 p-2 font-mono text-xs text-gray-500">
                            {museumThumbnailCoverUrl(selectedMuseum.museum) || "暂无缩略图路径"}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl bg-white p-4 text-sm font-bold text-gray-400">暂无封面图，可上传一张本地图片作为博物馆介绍图。</div>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        e.currentTarget.value = "";
                        if (file) openMuseumCoverCrop(file);
                      }}
                      className="mt-3 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-xs file:font-black file:text-white"
                    />
                    {museumCoverFile && museumCoverPreviewUrl && (
                      <div className="mt-3 flex gap-3 rounded-2xl bg-white p-3">
                        <img src={museumCoverPreviewUrl} alt="" className="aspect-[16/9] w-32 rounded-xl bg-gray-100 object-cover" />
                        <div className="min-w-0 text-xs text-gray-500">
                          <div className="truncate font-bold text-gray-800">{museumCoverFile.name}</div>
                          <div className="mt-1">{formatFileSize(museumCoverFile.size)}</div>
                          <div className="mt-1 font-bold text-amber-800">裁剪结果尚未保存</div>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" disabled={saving || !museumCoverFile} onClick={onUploadMuseumCover} className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50">
                        保存裁剪封面
                      </button>
                      <button type="button" disabled={saving || !museumCoverUrl(selectedMuseum.museum)} onClick={onDeleteMuseumCover} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-50">
                        删除封面
                      </button>
                    </div>
                    <div className="mt-5 border-t border-dashed border-gray-200 pt-4">
                      <div className="text-xs font-black text-gray-500">图片链接</div>
                      <div className="mt-2 flex flex-col gap-2">
                      <input
                        value={museumCoverUrlToDownload}
                        onChange={(e) => setMuseumCoverUrlToDownload(e.target.value)}
                        placeholder="粘贴图片链接：https://..."
                        className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        disabled={downloadingMuseumCoverUrl || !museumCoverUrlToDownload.trim()}
                        onClick={onDownloadMuseumCoverUrl}
                        className="rounded-xl bg-amber-900 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                      >
                        {downloadingMuseumCoverUrl ? "下载中..." : "从链接下载并同步封面"}
                      </button>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">链接下载会调用 /api/admin/museums/{selectedMuseum.museum.id}/cover-url，成功后刷新当前封面预览。</div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <div className="text-sm font-black text-gray-900">别名</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedMuseum.aliases.map((alias) => (
                        <span key={alias.id} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-black text-gray-700">
                          {alias.alias}
                          <button type="button" onClick={() => onDeleteMuseumAlias(alias.id)} className="text-rose-600">删除</button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-2">
                      <input value={newMuseumAlias} onChange={(e) => setNewMuseumAlias(e.target.value)} placeholder="新增别名，如 南大博物馆" className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500" />
                      <button type="button" disabled={saving || !newMuseumAlias.trim()} onClick={onAddMuseumAlias} className="rounded-xl bg-amber-900 px-4 py-2 text-xs font-black text-white disabled:opacity-50">新增</button>
                    </div>
                  </div>

                  {museumMessage && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{museumMessage}</div>}

                  <button disabled={saving || !museumForm.name.trim()} className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                    {saving ? "保存中..." : "保存博物馆信息"}
                  </button>

                  <div className="border-t border-gray-100 pt-5">
                    <div className="grid gap-3">
                      <div className="text-sm font-black text-gray-900">该馆文物</div>
                      <input value={museumArtifactQuery} onChange={(e) => setMuseumArtifactQuery(e.target.value)} placeholder="搜索文物" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-amber-500" />
                    </div>
                    <div className="mt-3 max-h-80 space-y-2 overflow-auto">
                      {selectedMuseumArtifacts.map((artifact) => (
                        <button key={artifact.id} type="button" onClick={() => onEditArtifact(artifact)} className="block w-full rounded-2xl bg-gray-50 p-3 text-left">
                          <div className="text-sm font-black text-gray-900">{artifact.name}</div>
                          <div className="mt-1 text-xs text-gray-500">{artifact.dynasty || artifact.period || "-"} · {artifact.category || "-"}</div>
                        </button>
                      ))}
                      {selectedMuseumArtifacts.length === 0 && <div className="py-6 text-center text-sm text-gray-400">暂无匹配文物。</div>}
                    </div>
                  </div>
                </form>
              ) : (
                <div className="py-16 text-center text-sm text-gray-400">从左侧选择一个博物馆查看详情、编辑信息和上传封面。</div>
              )}
            </section>
          </div>
        )}

        {!loading && tab === "import" && (
          <section className="min-w-0 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-lg font-black text-gray-900">导入文物</h2>
                <div className="mt-1 text-sm text-gray-500">导入执行接口固定为 /api/import/run，完成后同步到统一 JSON 数据源。</div>
              </div>
              <button onClick={loadImportTemplate} className="rounded-2xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700">
                填入导入模板
              </button>
            </div>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='粘贴导入任务 JSON，例如 {"sourceType":"inline","format":"json","records":[...],"mode":"append"}'
              rows={18}
              className="mt-5 w-full min-w-0 rounded-2xl border border-gray-200 px-4 py-3 font-mono text-sm outline-none focus:border-amber-500"
            />
            <div className="mt-4 grid gap-3">
              <button disabled={saving || !importText.trim()} onClick={runImport} className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
                {saving ? "导入中..." : "执行导入"}
              </button>
              {importResult && <span className="text-sm font-bold text-emerald-700">{importResult}</span>}
            </div>
          </section>
        )}

        {!loading && tab === "users" && stats && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Total Users", stats.totalUsers, "系统中的用户总数"],
                ["Admins", stats.adminCount, "拥有后台权限的账号数量"],
                ["Members", regularUserCount, "普通用户账号数量"],
                ["Contacts", stats.usersWithContact, "绑定手机或邮箱的用户"],
              ].map(([label, value, desc]) => (
                <div key={label} className="min-w-0 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="break-words text-xs font-bold uppercase tracking-[0.16em] text-gray-400">{label}</div>
                  <div className="mt-3 text-2xl font-black text-gray-900">{value}</div>
                  <div className="mt-1 text-xs leading-relaxed text-gray-500">{desc}</div>
                </div>
              ))}
            </div>

            <div className="min-w-0 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-4 py-5">
                <div className="text-lg font-black text-gray-900">用户列表</div>
                <div className="mt-1 text-sm text-gray-500">管理员可查看用户资料、联系方式状态与内容数据统计。</div>
              </div>
              <div className="space-y-3 bg-gray-50 p-3">
                {users.map(renderUserMobileCard)}
              </div>
              <div className="hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-5 py-3 text-left font-bold">用户</th>
                      <th className="px-5 py-3 text-left font-bold">账号</th>
                      <th className="px-5 py-3 text-left font-bold">个人资料</th>
                      <th className="px-5 py-3 text-left font-bold">联系方式</th>
                      <th className="px-5 py-3 text-left font-bold">用户数据</th>
                      <th className="px-5 py-3 text-left font-bold">创建时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-t border-gray-100">
                        <td className="px-5 py-4 align-top">
                          <div className="flex min-w-64 items-start gap-3">
                            <img src={user.photoURL} alt="" className="h-12 w-12 rounded-2xl bg-gray-100 object-cover" referrerPolicy="no-referrer" />
                            <div>
                              <div className="font-black text-gray-900">{user.displayName || "未命名用户"}</div>
                              <div className="mt-1 font-mono text-xs text-gray-500">#{user.id}</div>
                              <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${user.role === "admin" ? "bg-amber-100 text-amber-900" : "bg-gray-100 text-gray-700"}`}>
                                {user.role === "admin" ? "管理员" : "用户"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top text-gray-700">
                          <div>MuseLink ID：<span className="font-mono">{user.museId || "-"}</span></div>
                          <div className="mt-2">登录方式：{user.contact.hasPassword ? "密码" : "验证码"}</div>
                          <div className="mt-2">可见性：{user.profileVisibility === "all" ? "所有人" : "关注者"}</div>
                        </td>
                        <td className="px-5 py-4 align-top text-gray-700">
                          <div>性别：{genderLabels[user.gender]}</div>
                          <div className="mt-2">生日：{user.birthday || "-"}</div>
                          <div className="mt-2">地区：{user.location || "-"}</div>
                          <div className="mt-2 max-w-72 text-gray-500">{user.bio || "暂无简介"}</div>
                        </td>
                        <td className="px-5 py-4 align-top text-gray-700">
                          <div>邮箱：{user.contact.email || "-"}</div>
                          <div className="mt-2">手机：{user.contact.phone || "-"}</div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="grid min-w-56 grid-cols-2 gap-2 text-xs">
                            <div className="rounded-2xl bg-gray-50 p-3"><div className="font-black text-gray-900">{user.activity.favoriteArtifacts}</div><div className="mt-1 text-gray-400">文物收藏</div></div>
                            <div className="rounded-2xl bg-gray-50 p-3"><div className="font-black text-gray-900">{user.activity.favoriteExhibitions}</div><div className="mt-1 text-gray-400">展陈收藏</div></div>
                            <div className="rounded-2xl bg-gray-50 p-3"><div className="font-black text-gray-900">{user.activity.exhibitions}</div><div className="mt-1 text-gray-400">总展陈</div></div>
                            <div className="rounded-2xl bg-gray-50 p-3"><div className="font-black text-gray-900">{user.activity.publicExhibitions}</div><div className="mt-1 text-gray-400">公开展陈</div></div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top text-gray-500">{formatDate(user.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        {cropTarget && (
          <ImageCropperPanel
            request={cropTarget}
            onCancel={closeCropTarget}
            onConfirm={onConfirmCrop}
          />
        )}
      </div>
    </div>
  );
}
