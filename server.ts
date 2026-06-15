import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { ARTIFACTS as SEED_ARTIFACTS } from "./src/data/artifacts";
import type { Artifact } from "./src/types";
import { rankArtifactsByKeywordQuery } from "./src/lib/artifactSearch";
import {
  artifactCategoryRaw,
  artifactCultureRaw,
  artifactDescriptionRaw,
  artifactDimensionsRaw,
  artifactEraRaw,
  artifactImageUrlRaw,
  artifactLevelRaw,
  artifactMaterialRaw,
  artifactMuseumRaw,
  artifactNameRaw,
  artifactRemarksRaw,
} from "./src/lib/dbDisplay";
import {
  executeArtifactImport,
  getArtifactImportTemplate,
  getImportedArtifacts,
  getImportStorePath,
  previewArtifactImport,
} from "./backend/artifact-importer";
import dotenv from "dotenv";
import {
  authMiddleware,
  getAdminStats,
  listAdminUsers,
  type AuthedRequest,
  getUserPublicProfile,
  loginWithCode,
  loginUser,
  registerUser,
  requestLoginCode,
  requireAdmin,
  updateUserProfile,
} from "./backend/auth";
import {
  createExhibition,
  deleteExhibition,
  listExhibitionsByIds,
  listMyExhibitions,
  listSquareExhibitions,
  setExhibitionFavoriteCount,
  updateExhibition,
} from "./backend/exhibitions";
import { getFavExhibitions, getFavorites, toggleFavExhibition, toggleFavorite } from "./backend/user-data";
import { buildMuseumsFromArtifacts, syncMuseumStoreFromArtifacts } from "./backend/museums";
import { db as appDb } from "./backend/api/db/client";
import { migrateArtifactDetails } from "./backend/api/db/migrateArtifactDetails";
import { upgradeArtifactsMuseumFk } from "./backend/api/db/upgradeArtifactsMuseumFk";
import { getArtifactFromDb, listArtifactsFromDb, syncImportedArtifactsToDb } from "./backend/api/db/syncImportedArtifacts";
import { searchRelics as searchRelicsInDb } from "./backend/api/db/relicSearch";
import {
  createArtifact,
  deleteArtifact,
  updateArtifact,
  uploadArtifactImage,
  uploadArtifactImageFile,
  uploadArtifactImageFromUrl,
} from "./backend/api/controllers/artifactsController";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

function getSingleQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const unifiedDbReady = (async () => {
  try {
    await upgradeArtifactsMuseumFk(appDb);
    await migrateArtifactDetails(appDb);
    const sync = await syncImportedArtifactsToDb(appDb);
    if (!sync.skipped) {
      console.log(`Synced imported artifacts to unified DB: ${sync.importedCount} file rows, ${sync.inserted} inserted, ${sync.updated} updated`);
    }
  } catch (error) {
    console.error("Unified artifact DB sync failed:", error);
  }
})();

type CuratorGuideAnswersPayload = Record<string, string>;

function sanitizeGuideAnswers(value: unknown): CuratorGuideAnswersPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, answer]) => [key, String(answer ?? "").trim().slice(0, 500)])
      .filter(([key, answer]) => key && answer),
  );
}

function sanitizeGuideSummary(value: unknown, guideAnswers: CuratorGuideAnswersPayload): string {
  const summary = typeof value === "string" ? value.trim() : "";
  if (summary) return summary.slice(0, 3000);
  return Object.entries(guideAnswers)
    .map(([key, answer]) => `${key}: ${answer}`)
    .join("；")
    .slice(0, 3000);
}

function normalizeAICuration(raw: any, artifactIds: string[]) {
  const artifactIdSet = new Set(artifactIds);
  const sections = Array.isArray(raw?.sections)
    ? raw.sections
        .map((section: any) => ({
          title: String(section?.title || "").slice(0, 60),
          summary: String(section?.summary || "").slice(0, 500),
          artifactIds: Array.isArray(section?.artifactIds)
            ? section.artifactIds.map((id: unknown) => String(id)).filter((id: string) => artifactIdSet.has(id)).slice(0, 8)
            : [],
        }))
        .filter((section: any) => section.title || section.summary || section.artifactIds.length > 0)
        .slice(0, 5)
    : [];
  const artifactNotes = raw?.artifactNotes && typeof raw.artifactNotes === "object" && !Array.isArray(raw.artifactNotes)
    ? Object.fromEntries(
        Object.entries(raw.artifactNotes)
          .map(([id, note]) => [String(id), String(note ?? "").slice(0, 240)])
          .filter(([id, note]) => artifactIdSet.has(id) && note),
      )
    : {};

  const plan = {
    theme: String(raw?.theme || "").slice(0, 80),
    opening: String(raw?.opening || "").slice(0, 700),
    sections,
    artifactNotes,
    ending: String(raw?.ending || "").slice(0, 700),
    sourceNote: String(raw?.sourceNote || "").slice(0, 300),
  };

  return Boolean(
    plan.theme ||
      plan.opening ||
      plan.sections.length > 0 ||
      Object.keys(plan.artifactNotes).length > 0 ||
      plan.ending ||
      plan.sourceNote,
  )
    ? plan
    : undefined;
}

function buildDeepSeekMessages(
  userPrompt: string,
  artifacts: Artifact[],
  guideSummary = "",
  guideAnswers: CuratorGuideAnswersPayload = {},
) {
  const artifactLines = artifacts
    .slice(0, 36)
    .map((artifact, index) => {
      const parts = [
        `id=${artifact.id}`,
        `name=${artifactNameSafe(artifact)}`,
        `museum=${artifactMuseumRaw(artifact) || ""}`,
        `era=${artifactEraRaw(artifact) || ""}`,
        `culture=${artifactCultureRaw(artifact) || ""}`,
        `material=${artifactMaterialRaw(artifact) || ""}`,
        `description=${String(artifact.description || "").slice(0, 120)}`,
      ];
      return `${index + 1}. ${parts.join("; ")}`;
    })
    .join("\n");

  return [
    {
      role: "system",
      content:
        "你是博物馆数字策展助手。只能基于用户给出的候选文物策划展陈，不要编造不存在的文物 ID。必须只输出严格 JSON，不要 Markdown。",
    },
    {
      role: "user",
      content:
        `一句话策展需求：${userPrompt || "用户未填写一句话，请根据策展问题回答生成个人展览。"}\n\n` +
        `策展问题回答摘要：${guideSummary || "无"}\n\n` +
        `结构化问题回答 JSON：${JSON.stringify(guideAnswers)}\n\n` +
        `候选文物：\n${artifactLines}\n\n` +
        "请生成一个个人化展览：主题、叙事线索、知识重点和情感落点都要回应用户的一句话需求或问题回答；如果只有问题回答，也要据此完整生成。" +
        "请返回 JSON：{\"title\":\"展陈标题\",\"intro\":\"300字以内中文展陈摘要\",\"artifactIds\":[\"候选文物id\"],\"coverUrl\":\"可为空\",\"aiCuration\":{\"theme\":\"主题\",\"opening\":\"开场语\",\"sections\":[{\"title\":\"单元标题\",\"summary\":\"单元说明\",\"artifactIds\":[\"候选文物id\"]}],\"artifactNotes\":{\"候选文物id\":\"一句话策展理由\"},\"ending\":\"结尾语\",\"sourceNote\":\"来源说明\"}}。" +
        "artifactIds 选择 6 到 12 个，必须来自候选文物 id；不要编造候选列表外的文物、馆藏来源或历史细节。",
    },
  ];
}

function artifactNameSafe(artifact: Artifact) {
  return String((artifact as any).name ?? "");
}

function extractJsonObject(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("DeepSeek response is not valid JSON.");
  }
}

function normalizeDeepSeekCuration(raw: any, candidates: Artifact[]) {
  const candidateById = new Map(candidates.map((artifact) => [artifact.id, artifact]));
  const artifactIds = Array.isArray(raw?.artifactIds)
    ? raw.artifactIds.map((id: unknown) => String(id)).filter((id: string) => candidateById.has(id)).slice(0, 12)
    : [];

  if (artifactIds.length < 3) {
    throw new Error("DeepSeek returned too few valid artifact IDs.");
  }

  const coverArtifact = artifactIds.map((id: string) => candidateById.get(id)).find(Boolean);
  return {
    title: String(raw?.title || "AI 主题展陈").slice(0, 60),
    intro: String(raw?.intro || "").slice(0, 1800),
    artifactIds,
    coverUrl: String(raw?.coverUrl || coverArtifact?.imageUrl || ""),
    aiCuration: normalizeAICuration(raw?.aiCuration, artifactIds),
  };
}

async function callDeepSeekCuration(
  userPrompt: string,
  candidates: Artifact[],
  guideSummary = "",
  guideAnswers: CuratorGuideAnswersPayload = {},
) {
  const token = process.env.DEEPSEEK_API_KEY;
  if (!token) {
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      messages: buildDeepSeekMessages(userPrompt, candidates, guideSummary, guideAnswers),
      temperature: 0.7,
      max_tokens: 1400,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`DeepSeek request failed: ${response.status} ${message.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("DeepSeek response content is empty.");
  }

  return normalizeDeepSeekCuration(extractJsonObject(content), candidates);
}

async function resolveArtifactsSource(source = "auto") {
  await unifiedDbReady;

  if (source === "seed") {
    return { artifacts: SEED_ARTIFACTS, source: "seed" };
  }

  const dbArtifacts = await listArtifactsFromDb(appDb, 10000);
  if (dbArtifacts.length > 0) {
    return { artifacts: dbArtifacts, source: "database" };
  }

  const importedArtifacts = await getImportedArtifacts();
  if (importedArtifacts.length > 0) {
    return { artifacts: importedArtifacts, source: "imported-file-fallback" };
  }

  return { artifacts: SEED_ARTIFACTS, source: "seed-fallback" };
}

function filterArtifacts(
  artifacts: Artifact[],
  params: {
    q?: string;
    museum?: string;
    period?: string;
    culture?: string;
    limit?: number;
  },
) {
  const keyword = params.q?.trim() ?? "";
  const limit = params.limit ?? artifacts.length;

  let subset = artifacts
    .filter((artifact) => !params.museum || String(artifactMuseumRaw(artifact) ?? "") === params.museum)
    .filter((artifact) => !params.period || String(artifactEraRaw(artifact) ?? "").includes(params.period))
    .filter((artifact) => !params.culture || String(artifactCultureRaw(artifact) ?? "").includes(params.culture));

  if (!keyword) {
    return subset.slice(0, limit);
  }

  return rankArtifactsByKeywordQuery(subset, keyword).slice(0, limit);
}

function isBlankArtifactDetailValue(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized === "" || normalized === "undefined" || normalized === "null";
  }
  return false;
}

function isBlankAttributeValue(value: unknown) {
  if (isBlankArtifactDetailValue(value)) return true;
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized === "未知" || normalized === "暂无信息";
  }
  return false;
}

function firstArtifactValue(artifact: unknown, keys: string[]) {
  const record = (artifact || {}) as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (!isBlankArtifactDetailValue(value)) return value;
  }
  return "";
}

function stringValue(value: unknown) {
  if (isBlankArtifactDetailValue(value)) return "";
  return typeof value === "string" ? value : String(value);
}

function addArtifactAttribute(
  groups: Map<string, { order: number; items: { name: string; value: string; order: number }[] }>,
  groupRaw: unknown,
  nameRaw: unknown,
  valueRaw: unknown,
  sortOrderRaw: unknown,
) {
  if (isBlankArtifactDetailValue(nameRaw) || isBlankAttributeValue(valueRaw)) return;
  const group = stringValue(groupRaw) || "基础信息";
  const name = stringValue(nameRaw);
  const value = stringValue(valueRaw);
  const parsedOrder = Number(sortOrderRaw);
  const order = Number.isFinite(parsedOrder) ? parsedOrder : 0;
  const existing = groups.get(group) || { order, items: [] };
  existing.order = Math.min(existing.order, order);
  existing.items.push({ name, value, order });
  groups.set(group, existing);
}

function normalizeArtifactAttributes(artifact: Artifact) {
  const record = artifact as unknown as Record<string, unknown>;
  const groups = new Map<string, { order: number; items: { name: string; value: string; order: number }[] }>();
  const rawAttributes = record.attributes;

  if (Array.isArray(rawAttributes)) {
    for (const raw of rawAttributes) {
      const groupRecord = raw as Record<string, unknown>;
      if (Array.isArray(groupRecord.items)) {
        for (const rawItem of groupRecord.items) {
          const item = rawItem as Record<string, unknown>;
          addArtifactAttribute(
            groups,
            groupRecord.group ?? groupRecord.attribute_group,
            item.name ?? item.attribute_name,
            item.value ?? item.attribute_value,
            item.sortOrder ?? item.sort_order,
          );
        }
      } else {
        addArtifactAttribute(
          groups,
          groupRecord.group ?? groupRecord.attribute_group,
          groupRecord.name ?? groupRecord.attribute_name,
          groupRecord.value ?? groupRecord.attribute_value,
          groupRecord.sortOrder ?? groupRecord.sort_order,
        );
      }
    }
  }

  if (groups.size === 0) {
    addArtifactAttribute(groups, "基础信息", "材质", firstArtifactValue(artifact, ["material", "材质"]), 1);
    addArtifactAttribute(
      groups,
      "基础信息",
      "尺寸",
      firstArtifactValue(artifact, ["dimensions", "size", "尺寸", "规格", "体量"]),
      2,
    );
    addArtifactAttribute(groups, "基础信息", "等级", firstArtifactValue(artifact, ["level", "等级", "级别", "文物等级"]), 3);
    addArtifactAttribute(
      groups,
      "其他信息",
      "备注",
      firstArtifactValue(artifact, ["remarks", "remark", "note", "notes", "备注", "附注"]),
      4,
    );
  }

  return Array.from(groups.entries())
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
}

function normalizeArtifactTags(tags: unknown) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => {
      if (typeof tag === "string") return { type: "文化标签", name: tag };
      if (tag && typeof tag === "object") {
        const record = tag as Record<string, unknown>;
        return {
          type: stringValue(record.type) || "文化标签",
          name: stringValue(record.name),
        };
      }
      return { type: "文化标签", name: stringValue(tag) };
    })
    .filter((tag) => !isBlankArtifactDetailValue(tag.name) && tag.name !== "暂无信息");
}

function buildArtifactDetail(artifact: Artifact) {
  const record = artifact as unknown as Record<string, unknown>;
  const museumName = stringValue(record.museumName) || stringValue(artifactMuseumRaw(artifact));
  const dynasty = stringValue(record.dynasty) || stringValue(artifactEraRaw(artifact));
  const imageUrl = stringValue(record.imageUrl) || stringValue(artifactImageUrlRaw(artifact));
  const sourceUrl = stringValue(record.sourceUrl) || stringValue(record.source_url) || stringValue(record["来源链接"]);

  return {
    ...artifact,
    id: String(record.id ?? ""),
    name: stringValue(record.name) || stringValue(artifactNameRaw(artifact)),
    museumName,
    museum: museumName,
    dynasty,
    period: dynasty,
    category: stringValue(record.category) || stringValue(artifactCategoryRaw(artifact)),
    imageUrl,
    image_url: imageUrl,
    shortIntro: stringValue(record.shortIntro) || stringValue(record.short_intro) || stringValue(record["一句话简介"]),
    description: stringValue(record.description) || stringValue(artifactDescriptionRaw(artifact)),
    sourceUrl,
    source_url: sourceUrl,
    attributes: normalizeArtifactAttributes(artifact),
    tags: normalizeArtifactTags(record.tags),
  };
}

function getAllowedCorsOrigin(origin: string | undefined) {
  const configured = (process.env.CORS_ORIGIN || "*")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (configured.includes("*")) return "*";
  if (origin && configured.includes(origin)) return origin;
  return configured[0] || "*";
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: "50mb" }));
  app.use((req, res, next) => {
    const allowedOrigin = getAllowedCorsOrigin(req.headers.origin);
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  // --- Auth (numeric id + password + JWT) ---
  app.post("/api/auth/register", async (req, res) => {
    try {
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      const confirmPassword =
        typeof req.body?.confirmPassword === "string" ? req.body.confirmPassword : "";
      const result = await registerUser({ password, confirmPassword });
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const museId = typeof req.body?.museId === "string" ? req.body.museId : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!/^[A-Za-z0-9_-]{4,24}$/.test(museId.trim())) {
        return res.status(400).json({ error: "登录账号必须是 4~24 位字母、数字、下划线或短横线。" });
      }
      const result = await loginUser({ museId, password });
      res.json(result);
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/auth/code/request", async (req, res) => {
    try {
      const channel = req.body?.channel === "email" ? "email" : "phone";
      const target = typeof req.body?.target === "string" ? req.body.target : "";
      const result = await requestLoginCode({ channel, target });
      res.json({
        expiresIn: result.expiresIn,
        devCode: result.devCode,
        message: "验证码已生成。",
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/auth/code/login", async (req, res) => {
    try {
      const channel = req.body?.channel === "email" ? "email" : "phone";
      const target = typeof req.body?.target === "string" ? req.body.target : "";
      const code = typeof req.body?.code === "string" ? req.body.code : "";
      const result = await loginWithCode({ channel, target, code });
      res.json(result);
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthedRequest, res) => {
    try {
      const me = await getUserPublicProfile(req.auth!.userId);
      if (!me) return res.status(404).json({ error: "User not found." });
      res.json(me);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    try {
      const users = await listAdminUsers();
      res.json({ users });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    try {
      const stats = await getAdminStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/artifacts", requireAdmin, createArtifact);
  app.post("/api/admin/artifacts/:id/image", requireAdmin, uploadArtifactImageFile, uploadArtifactImage);
  app.post("/api/admin/artifacts/:id/image-url", requireAdmin, uploadArtifactImageFromUrl);
  app.put("/api/artifacts/:id", requireAdmin, updateArtifact);
  app.delete("/api/artifacts/:id", requireAdmin, deleteArtifact);

  // --- User profile & favorites ---
  app.get("/api/users/me/profile", authMiddleware, async (req: AuthedRequest, res) => {
    const me = await getUserPublicProfile(req.auth!.userId);
    if (!me) return res.status(404).json({ error: "User not found." });
    res.json(me.profile);
  });

  app.patch("/api/users/me/profile", authMiddleware, async (req: AuthedRequest, res) => {
    try {
      const updated = await updateUserProfile(req.auth!.userId, req.body || {});
      res.json(updated.profile);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/users/me/favorites", authMiddleware, async (req: AuthedRequest, res) => {
    const favorites = await getFavorites(req.auth!.userId);
    res.json({ favorites });
  });

  app.post("/api/users/me/favorites/toggle", authMiddleware, async (req: AuthedRequest, res) => {
    try {
      const artifactId = typeof req.body?.artifactId === "string" ? req.body.artifactId : "";
      if (!artifactId) return res.status(400).json({ error: "artifactId required." });
      const favorites = await toggleFavorite(req.auth!.userId, artifactId);
      res.json({ favorites });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/users/me/fav-exhibitions", authMiddleware, async (req: AuthedRequest, res) => {
    const favExhibitions = await getFavExhibitions(req.auth!.userId);
    res.json({ favExhibitions });
  });

  app.get("/api/users/me/fav-exhibitions/details", authMiddleware, async (req: AuthedRequest, res) => {
    const favExhibitionIds = await getFavExhibitions(req.auth!.userId);
    const exhibitions = await listExhibitionsByIds(favExhibitionIds);
    res.json({ exhibitions });
  });

  app.post("/api/users/me/fav-exhibitions/toggle", authMiddleware, async (req: AuthedRequest, res) => {
    try {
      const exhibitionId = typeof req.body?.exhibitionId === "string" ? req.body.exhibitionId : "";
      if (!exhibitionId) return res.status(400).json({ error: "exhibitionId required." });
      const result = await toggleFavExhibition(req.auth!.userId, exhibitionId);
      await setExhibitionFavoriteCount(exhibitionId, result.favsCount);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // --- Exhibitions ---
  app.get("/api/exhibitions/square", async (req, res) => {
    const limit = Number(req.query.limit || 10);
    const records = await listSquareExhibitions(Number.isFinite(limit) ? limit : 10);
    res.json({ exhibitions: records });
  });

  app.get("/api/exhibitions/mine", authMiddleware, async (req: AuthedRequest, res) => {
    const records = await listMyExhibitions(req.auth!.userId);
    res.json({ exhibitions: records });
  });

  app.post("/api/exhibitions", authMiddleware, async (req: AuthedRequest, res) => {
    try {
      const me = await getUserPublicProfile(req.auth!.userId);
      if (!me) return res.status(404).json({ error: "User not found." });
      const exhibition = await createExhibition({
        userId: me.id,
        userName: me.profile.displayName,
        userPhoto: me.profile.photoURL,
        title: typeof req.body?.title === "string" ? req.body.title : "",
        intro: typeof req.body?.intro === "string" ? req.body.intro : "",
        coverUrl: typeof req.body?.coverUrl === "string" ? req.body.coverUrl : "",
        artifactIds: Array.isArray(req.body?.artifactIds) ? req.body.artifactIds : [],
        isPublic: Boolean(req.body?.isPublic),
        bgmUrl: typeof req.body?.bgmUrl === "string" ? req.body.bgmUrl : undefined,
        slideshowSettings: req.body?.slideshowSettings,
        aiCuration: req.body?.aiCuration,
        exhibitionIntro: typeof req.body?.exhibitionIntro === "string" ? req.body.exhibitionIntro : undefined,
        units: req.body?.units,
        conclusion: typeof req.body?.conclusion === "string" ? req.body.conclusion : undefined,
        selectionReasons: req.body?.selectionReasons,
        artifactRoles: req.body?.artifactRoles,
      });
      res.json(exhibition);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/exhibitions/:id", authMiddleware, async (req: AuthedRequest, res) => {
    try {
      const id = req.params.id;
      const updated = await updateExhibition(req.auth!.userId, id, req.body || {});
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/exhibitions/:id", authMiddleware, async (req: AuthedRequest, res) => {
    try {
      const id = req.params.id;
      await deleteExhibition(req.auth!.userId, id);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/artifacts", async (req, res) => {
    try {
      const source = getSingleQueryParam(req.query.source as string | string[] | undefined) || "auto";
      const limitValue = Number(getSingleQueryParam(req.query.limit as string | string[] | undefined) || "5000");
      const { artifacts, source: resolvedSource } = await resolveArtifactsSource(source);
      const filteredArtifacts = filterArtifacts(artifacts, {
        q: getSingleQueryParam(req.query.q as string | string[] | undefined),
        museum: getSingleQueryParam(req.query.museum as string | string[] | undefined),
        period: getSingleQueryParam(req.query.period as string | string[] | undefined),
        culture: getSingleQueryParam(req.query.culture as string | string[] | undefined),
        limit: Number.isFinite(limitValue) ? limitValue : 5000,
      });

      res.json({
        source: resolvedSource,
        total: filteredArtifacts.length,
        artifacts: filteredArtifacts,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/artifacts/:id", async (req, res) => {
    try {
      const source = getSingleQueryParam(req.query.source as string | string[] | undefined) || "auto";
      const id = decodeURIComponent(req.params.id);
      if (source !== "seed") {
        await unifiedDbReady;
        const dbArtifact = await getArtifactFromDb(appDb, id);
        if (dbArtifact) {
          return res.json({
            source: "database",
            artifact: buildArtifactDetail(dbArtifact),
          });
        }
      }

      const { artifacts, source: resolvedSource } = await resolveArtifactsSource(source);
      const artifact = artifacts.find((item) => String(item.id) === id);

      if (!artifact) {
        return res.status(404).json({ error: "Artifact not found." });
      }

      res.json({
        source: resolvedSource,
        artifact: buildArtifactDetail(artifact),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/relics/search", async (req, res) => {
    try {
      const keyword = getSingleQueryParam(req.query.keyword as string | string[] | undefined)?.trim() ?? "";
      const limitValue = Number(getSingleQueryParam(req.query.limit as string | string[] | undefined) || "100");

      if (!keyword) {
        return res.status(400).json({ error: "请输入搜索内容" });
      }

      const limit = Number.isFinite(limitValue) ? limitValue : 100;
      await unifiedDbReady;
      const artifacts = await searchRelicsInDb(appDb, { keyword, limit });

      res.json({
        source: "database",
        keyword,
        total: artifacts.length,
        artifacts,
        relics: artifacts,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  /** 关键词检索文物 ID，供策展与关联候选（全字段排序，无外部向量 API） */
  app.post("/api/rag/search", async (req, res) => {
    try {
      const q = typeof req.body?.q === "string" ? req.body.q.trim() : "";
      const limitRaw = Number(req.body?.limit);
      const limit = Number.isFinite(limitRaw) ? Math.min(120, Math.max(1, limitRaw)) : 40;

      if (!q) {
        return res.status(400).json({ error: "q is required" });
      }

      const source = typeof req.body?.source === "string" ? req.body.source : "auto";
      const { artifacts } = await resolveArtifactsSource(source as "auto" | "imported" | "seed" | "merged");

      const keywordRanked = rankArtifactsByKeywordQuery(artifacts, q).slice(0, limit);
      const keywordIds = keywordRanked.map((a) => a.id);

      res.json({
        mode: "keyword",
        artifactIds: keywordIds,
        keywordArtifactIds: keywordIds,
        semanticArtifactIds: [] as string[],
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/ai/curation", async (req, res) => {
    try {
      const action = typeof req.body?.action === "string" ? req.body.action : "generate-exhibition";
      if (action !== "generate-exhibition") {
        return res.status(400).json({ error: `Unsupported AI action: ${action}` });
      }

      const userPrompt = typeof req.body?.userPrompt === "string" ? req.body.userPrompt.trim() : "";
      const guideAnswers = sanitizeGuideAnswers(req.body?.guideAnswers);
      const guideSummary = sanitizeGuideSummary(req.body?.guideSummary, guideAnswers);
      const candidates = Array.isArray(req.body?.artifacts) ? (req.body.artifacts as Artifact[]) : [];
      if (!userPrompt && !guideSummary) {
        return res.status(400).json({ error: "userPrompt or guideAnswers is required." });
      }
      if (candidates.length === 0) {
        return res.status(400).json({ error: "artifacts are required." });
      }

      const result = await callDeepSeekCuration(userPrompt, candidates, guideSummary, guideAnswers);
      res.json(result);
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/museums", async (req, res) => {
    try {
      const source = getSingleQueryParam(req.query.source as string | string[] | undefined) || "auto";
      const { artifacts, source: resolvedSource } = await resolveArtifactsSource(source);
      const museums = await syncMuseumStoreFromArtifacts(artifacts);

      res.json({
        source: resolvedSource,
        total: museums.length,
        museums,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get(["/api/museums/:id", "/api/museum/:id"], async (req, res) => {
    try {
      const source = getSingleQueryParam(req.query.source as string | string[] | undefined) || "auto";
      const { artifacts, source: resolvedSource } = await resolveArtifactsSource(source);
      const museums = buildMuseumsFromArtifacts(artifacts);
      const idOrName = decodeURIComponent(req.params.id);
      const museum = museums.find((item) => item.id === idOrName || item.name === idOrName);

      if (!museum) {
        return res.status(404).json({ error: "Museum not found." });
      }

      const artifactIdSet = new Set(museum.artifactIds);
      res.json({
        source: resolvedSource,
        museum,
        artifacts: artifacts.filter((artifact) => artifactIdSet.has(artifact.id)),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/import/template", async (_req, res) => {
    try {
      res.json({
        template: getArtifactImportTemplate(),
        storePath: await getImportStorePath(),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/import/preview", async (req, res) => {
    try {
      const result = await previewArtifactImport(req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/import/run", async (req, res) => {
    try {
      const result = await executeArtifactImport({
        job: {
          ...req.body,
          persistTo: ["file"],
        },
      });
      await unifiedDbReady;
      const dbSync = await syncImportedArtifactsToDb(appDb);
      await syncMuseumStoreFromArtifacts(result.artifacts);
      res.json({ ...result, dbSync });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Debug endpoint
  app.get("/api/debug/artifacts", async (_req, res) => {
    try {
      const importedArtifacts = await getImportedArtifacts();
      res.json({
        count: importedArtifacts.length,
        sample: importedArtifacts.slice(0, 10).map((artifact) => ({ id: artifact.id, name: artifact.name })),
        storePath: await getImportStorePath(),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.use("/artifact-images", express.static(path.join(process.cwd(), "public", "artifact-images")));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ["**/data/**", "**/data/*.json"],
        },
        hmr: false,
        ws: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
