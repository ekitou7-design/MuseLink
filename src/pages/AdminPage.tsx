import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Artifact } from "../types";
import { AuthService } from "../auth/AuthService";
import { UserSession } from "../auth/UserSession";
import { apiFetch, apiUrl, getAuthToken, setAuthToken } from "../lib/api";
import { getAdminStats, getAdminUsers, type AdminStatsResponse, type AdminUserSummary } from "../lib/adminClient";
import { me } from "../lib/authClient";
import { ForbiddenPage } from "./ForbiddenPage";
import { goBackOrNavigate, navigate } from "../router/router";
import { SafeImage } from "../components/SafeImage";
import { artifactImageUrlRaw } from "../lib/dbDisplay";

type AdminTab = "artifacts" | "import" | "users";
type ArtifactImageFilter = "all" | "no-image" | "remote-only" | "local-broken" | "local-complete" | "no-local";
type ArtifactImageStatus = "local-complete" | "remote-only" | "no-image" | "local-broken";

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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function aiRagMessage(sync?: AiRagSyncSummary) {
  if (!sync) return "";
  if (!sync.ok) return `AI/RAG 生成失败：${sync.error || sync.message}`;
  return `文物已入库；AI/RAG 文档已生成；关系候选已更新；当前 AI/RAG 覆盖率：${sync.coverage}`;
}

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("artifacts");
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [form, setForm] = useState<ArtifactFormState>(emptyForm);
  const [query, setQuery] = useState("");
  const [imageFilter, setImageFilter] = useState<ArtifactImageFilter>("all");
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrlToDownload, setImageUrlToDownload] = useState("");
  const [imageUploadMessage, setImageUploadMessage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [downloadingImageUrl, setDownloadingImageUrl] = useState(false);
  const [rowImageSelections, setRowImageSelections] = useState<Record<string, RowImageSelection>>({});
  const [rowImageUrls, setRowImageUrls] = useState<Record<string, string>>({});
  const [rowUploadingIds, setRowUploadingIds] = useState<Record<string, boolean>>({});
  const [rowDownloadingIds, setRowDownloadingIds] = useState<Record<string, boolean>>({});
  const [rowImageErrors, setRowImageErrors] = useState<Record<string, string>>({});
  const [failedImageIds, setFailedImageIds] = useState<Record<string, boolean>>({});
  const [localImageFileStatuses, setLocalImageFileStatuses] = useState<Record<string, ArtifactLocalImageFileStatus>>({});
  const [adminTokenInput, setAdminTokenInput] = useState(() => getAuthToken() || "");
  const rowImageSelectionsRef = useRef(rowImageSelections);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

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

        const [usersResponse, statsResponse, artifactsResponse, imageStatusResponse] = await Promise.all([
          getAdminUsers(),
          getAdminStats(),
          apiFetch<{ artifacts?: Artifact[] }>("/api/artifacts?limit=5000"),
          apiFetch<{ statuses?: ArtifactLocalImageFileStatus[] }>("/api/admin/artifact-image-file-status"),
        ]);
        if (cancelled) return;

        setUsers(usersResponse.users);
        setStats(statsResponse);
        setArtifacts(Array.isArray(artifactsResponse.artifacts) ? artifactsResponse.artifacts : []);
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
    return () => {
      Object.values(rowImageSelectionsRef.current).forEach((selection) => URL.revokeObjectURL(selection.previewUrl));
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
      if (!keyword) return true;
      const haystack = [
        artifact.name,
        artifact.museumName,
        artifact.museum,
        artifact.dynasty,
        artifact.period,
        artifact.category,
      ].map(text).join(" ").toLowerCase();
      return haystack.includes(keyword);
    });
  }, [artifacts, failedImageIds, imageFilter, localImageFileStatuses, query]);

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
      setImageFile(null);
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

  const onSelectRowImage = (artifactId: string, file: File | null) => {
    setRowImageErrors((current) => ({ ...current, [artifactId]: "" }));
    setRowImageSelections((current) => {
      const existing = current[artifactId];
      if (existing) URL.revokeObjectURL(existing.previewUrl);
      const next = { ...current };
      delete next[artifactId];
      if (!file) return next;

      const validationError = validateArtifactImageFile(file);
      if (validationError) {
        setRowImageErrors((errors) => ({ ...errors, [artifactId]: validationError }));
        return next;
      }

      next[artifactId] = {
        file,
        previewUrl: URL.createObjectURL(file),
      };
      return next;
    });
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
    setImageFile(null);
    setImageUrlToDownload("");
    setImageUploadMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      setImportResult(
        `导入成功：${result.validRecords ?? 0} 条有效记录，文件库 ${result.fileStoreCount ?? 0} 条，DB 新增 ${result.dbSync?.inserted ?? 0}、更新 ${result.dbSync?.updated ?? 0}。${syncMessage}`,
      );
      await loadArtifacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (forbidden) return <ForbiddenPage />;

  const regularUserCount = stats ? Math.max(stats.totalUsers - stats.adminCount, 0) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-amber-800">Admin Console</div>
              <h1 className="mt-1 text-2xl font-black text-gray-900">MuseLink 后台管理</h1>
              <div className="mt-1 text-sm text-gray-500">
                当前管理员：{UserSession.getMuseId() || "jiangzhong"}，管理统一文物库、导入任务和用户数据。
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={() => goBackOrNavigate("/home")} className="rounded-2xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700">
                返回前台
              </button>
              <button onClick={onLogout} className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700">
                退出登录
              </button>
            </div>
          </div>

          <nav className="mt-6 flex flex-wrap gap-2">
            {[
              ["artifacts", "文物管理"],
              ["import", "导入文物"],
              ["users", "用户统计"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id as AdminTab)}
                className={`rounded-2xl px-4 py-2 text-sm font-black ${
                  tab === id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </header>

        {loading && <div className="rounded-3xl border border-gray-100 bg-white p-6 text-sm text-gray-500 shadow-sm">正在加载后台数据...</div>}
        {!loading && error && <div className="rounded-3xl border border-rose-100 bg-rose-50 p-6 text-sm text-rose-700">后台操作失败：{error}</div>}

        {!loading && tab === "artifacts" && (
          <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
            <form onSubmit={onSaveArtifact} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-gray-900">{form.id ? "编辑文物" : "新增文物"}</h2>
                  <div className="mt-1 text-xs text-gray-500">{form.id ? `ID ${form.id}` : "写入统一 artifacts 表"}</div>
                </div>
                {form.id && (
                  <button type="button" onClick={() => setForm(emptyForm)} className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700">
                    取消编辑
                  </button>
                )}
              </div>

              <div className="mt-5 grid gap-3">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="文物名称 *" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                <input value={form.museum} onChange={(e) => setForm({ ...form, museum: e.target.value })} placeholder="馆藏单位 *" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={form.dynasty} onChange={(e) => setForm({ ...form, dynasty: e.target.value })} placeholder="时代/朝代" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="类别" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                </div>
                <input value={form.shortIntro} onChange={(e) => setForm({ ...form, shortIntro: e.target.value })} placeholder="一句话简介" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="文物描述" rows={5} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="图片 URL" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                {form.id && (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-black text-gray-900">上传本地图片</div>
                    <div className="mt-1 text-xs text-gray-500">支持 jpg/jpeg/png/webp，上传后会同步为前端优先展示图片。</div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      className="mt-3 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-xs file:font-black file:text-white"
                    />
                    <button
                      type="button"
                      disabled={uploadingImage || !imageFile}
                      onClick={onUploadArtifactImage}
                      className="mt-3 rounded-xl bg-gray-900 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                    >
                      {uploadingImage ? "上传中..." : "上传并同步图片"}
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
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="材质" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                  <input value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder="尺寸" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="等级" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                  <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="备注" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
                </div>
              </div>

              <button disabled={saving} className="mt-5 w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                {saving ? "保存中..." : form.id ? "保存修改" : "新增文物"}
              </button>
            </form>

            <section className="rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="space-y-4 border-b border-gray-100 p-6">
                {!getAuthToken() && (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                    <div className="text-sm font-black text-amber-900">管理员 token</div>
                    <div className="mt-2 flex flex-col gap-2 md:flex-row">
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

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-black text-gray-900">文物列表</h2>
                  <div className="mt-1 text-sm text-gray-500">统一 artifacts 表当前 {artifacts.length} 条，筛选显示 {filteredArtifacts.length} 条。</div>
                </div>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索名称、馆藏机构、朝代、类别" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500 md:w-80" />
                </div>

                <div className="flex flex-wrap gap-2">
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
                      className={`rounded-2xl px-4 py-2 text-sm font-black ${
                        imageFilter === id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {label} {imageFilterCounts[id]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[760px] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-5 py-3 text-left font-bold">文物</th>
                      <th className="px-5 py-3 text-left font-bold">馆藏/时代</th>
                      <th className="px-5 py-3 text-left font-bold">图片状态</th>
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
                      const uploadButtonLabel = imageStatus.status === "local-broken" ? "重新上传" : "上传图片";
                      const downloadButtonLabel = imageStatus.status === "local-broken" ? "从外链下载补图" : "下载补图";
                      const rowHint = imageStatus.status === "remote-only"
                        ? "当前只有外链图，可直接下载成本地图。"
                        : imageStatus.status === "no-image"
                          ? "当前完全无图，请上传图片或粘贴图片链接。"
                          : imageStatus.hasMissingLocalFile
                            ? "本地图片文件不存在，请重新上传或从外链补图。"
                            : "图片加载失败，请重新上传或从外链补图。";

                      return (
                      <tr key={artifact.id} className="border-t border-gray-100">
                        <td className="px-5 py-4 align-top">
                          <div className="flex min-w-72 gap-3">
                            <SafeImage
                              src={String(artifactImageUrlRaw(artifact, "thumbnail") ?? "")}
                              alt={artifact.name || "文物图片"}
                              width={56}
                              height={56}
                              onLoad={() => setFailedImageIds((current) => ({ ...current, [artifactId]: false }))}
                              onError={() => setFailedImageIds((current) => ({ ...current, [artifactId]: true }))}
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
                          {showInlineUploader ? (
                            <div className="min-w-64 space-y-3">
                              <div className="text-xs font-bold text-gray-500">{rowHint}</div>
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="cursor-pointer rounded-xl bg-gray-100 px-3 py-2 text-xs font-black text-gray-700">
                                  选择图片
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={(e) => onSelectRowImage(artifactId, e.target.files?.[0] || null)}
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
                                  <img src={rowSelection.previewUrl} alt="" className="h-16 w-16 rounded-xl bg-white object-cover" />
                                  <div className="min-w-0 text-xs text-gray-500">
                                    <div className="truncate font-bold text-gray-800">{rowSelection.file.name}</div>
                                    <div className="mt-1">{formatFileSize(rowSelection.file.size)}</div>
                                    <div className="mt-1">{rowSelection.file.type || "-"}</div>
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
                        <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
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

        {!loading && tab === "import" && (
          <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900">导入文物</h2>
                <div className="mt-1 text-sm text-gray-500">导入执行接口固定为 /api/import/run，完成后同步到统一 artifacts 表。</div>
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
              className="mt-5 w-full rounded-2xl border border-gray-200 px-4 py-3 font-mono text-sm outline-none focus:border-amber-500"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button disabled={saving || !importText.trim()} onClick={runImport} className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
                {saving ? "导入中..." : "执行导入"}
              </button>
              {importResult && <span className="text-sm font-bold text-emerald-700">{importResult}</span>}
            </div>
          </section>
        )}

        {!loading && tab === "users" && stats && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              {[
                ["Total Users", stats.totalUsers, "系统中的用户总数"],
                ["Admins", stats.adminCount, "拥有后台权限的账号数量"],
                ["Members", regularUserCount, "普通用户账号数量"],
                ["Contacts", stats.usersWithContact, "绑定手机或邮箱的用户"],
              ].map(([label, value, desc]) => (
                <div key={label} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">{label}</div>
                  <div className="mt-3 text-3xl font-black text-gray-900">{value}</div>
                  <div className="mt-1 text-sm text-gray-500">{desc}</div>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-5">
                <div className="text-lg font-black text-gray-900">用户列表</div>
                <div className="mt-1 text-sm text-gray-500">管理员可查看用户资料、联系方式状态与内容数据统计。</div>
              </div>
              <div className="overflow-x-auto">
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
      </div>
    </div>
  );
}
