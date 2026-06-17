import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
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
  artifactOriginRaw,
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
import { db as appDb } from "./backend/api/db/client";
import { migrateArtifactDetails } from "./backend/api/db/migrateArtifactDetails";
import { upgradeArtifactsMuseumFk } from "./backend/api/db/upgradeArtifactsMuseumFk";
import { syncImportedArtifactsToDb } from "./backend/api/db/syncImportedArtifacts";
import { syncImportedMuseumsToDb } from "./backend/api/db/syncImportedMuseums";
import { museumRoutes } from "./backend/api/routes/museumRoutes";
import { ensureMuseumSchema, seedBuiltInMuseumAliases } from "./backend/museum-normalizer";
import {
  getArtifactFromStore,
  listArtifactsFromStore,
  searchArtifactsInStore,
} from "./backend/api/services/artifactsStore";
import {
  getMuseumArtifactsFromStore,
  listMuseumsFromStore,
  refreshMuseumArtifactIndex,
} from "./backend/api/services/museumsStore";
import {
  createArtifact,
  deleteArtifact,
  listEditorRecommendedArtifacts,
  updateArtifact,
  updateArtifactEditorRecommendation,
  uploadArtifactImage,
  uploadArtifactImageFile,
  uploadArtifactImageFromUrl,
} from "./backend/api/controllers/artifactsController";
import {
  uploadExhibitionCover,
  uploadExhibitionCoverFile,
} from "./backend/api/controllers/exhibitionCoversController";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACT_IMAGE_PUBLIC_DIR = path.join(process.cwd(), "public", "artifact-images");

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

class AiCurationError extends Error {
  code: string;
  httpStatus: number;
  detail?: string;

  constructor(code: string, message: string, detail?: string, httpStatus = 502) {
    super(message);
    this.name = "AiCurationError";
    this.code = code;
    this.detail = detail;
    this.httpStatus = httpStatus;
  }
}

function isPlaceholderSecret(value: string) {
  return /MY_DEEPSEEK_API_KEY|YOUR|PLACEHOLDER|^sk-?xxx/i.test(value.trim());
}

function deepSeekConfigStatus() {
  const token = process.env.DEEPSEEK_API_KEY?.trim() || "";
  return {
    hasApiKey: Boolean(token),
    apiKeyLooksPlaceholder: Boolean(token && isPlaceholderSecret(token)),
    baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
  };
}

function classifyDeepSeekHttpError(status: number, body: string) {
  const detail = body.slice(0, 300);
  if (status === 401 || status === 403) {
    return new AiCurationError("auth_failed", "AI 服务认证失败，请检查 DeepSeek API Key。", detail, 502);
  }
  if (status === 402) {
    return new AiCurationError("insufficient_balance", "AI 服务余额不足，请检查 DeepSeek 账户余额。", detail, 502);
  }
  if (status === 408 || status === 504) {
    return new AiCurationError("timeout", "AI 服务请求超时，请稍后重试。", detail, 504);
  }
  if (status === 429) {
    return new AiCurationError("rate_limited", "AI 服务请求过于频繁，请稍后再试。", detail, 429);
  }
  if (status === 400 && /model|模型|does not exist|invalid/i.test(body)) {
    return new AiCurationError("invalid_model", "AI 模型配置无效，请检查 DEEPSEEK_MODEL。", detail, 502);
  }
  return new AiCurationError("provider_error", `AI 服务请求失败（HTTP ${status}）。`, detail, 502);
}

function isResponseFormatUnsupported(status: number, body: string) {
  return status === 400 && /response_format|json_object|not support|unsupported|invalid/i.test(body);
}

function normalizeAiCurationError(error: unknown) {
  if (error instanceof AiCurationError) return error;
  if (error instanceof Error) {
    if (error.name === "AbortError" || /aborted|timeout/i.test(error.message)) {
      return new AiCurationError("timeout", "AI 服务请求超时，请稍后重试。", error.message, 504);
    }
    if (/fetch failed|ENOTFOUND|ECONNRESET|ECONNREFUSED|network/i.test(error.message)) {
      return new AiCurationError("network_error", "AI 服务网络连接失败，请检查网络或服务地址。", error.message, 502);
    }
    if (/not valid JSON|JSON/i.test(error.message)) {
      return new AiCurationError("invalid_json", "AI 返回格式无效，无法解析 JSON。", error.message, 502);
    }
    if (/Unterminated string|Unexpected end of JSON input/i.test(error.message)) {
      return new AiCurationError("truncated_json", "AI 返回内容被截断，请重试或减少展品数量。", error.message, 502);
    }
    if (/too few valid artifact IDs/i.test(error.message)) {
      return new AiCurationError("too_few_valid_artifact_ids", "AI 返回的有效文物 id 不足。", error.message, 502);
    }
    if (/response content is empty/i.test(error.message)) {
      return new AiCurationError("empty_response", "AI 返回内容为空。", error.message, 502);
    }
    if (/DEEPSEEK_API_KEY is not configured/i.test(error.message)) {
      return new AiCurationError("missing_api_key", "AI 服务未配置 API Key。", error.message, 502);
    }
    return new AiCurationError("unknown_ai_error", error.message, error.stack, 502);
  }
  return new AiCurationError("unknown_ai_error", "AI 服务调用失败。", String(error), 502);
}

function getSingleQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const unifiedDbReady = (async () => {
  try {
    await upgradeArtifactsMuseumFk(appDb);
    await ensureMuseumSchema(appDb);
    await seedBuiltInMuseumAliases(appDb);
    await migrateArtifactDetails(appDb);
    const sync = await syncImportedArtifactsToDb(appDb);
    const museumSync = await syncImportedMuseumsToDb(appDb);
    if (!sync.skipped) {
      console.log(`Synced imported artifacts to unified DB: ${sync.importedCount} file rows, ${sync.inserted} inserted, ${sync.updated} updated`);
    }
    console.log(`Synced imported museums to runtime DB: ${museumSync.importedCount} file rows, ${museumSync.inserted} inserted, ${museumSync.updated} updated`);
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
    ending: String(raw?.ending || raw?.closing || "").slice(0, 700),
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
  compact = false,
  profile?: CurationSearchProfile,
) {
  const targetArtifactCount = Math.min(8, Math.max(3, profile?.artifactCount ?? 6));
  const profileForPrompt = profile
    ? {
        rawPrompt: profile.rawPrompt,
        normalizedTheme: profile.normalizedTheme,
        intent: profile.intent,
        coreConcepts: profile.coreConcepts,
        perspective: profile.perspective,
        mood: profile.mood,
        style: profile.style,
        artifactCount: targetArtifactCount,
        searchKeywords: profile.searchKeywords.slice(0, 50),
        strongKeywords: profile.strongKeywords.slice(0, 40),
        weakKeywords: profile.weakKeywords.slice(0, 24),
        preferredCategories: profile.preferredCategories,
        preferredMaterials: profile.preferredMaterials,
        preferredDynasties: profile.preferredDynasties,
        preferredMuseums: profile.preferredMuseums,
        negativeKeywords: profile.negativeKeywords,
      }
    : null;
  const artifactLines = artifacts
    .slice(0, 36)
    .map((artifact, index) => {
      const tagText = (artifact.tags ?? [])
        .map((tag) => (typeof tag === "string" ? tag : [tag.type, tag.name].filter(Boolean).join(" ")))
        .join(" ")
        .slice(0, 80);
      const parts = [
        `id=${artifact.id}`,
        `name=${artifactNameSafe(artifact)}`,
        `museum=${artifactMuseumRaw(artifact) || ""}`,
        `era=${artifactEraRaw(artifact) || ""}`,
        `culture=${artifactCultureRaw(artifact) || ""}`,
        `category=${artifactCategoryRaw(artifact) || ""}`,
        `material=${artifactMaterialRaw(artifact) || ""}`,
        `tags=${tagText}`,
        `description=${String(artifact.description || "").slice(0, 120)}`,
      ];
      return `${index + 1}. ${parts.join("; ")}`;
    })
    .join("\n");

	  return [
	    {
	      role: "system",
	      content:
	        [
	          "你是博物馆数字策展助手。只能基于用户给出的候选文物策划展陈，不要编造不存在的文物 ID。",
	          "你必须只返回一个严格合法的 JSON 对象。",
	          "不要返回 Markdown，不要返回 ```json 代码块，不要返回解释文字，不要返回注释。",
	          "所有对象键名和字符串必须使用双引号；数组元素之间必须有逗号；不要使用尾随逗号。",
	          "artifactIds 必须是候选文物 id 字符串数组，且只能包含候选列表中的 id。",
	        ].join(" "),
	    },
    {
      role: "user",
      content:
        `一句话策展需求：${userPrompt || "用户未填写一句话，请根据策展问题回答生成个人展览。"}\n\n` +
        `策展问题回答摘要：${guideSummary || "无"}\n\n` +
        `结构化问题回答 JSON：${JSON.stringify(guideAnswers)}\n\n` +
        `结构化策展需求 Profile：${JSON.stringify(profileForPrompt)}\n\n` +
        `候选文物：\n${artifactLines}\n\n` +
	        (compact
	          ? `请生成一个极简个人化展览，只返回 JSON。返回结构：{\"title\":\"展陈标题\",\"intro\":\"120字以内摘要\",\"artifactIds\":[\"候选文物id\"]}。artifactIds 尽量 ${targetArtifactCount} 个、最多 8 个，必须来自候选文物 id。不要返回 aiCuration、sections、artifactNotes 或每件文物说明。`
	          : "请生成一个个人化展览：主题、叙事线索、知识重点和情感落点都要回应用户的一句话需求或问题回答；如果只有问题回答，也要据此完整生成。\n\n" +
	            "必须服从 Profile 中的 coreConcepts、perspective、mood/style 和 artifactCount；强关键词优先，弱关键词只能作为辅助语气或背景。\n" +
	            "只能从候选文物中选择 artifactIds；如果候选与主题只是弱相关，标题和说明要更谨慎，不要硬编不存在的联系、人物、出土地或馆藏信息。\n\n" +
	            "返回结构必须严格符合这个 JSON schema，不要增加解释文字：\n" +
	            "{\"title\":\"展陈标题\",\"subtitle\":\"短副标题\",\"intro\":\"120字以内中文摘要\",\"artifactIds\":[\"候选文物id\"],\"aiCuration\":{\"theme\":\"主题\",\"opening\":\"180字以内开场语\",\"sections\":[{\"title\":\"单元标题\",\"summary\":\"120字以内单元说明\",\"artifactIds\":[\"候选文物id\"]}],\"closing\":\"120字以内结尾语\"}}\n\n" +
	            `硬性内容限制：artifactIds 尽量 ${targetArtifactCount} 个、最多 8 个，必须来自候选文物 id；sections 2 到 3 个；每个 section 放 2 到 3 件；不要输出 artifactNotes 大对象；不要输出每件文物的大段说明；不要编造候选列表外的文物、馆藏来源或历史细节。`) +
	        " 硬性格式规则：只返回 JSON 对象；不要 Markdown；不要 ```json；不要注释；不要前后说明；所有字符串必须用双引号；数组元素之间必须有逗号；不要尾随逗号。",
	    },
	  ];
	}

function artifactNameSafe(artifact: Artifact) {
  return String((artifact as any).name ?? "");
}

function previewText(value: string, length = 300) {
  return value.replace(/\s+/g, " ").trim().slice(0, length);
}

function stripMarkdownJsonBlock(rawText: string) {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] || trimmed)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractFirstCompleteJsonObject(text: string) {
  const start = text.indexOf("{");
  if (start < 0) return "";

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return "";
}

function parseJsonCandidate(candidate: string) {
  return JSON.parse(candidate);
}

function parseAiJsonResponse(rawText: string) {
  const hasMarkdownCodeBlock = /```(?:json)?/i.test(rawText);
  const cleaned = stripMarkdownJsonBlock(rawText);
  const extracted = extractFirstCompleteJsonObject(cleaned) || extractFirstCompleteJsonObject(rawText);
  let rawError = "";
  let cleanedError = "";
  let extractedError = "";

  if (isDevRuntime()) {
    console.debug("AI raw text preview:", previewText(rawText, 1000));
  }

  try {
    const parsed = parseJsonCandidate(rawText.trim());
    if (isDevRuntime()) console.debug("AI JSON parse success: raw text");
    return parsed;
  } catch (error) {
    rawError = error instanceof Error ? error.message : String(error);
  }

  try {
    const parsed = parseJsonCandidate(cleaned);
    if (isDevRuntime()) {
      console.debug("AI cleaned JSON preview:", previewText(cleaned, 1000));
      console.debug("AI JSON parse success: cleaned text");
    }
    return parsed;
  } catch (error) {
    cleanedError = error instanceof Error ? error.message : String(error);
  }

  if (extracted) {
    try {
      const parsed = parseJsonCandidate(extracted);
      if (isDevRuntime()) {
        console.debug("AI extracted JSON preview:", previewText(extracted, 1000));
        console.debug("AI JSON parse success: extracted object");
      }
      return parsed;
    } catch (error) {
      extractedError = error instanceof Error ? error.message : String(error);
    }
  }

  if (isDevRuntime()) {
    console.debug("AI cleaned JSON preview:", previewText(cleaned, 1000));
    console.debug("AI JSON parse failed:", { rawError, cleanedError, extractedError });
  }
  const parseError = extractedError || cleanedError || rawError;
  const isTruncated = /Unterminated string|Unexpected end of JSON input/i.test(parseError);

  throw new AiCurationError(
    isTruncated ? "truncated_json" : "invalid_json",
    isTruncated ? "AI 返回内容被截断，请重试或减少展品数量。" : "AI 返回格式无效，无法解析 JSON。",
    [
      `hasMarkdownCodeBlock=${hasMarkdownCodeBlock}`,
      `cleanedParseFailed=${Boolean(cleanedError)}`,
      `extractedObjectFound=${Boolean(extracted)}`,
      `parseError=${parseError}`,
      `rawTextPreview=${previewText(rawText, 300)}`,
    ].join("; "),
    502,
  );
}

function collectArtifactIdsFromUnknown(value: unknown, candidateById: Map<string, Artifact>) {
  const ids: string[] = [];
  const visit = (node: unknown) => {
    if (!node) return;
    if (typeof node === "string" || typeof node === "number") {
      const id = String(node);
      if (candidateById.has(id)) ids.push(id);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node === "object") {
      const record = node as Record<string, unknown>;
      visit(record.artifactId);
      visit(record.artifact_id);
      visit(record.id);
      visit(record.artifactIds);
      visit(record.artifact_ids);
      visit(record.artifacts);
    }
  };
  visit(value);
  return ids;
}

function uniqueValidArtifactIds(ids: unknown[], candidateById: Map<string, Artifact>) {
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const rawId of ids) {
    const id = String(rawId);
    if (!candidateById.has(id) || seen.has(id)) continue;
    seen.add(id);
    valid.push(id);
  }
  return valid;
}

function repairDeepSeekSchema(raw: any, candidateById: Map<string, Artifact>) {
  const directIds = Array.isArray(raw?.artifactIds)
    ? raw.artifactIds
    : Array.isArray(raw?.artifact_ids)
      ? raw.artifact_ids
      : [];
  const nestedIds = [
    ...collectArtifactIdsFromUnknown(raw?.units, candidateById),
    ...collectArtifactIdsFromUnknown(raw?.sections, candidateById),
    ...collectArtifactIdsFromUnknown(raw?.aiCuration?.sections, candidateById),
  ];
  const artifactIds = uniqueValidArtifactIds([...directIds, ...nestedIds], candidateById).slice(0, 12);
  const intro = raw?.intro ?? raw?.introduction ?? raw?.preface ?? raw?.subtitle ?? "";
  const aiCuration = raw?.aiCuration && typeof raw.aiCuration === "object" && !Array.isArray(raw.aiCuration)
    ? raw.aiCuration
    : {
        theme: raw?.theme,
        opening: raw?.opening ?? raw?.preface ?? raw?.introduction,
        sections: Array.isArray(raw?.sections) ? raw.sections : Array.isArray(raw?.units) ? raw.units : undefined,
        ending: raw?.ending ?? raw?.conclusion,
        sourceNote: raw?.sourceNote,
      };

  return {
    ...raw,
    title: typeof raw?.title === "string" && raw.title.trim() ? raw.title : "AI 主题展陈",
    intro: typeof intro === "string" ? intro : "",
    artifactIds,
    aiCuration,
  };
}

function normalizeDeepSeekCuration(raw: any, candidates: Artifact[]) {
  const candidateById = new Map(candidates.map((artifact) => [artifact.id, artifact]));
  const rawArtifactIds = uniqueStrings(
    [
      ...(Array.isArray(raw?.artifactIds) ? raw.artifactIds.map((id: unknown) => String(id)) : []),
      ...(Array.isArray(raw?.artifact_ids) ? raw.artifact_ids.map((id: unknown) => String(id)) : []),
    ],
  );
  const repaired = repairDeepSeekSchema(raw, candidateById);
  if (raw?.units != null && !Array.isArray(raw.units)) {
    throw new AiCurationError("invalid_schema", "AI 返回结构无效：units 必须是数组。", `unitsType=${typeof raw.units}`, 502);
  }
  if (raw?.aiCuration?.sections != null && !Array.isArray(raw.aiCuration.sections)) {
    throw new AiCurationError("invalid_schema", "AI 返回结构无效：sections 必须是数组。", `sectionsType=${typeof raw.aiCuration.sections}`, 502);
  }
  const artifactIds = repaired.artifactIds;

  if (isDevRuntime()) {
    console.debug("[ai/curation]", {
      candidates: candidates.slice(0, 36).map((artifact) => ({
        id: artifact.id,
        name: artifactNameSafe(artifact),
      })),
      rawArtifactIds,
      filteredArtifactIds: artifactIds,
      source: artifactIds.length >= 3 ? "ai" : "error",
    });
  }

  if (artifactIds.length < 3) {
    throw new AiCurationError(
      "too_few_valid_artifact_ids",
      "AI 返回的有效文物 id 不足。",
      `validArtifactIds=${JSON.stringify(artifactIds)}; rawArtifactIds=${JSON.stringify(raw?.artifactIds ?? null)}`,
      502,
    );
  }

  const coverArtifact = artifactIds.map((id: string) => candidateById.get(id)).find(Boolean);
  return {
    title: String(repaired.title).slice(0, 60),
    intro: String(repaired.intro || "").slice(0, 1800),
    artifactIds,
    coverUrl: String(repaired.coverUrl || coverArtifact?.imageUrl || ""),
    source: "ai",
    aiGenerated: true,
    aiCuration: normalizeAICuration(repaired.aiCuration, artifactIds),
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
    throw new AiCurationError("missing_api_key", "AI 服务未配置 API Key。", "DEEPSEEK_API_KEY is not configured.", 502);
  }
  if (isPlaceholderSecret(token)) {
    throw new AiCurationError("missing_api_key", "AI 服务未配置 API Key。", "DEEPSEEK_API_KEY looks like a placeholder.", 502);
  }

	  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
	  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const profile = buildCurationSearchProfile([userPrompt, guideSummary].filter(Boolean).join("\n"));
  if (isDevRuntime()) {
    console.debug("[curation/profile]", curationProfileLogPayload(profile));
    console.debug("[ai/curation]", {
      candidates: candidates.slice(0, 36).map((artifact) => ({
        id: artifact.id,
        name: artifactNameSafe(artifact),
      })),
      source: "pending",
    });
  }
	  const requestDeepSeek = async (useJsonResponseFormat: boolean, compact = false) => {
	    const controller = new AbortController();
	    const timeout = setTimeout(() => controller.abort(), 30000);
	    try {
	      const body: Record<string, unknown> = {
	        model,
	        messages: buildDeepSeekMessages(userPrompt, candidates, guideSummary, guideAnswers, compact, profile),
	        temperature: 0.7,
	        max_tokens: compact ? 1600 : 4000,
	      };
      if (useJsonResponseFormat) {
        body.response_format = { type: "json_object" };
      }
      return await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } finally {
      clearTimeout(timeout);
    }
	  };

	  const runDeepSeekRequest = async (compact = false) => {
	    let response: globalThis.Response;
	    try {
	      response = await requestDeepSeek(true, compact);
	    } catch (error) {
	      throw normalizeAiCurationError(error);
	    }

	    if (!response.ok) {
	      const message = await response.text();
	      if (isResponseFormatUnsupported(response.status, message)) {
	        if (isDevRuntime()) {
	          console.debug("DeepSeek response_format unsupported, retrying without response_format.", message.slice(0, 300));
	        }
	        try {
	          response = await requestDeepSeek(false, compact);
	        } catch (error) {
	          throw normalizeAiCurationError(error);
	        }
	      } else {
	        throw classifyDeepSeekHttpError(response.status, message);
	      }
	    }

	    if (!response.ok) {
	      const message = await response.text();
	      throw classifyDeepSeekHttpError(response.status, message);
	    }

	    const data = await response.json();
	    const content = data?.choices?.[0]?.message?.content;
	    if (typeof content !== "string" || !content.trim()) {
	      throw new AiCurationError("empty_response", "AI 返回内容为空。", JSON.stringify(data).slice(0, 300), 502);
	    }

	    return normalizeDeepSeekCuration(parseAiJsonResponse(content), candidates);
	  };

	  try {
	    return await runDeepSeekRequest(false);
	  } catch (error) {
	    const aiError = normalizeAiCurationError(error);
	    if (aiError.code === "truncated_json" || aiError.code === "invalid_json") {
	      if (isDevRuntime()) {
	        console.debug("AI JSON parse failed; retrying with compact schema.", {
	          code: aiError.code,
	          detail: aiError.detail,
	        });
	      }
	      try {
	        const compactResult = await runDeepSeekRequest(true);
	        return {
	          ...compactResult,
	          generationNotice: aiError.code === "truncated_json"
	            ? "第一次返回过长，已用精简结构重试成功。"
	            : "第一次返回格式无效，已用精简结构重试成功。",
	        };
	      } catch (retryError) {
	        throw normalizeAiCurationError(retryError);
	      }
	    }
	    throw aiError;
	  }
	}

async function resolveArtifactsSource(source = "auto") {
  await unifiedDbReady;

  if (source === "seed") {
    return { artifacts: SEED_ARTIFACTS, source: "seed" };
  }

  const importedArtifacts = await listArtifactsFromStore(10000);
  if (importedArtifacts.length > 0) {
    return { artifacts: importedArtifacts, source: "imported-artifacts-json" };
  }

  return { artifacts: SEED_ARTIFACTS, source: "seed-fallback" };
}

function filterArtifacts(
  artifacts: Artifact[],
  params: {
    q?: string;
    museum?: string;
    museumId?: string;
    canonicalMuseumName?: string;
    museumProvince?: string;
    museumCity?: string;
    period?: string;
    culture?: string;
    category?: string;
    limit?: number;
  },
) {
  const keyword = params.q?.trim() ?? "";
  const limit = params.limit ?? artifacts.length;

  let subset = artifacts
    .filter((artifact) => {
      const record = artifact as unknown as Record<string, unknown>;
      if (params.museumId && String(record.museumId ?? record.museum_id ?? "") !== params.museumId) return false;
      if (params.canonicalMuseumName) {
        const canonical = String(record.canonicalMuseumName ?? record.canonical_museum_name ?? artifactMuseumRaw(artifact) ?? "");
        if (canonical !== params.canonicalMuseumName) return false;
      }
      if (params.museumProvince && String(record.museumProvince ?? record.museum_province ?? "") !== params.museumProvince) return false;
      if (params.museumCity && String(record.museumCity ?? record.museum_city ?? "") !== params.museumCity) return false;
      if (params.museum && String(artifactMuseumRaw(artifact) ?? "") !== params.museum) return false;
      return true;
    })
    .filter((artifact) => !params.period || String(artifactEraRaw(artifact) ?? "").includes(params.period))
    .filter((artifact) => !params.culture || String(artifactCultureRaw(artifact) ?? "").includes(params.culture))
    .filter((artifact) => !params.category || String(artifactCategoryRaw(artifact) ?? "").includes(params.category));

  if (!keyword) {
    return subset.slice(0, limit);
  }

  return rankArtifactsByKeywordQuery(subset, keyword).slice(0, limit);
}

function isDevRuntime() {
  return process.env.NODE_ENV !== "production";
}

function randomShuffle<T>(items: T[]): T[] {
  return items
    .map((item) => ({ item, random: Math.random() }))
    .sort((left, right) => left.random - right.random)
    .map(({ item }) => item);
}

type CurationIntent = "generate" | "refine" | "unknown";

type CurationSearchProfile = {
  rawPrompt: string;
  normalizedTheme: string;
  intent: CurationIntent;
  coreConcepts: string[];
  searchKeywords: string[];
  strongKeywords: string[];
  weakKeywords: string[];
  preferredCategories: string[];
  preferredDynasties: string[];
  preferredMaterials: string[];
  preferredMuseums: string[];
  perspective: string;
  mood: string[];
  style: string[];
  artifactCount: number;
  unitCount?: number;
  artifactsPerUnitMin?: number;
  artifactsPerUnitMax?: number;
  negativeKeywords: string[];
};

type ThemeExpansionRule = {
  triggers: string[];
  coreConcepts: string[];
  strongKeywords: string[];
  weakKeywords?: string[];
  categories?: string[];
  dynasties?: string[];
  materials?: string[];
  museums?: string[];
  negative?: string[];
  perspective?: string;
  mood?: string[];
  style?: string[];
};

type CurationArtifactScore = {
  score: number;
  hits: number;
  matchedTerms: string[];
  matchedFields: string[];
  strongSignal: boolean;
};

type RankedCurationArtifact = CurationArtifactScore & {
  artifact: Artifact;
  random: number;
};

const CURATION_QUERY_STOP_WORDS = new Set([
  "帮我",
  "请",
  "策划",
  "策展",
  "生成",
  "创建",
  "设计",
  "做",
  "做一个",
  "想做",
  "我想",
  "一个",
  "一场",
  "关于",
  "围绕",
  "相关",
  "主题",
  "展",
  "展览",
  "展陈",
  "文物",
  "展品",
  "藏品",
  "用户",
  "回答",
  "个人",
  "博物馆",
  "请根据",
  "重点",
  "看看",
  "比较",
]);

const CURATION_WEAK_GENERIC_WORDS = new Set([
  "古代",
  "古人",
  "人的",
  "人们",
  "中国",
  "中华",
  "文化",
  "历史",
  "文明",
  "故事",
  "生活",
  "日常",
  "东西",
  "时代",
  "社会",
  "世界",
  "关系",
  "视角",
  "适合",
]);

const CURATION_CORE_PHRASES = [
  "夜生活",
  "夜间生活",
  "灯火",
  "夜宴",
  "夜游",
  "女性主义",
  "女性身体",
  "身体",
  "服饰",
  "身份",
  "青铜礼制",
  "国家权力",
  "王权",
  "礼制",
  "情绪生活",
  "情感史",
  "情感",
  "情绪",
  "孤独",
  "思念",
  "哀悼",
  "欢宴",
  "丝绸之路",
  "东西交流",
  "边疆交流",
  "多民族文化",
  "材料与工艺",
  "技术史",
  "动物神话",
  "宗教信仰",
  "文人文化",
  "江南文人",
  "日常生活",
  "饮食",
  "起居",
];

const CURATION_THEME_EXPANSIONS: ThemeExpansionRule[] = [
  {
    triggers: ["情绪", "情感", "孤独", "思念", "哀悼", "欢宴", "信仰", "自我安慰", "悲欢", "离别", "怀念"],
    coreConcepts: ["情绪生活", "情感史", "生活史"],
    strongKeywords: [
      "孤独",
      "思念",
      "离别",
      "怀古",
      "哀悼",
      "祭祀",
      "信仰",
      "安慰",
      "欢宴",
      "宴饮",
      "书信",
      "诗",
      "诗卷",
      "书法",
      "绘画",
      "图卷",
      "生活图",
      "墓葬",
      "随葬",
      "神兽",
      "净瓶",
      "佛教",
      "祭器",
      "服饰",
      "器具",
    ],
    weakKeywords: ["情绪", "情感", "悲欢", "怀念", "普通人", "文人", "生活"],
    categories: ["书画", "书法", "绘画", "生活用品", "生活用品类", "漆器", "陶瓷", "陶瓷类", "服饰", "纺织品", "丝织品", "佛教造像", "墓葬相关", "文献", "书画/文献"],
    materials: ["纸", "纸本/绢本书画", "纸绢/织物", "锦", "陶瓷", "陶", "瓷", "漆木", "石质"],
    perspective: "情感史 / 生活史",
    mood: ["诗意", "生活化", "温柔"],
    style: ["情感史", "生活史", "审美叙事"],
  },
  {
    triggers: ["夜生活", "夜间", "灯火", "灯", "烛", "夜宴", "夜游", "月夜"],
    coreConcepts: ["夜生活", "灯火", "夜间生活"],
    strongKeywords: ["灯", "宫灯", "铜灯", "烛", "灯火", "夜宴", "宴饮", "饮酒", "酒器", "勘书", "读书", "夜游", "月夜", "赤壁", "乐舞", "生活图", "贵族生活", "画像", "漆盘", "铜壶"],
    weakKeywords: ["夜", "生活", "古代", "日常"],
    categories: ["生活用品类", "生活用品", "铜器", "青铜器", "陶瓷", "陶瓷类", "漆器", "绘画"],
    materials: ["青铜", "铜", "漆木", "陶瓷", "纸本/绢本书画"],
    perspective: "生活史",
    mood: ["诗意", "沉浸", "烟火气"],
    style: ["沉浸叙事", "生活史"],
  },
  {
    triggers: ["女性", "妇女", "身体", "身份", "妆饰", "婚姻", "女性主义", "性别"],
    coreConcepts: ["女性", "身体", "服饰", "身份"],
    strongKeywords: ["女性", "妇女", "仕女", "身体", "服饰", "衣", "袍", "妆饰", "铜镜", "镜", "玉佩", "发簪", "纺织", "丝织", "身份", "女俑"],
    weakKeywords: ["生活", "婚姻", "日常"],
    categories: ["生活用品类", "玉器", "铜器", "青铜器", "陶俑", "丝织品", "书画", "绘画"],
    materials: ["玉", "宝玉石", "锦", "纸绢/织物", "纸本/绢本书画"],
    perspective: "性别视角",
    mood: ["温柔", "生活化"],
    style: ["女性主义", "生活史"],
  },
  {
    triggers: ["礼制", "国家", "王权", "青铜", "宗法", "礼器", "权力"],
    coreConcepts: ["青铜", "礼制", "国家权力"],
    strongKeywords: ["青铜", "礼器", "鼎", "簋", "尊", "盘", "铭文", "祭祀", "王权", "国家", "宗法", "礼制", "商", "周"],
    weakKeywords: ["制度", "政治"],
    categories: ["青铜器", "铜器", "其它金属器"],
    dynasties: ["商", "周", "西周", "东周", "春秋", "战国"],
    materials: ["青铜", "铜"],
    perspective: "礼制与政治",
    mood: ["庄重", "宏大", "权力感"],
    style: ["学术型", "礼制叙事"],
  },
  {
    triggers: ["丝绸之路", "丝路", "交流", "边疆", "多民族", "西域", "胡人", "粟特", "东西交流"],
    coreConcepts: ["丝绸之路", "东西交流", "边疆交流"],
    strongKeywords: ["丝绸之路", "西域", "边疆", "新疆", "交流", "贸易", "胡人", "骆驼", "玻璃", "金银", "佛教", "粟特", "唐", "汉", "织锦"],
    weakKeywords: ["东西", "文化", "多民族"],
    categories: ["杂项", "金银器", "玻璃器", "丝织品", "佛教造像", "壁画", "陶瓷"],
    dynasties: ["汉", "西汉", "东汉", "唐", "唐朝"],
    materials: ["玻璃", "金银", "铜,金", "银", "锦", "纸绢/织物"],
    perspective: "交流史",
    mood: ["开放", "流动"],
    style: ["交流史", "跨文化"],
  },
  {
    triggers: ["文人", "书画", "江南", "雅集", "士人", "山水", "诗", "文房"],
    coreConcepts: ["文人文化", "书画", "雅集"],
    strongKeywords: ["文人", "士人", "书画", "书法", "绘画", "山水", "诗", "文房", "砚", "墨", "笔", "纸", "印", "印章", "画卷", "手卷", "帖", "雅集", "宋", "明", "清"],
    weakKeywords: ["江南", "审美", "雅致"],
    categories: ["书画", "绘画", "书法", "文具", "印信、符牌"],
    dynasties: ["宋", "北宋", "南宋", "明", "清"],
    materials: ["纸", "纸本/绢本书画", "宝玉石", "玉", "石质"],
    perspective: "文人文化",
    mood: ["诗意", "雅致", "静谧"],
    style: ["文人雅集", "审美叙事"],
  },
  {
    triggers: ["日常", "生活", "饮食", "起居", "宴会", "宴饮", "烟火气"],
    coreConcepts: ["日常生活", "饮食", "宴会"],
    strongKeywords: ["饮食", "宴饮", "食器", "酒器", "壶", "盘", "碗", "杯", "炉", "灯", "起居", "娱乐", "陶瓷", "漆器"],
    weakKeywords: ["生活", "日常", "器具", "古代"],
    categories: ["生活用品类", "生活用品", "陶瓷", "陶瓷类", "陶器", "瓷器", "漆器", "铜器"],
    materials: ["陶瓷", "陶", "瓷", "漆木", "青铜", "铜"],
    perspective: "生活史",
    mood: ["生活化", "烟火气", "轻松"],
    style: ["生活史"],
  },
  {
    triggers: ["技术", "工艺", "制造", "匠作", "材料", "铸造", "烧造", "织造"],
    coreConcepts: ["技术", "工艺", "材料"],
    strongKeywords: ["工艺", "铸造", "烧造", "织造", "雕刻", "镶嵌", "错金银", "鎏金", "陶瓷", "青铜", "玉器", "漆器", "纺织", "玻璃", "技术"],
    weakKeywords: ["制造", "文明", "材料"],
    categories: ["青铜器", "铜器", "陶瓷", "陶瓷类", "玉器", "漆器", "丝织品", "杂项"],
    materials: ["青铜", "铜", "陶瓷", "玉", "宝玉石", "漆木", "玻璃", "锦", "金银"],
    perspective: "技术史",
    mood: ["学术", "严谨"],
    style: ["技术史", "学术型"],
  },
  {
    triggers: ["宗教", "信仰", "图像", "佛教", "道教", "祭祀", "神话", "神兽"],
    coreConcepts: ["宗教信仰", "图像", "神话"],
    strongKeywords: ["佛教", "道教", "信仰", "祭祀", "神树", "造像", "经卷", "壁画", "画像", "神兽", "礼仪", "宗教", "神话"],
    weakKeywords: ["神秘", "精神"],
    categories: ["佛教造像", "绘画", "书画", "青铜器", "玉器", "杂项"],
    materials: ["石质", "青铜", "玉", "宝玉石", "纸本/绢本书画"],
    perspective: "宗教与图像",
    mood: ["神秘", "仪式感"],
    style: ["宗教图像"],
  },
  {
    triggers: ["动物", "神兽", "玉龙", "龙", "虎", "鸟", "兽", "亲子", "小朋友", "儿童"],
    coreConcepts: ["动物形象", "神话", "教育友好"],
    strongKeywords: ["动物", "神兽", "玉龙", "龙", "虎", "鸟", "凤", "兽面", "马", "骆驼", "神树", "画像", "图像", "神话"],
    weakKeywords: ["小朋友", "儿童", "亲子", "适合"],
    categories: ["玉器", "青铜器", "铜器", "绘画", "陶俑", "杂项"],
    materials: ["玉", "宝玉石", "青铜", "铜", "陶"],
    perspective: "教育友好",
    mood: ["轻松", "亲子", "神秘"],
    style: ["教育友好", "互动"],
  },
  {
    triggers: ["海洋", "贸易", "外来", "海路", "舶来", "港口"],
    coreConcepts: ["海洋贸易", "外来交流"],
    strongKeywords: ["贸易", "海路", "外来", "玻璃", "金银", "香料", "瓷器", "港口", "交流", "舶来"],
    weakKeywords: ["海洋", "东西"],
    categories: ["陶瓷", "陶瓷类", "瓷器", "玻璃器", "金银器", "杂项"],
    materials: ["玻璃", "金银", "银", "陶瓷", "瓷"],
    perspective: "交流史",
    mood: ["开放", "流动"],
    style: ["交流史"],
  },
];

const CURATION_DYNASTY_ALIASES = [
  { triggers: ["新石器"], values: ["新石器时代"] },
  { triggers: ["商"], values: ["商"] },
  { triggers: ["西周"], values: ["西周"] },
  { triggers: ["东周"], values: ["东周"] },
  { triggers: ["周"], values: ["周", "西周", "东周"] },
  { triggers: ["春秋"], values: ["春秋"] },
  { triggers: ["战国", "戰國"], values: ["战国", "戰國"] },
  { triggers: ["秦"], values: ["秦"] },
  { triggers: ["西汉", "西漢"], values: ["西汉", "西漢"] },
  { triggers: ["东汉"], values: ["东汉"] },
  { triggers: ["汉"], values: ["汉", "西汉", "东汉", "西漢"] },
  { triggers: ["三国"], values: ["三国", "三国吴", "三国（吴）"] },
  { triggers: ["晋"], values: ["西晋", "东晋"] },
  { triggers: ["南北朝", "北朝", "北魏", "北齐"], values: ["南北朝", "北朝", "北魏", "北齐"] },
  { triggers: ["隋"], values: ["隋"] },
  { triggers: ["唐"], values: ["唐", "唐朝", "唐(618~907)"] },
  { triggers: ["五代"], values: ["五代"] },
  { triggers: ["北宋"], values: ["北宋"] },
  { triggers: ["南宋"], values: ["南宋"] },
  { triggers: ["宋"], values: ["宋", "北宋", "南宋"] },
  { triggers: ["辽"], values: ["辽", "辽(907~1125)"] },
  { triggers: ["金代", "金朝"], values: ["金", "金(1115~1234)"] },
  { triggers: ["元"], values: ["元"] },
  { triggers: ["明"], values: ["明", "明(1368~1644)"] },
  { triggers: ["清"], values: ["清", "清(1616~1911)"] },
  { triggers: ["民国", "近现代", "现代"], values: ["中华民国(1912~1949)", "中华人民共和国(1949年10月1日成立)"] },
];

const CURATION_MATERIAL_ALIASES = [
  { triggers: ["青铜"], values: ["青铜"] },
  { triggers: ["铜"], values: ["铜", "青铜", "铜,金"] },
  { triggers: ["陶瓷", "陶器", "瓷器", "陶", "瓷"], values: ["陶瓷", "陶", "瓷"] },
  { triggers: ["玉器", "玉", "玉石"], values: ["玉", "宝玉石"] },
  { triggers: ["漆器", "漆"], values: ["漆木"] },
  { triggers: ["书画", "纸", "绢"], values: ["纸本/绢本书画", "纸绢/织物", "纸"] },
  { triggers: ["纺织", "丝织", "织锦", "锦"], values: ["纸绢/织物", "锦"] },
  { triggers: ["金银", "金", "银"], values: ["金银", "铜,金", "银"] },
  { triggers: ["玻璃"], values: ["玻璃"] },
  { triggers: ["石", "石刻"], values: ["石质", "石"] },
  { triggers: ["骨", "牙", "角器", "骨角"], values: ["骨角牙"] },
];

const CURATION_CATEGORY_ALIASES = [
  { triggers: ["青铜", "铜器", "礼器", "鼎", "簋", "尊"], values: ["青铜器", "铜器", "其它金属器"] },
  { triggers: ["陶瓷", "陶器", "瓷器", "碗", "盘", "壶"], values: ["陶瓷", "陶瓷类", "陶器", "瓷器"] },
  { triggers: ["玉器", "玉佩", "玉龙", "玉"], values: ["玉器"] },
  { triggers: ["漆器", "漆盘"], values: ["漆器", "生活用品类"] },
  { triggers: ["书画", "绘画", "书法", "画卷", "手卷", "帖"], values: ["书画", "绘画", "书法", "书画/文献"] },
  { triggers: ["文房", "砚", "墨", "笔", "印", "印章"], values: ["文具", "印信、符牌", "杂项"] },
  { triggers: ["服饰", "纺织", "丝织", "织锦"], values: ["丝织品", "生活用品类"] },
  { triggers: ["灯", "宴饮", "饮食", "酒器", "起居"], values: ["生活用品类", "生活用品", "陶瓷", "铜器", "漆器"] },
  { triggers: ["佛教", "造像", "壁画", "经卷"], values: ["佛教造像", "绘画", "书画/文献"] },
  { triggers: ["动物", "神兽", "龙", "虎", "鸟"], values: ["玉器", "青铜器", "铜器", "绘画", "陶俑"] },
];

const CURATION_MUSEUM_ALIASES = [
  "故宫博物院",
  "故宫",
  "中国国家博物馆",
  "国博",
  "南京博物院",
  "湖北省博物馆",
  "湖南省博物馆",
  "湖南博物院",
  "上海博物馆",
  "陕西历史博物馆",
  "辽宁省博物馆",
  "三星堆博物馆",
  "广汉三星堆博物馆",
  "云南省博物馆",
  "河南博物院",
  "首都博物馆",
  "浙江省博物馆",
  "苏州博物馆",
  "甘肃省博物馆",
  "新疆维吾尔自治区博物馆",
  "新疆维吾尔自治区文物考古研究所",
];

const CURATION_PERSPECTIVE_SUPPLEMENTS: Record<string, { keywords: string[]; categories: string[]; materials: string[]; dynasties: string[] }> = {
  "情感史 / 生活史": {
    keywords: ["孤独", "思念", "离别", "怀古", "哀悼", "祭祀", "信仰", "安慰", "欢宴", "宴饮", "书信", "诗", "诗卷", "书法", "绘画", "图卷", "生活图", "墓葬", "随葬", "神兽", "净瓶", "佛教", "祭器", "服饰", "器具"],
    categories: ["书画", "书法", "绘画", "书画/文献", "生活用品", "生活用品类", "漆器", "陶瓷", "陶瓷类", "丝织品", "佛教造像", "杂项"],
    materials: ["纸", "纸本/绢本书画", "纸绢/织物", "锦", "陶瓷", "陶", "瓷", "漆木", "石质"],
    dynasties: [],
  },
  性别视角: {
    keywords: ["女性", "仕女", "女", "镜", "妆", "衣", "纺织", "玉佩"],
    categories: ["生活用品类", "玉器", "铜器", "丝织品", "绘画", "陶俑"],
    materials: ["玉", "宝玉石", "铜", "纸绢/织物", "锦"],
    dynasties: [],
  },
  生活史: {
    keywords: ["饮食", "宴饮", "壶", "盘", "碗", "杯", "灯", "炉", "漆", "生活图"],
    categories: ["生活用品类", "生活用品", "陶瓷", "陶瓷类", "漆器", "铜器"],
    materials: ["陶瓷", "陶", "瓷", "漆木", "青铜", "铜"],
    dynasties: [],
  },
  技术史: {
    keywords: ["工艺", "铸造", "烧造", "雕刻", "镶嵌", "错金银", "鎏金"],
    categories: ["青铜器", "铜器", "玉器", "陶瓷", "陶瓷类", "漆器", "丝织品", "杂项"],
    materials: ["青铜", "铜", "陶瓷", "玉", "宝玉石", "玻璃", "金银", "锦"],
    dynasties: [],
  },
  礼制与政治: {
    keywords: ["鼎", "簋", "尊", "盘", "铭文", "祭祀", "王权"],
    categories: ["青铜器", "铜器", "玉器"],
    materials: ["青铜", "铜", "玉"],
    dynasties: ["商", "周", "西周", "春秋", "战国"],
  },
  交流史: {
    keywords: ["西域", "胡人", "骆驼", "玻璃", "金银", "佛教", "织锦"],
    categories: ["杂项", "金银器", "玻璃器", "丝织品", "佛教造像", "陶瓷"],
    materials: ["玻璃", "金银", "铜,金", "银", "锦"],
    dynasties: ["汉", "唐", "唐朝", "西汉"],
  },
  宗教与图像: {
    keywords: ["佛教", "造像", "经卷", "壁画", "画像", "神兽", "神树"],
    categories: ["佛教造像", "绘画", "书画", "青铜器", "玉器"],
    materials: ["石质", "青铜", "玉", "纸本/绢本书画"],
    dynasties: [],
  },
  文人文化: {
    keywords: ["书画", "书法", "绘画", "山水", "文房", "砚", "墨", "印章"],
    categories: ["书画", "绘画", "书法", "书画/文献", "文具", "印信、符牌"],
    materials: ["纸", "纸本/绢本书画", "宝玉石", "石质"],
    dynasties: ["宋", "北宋", "南宋", "明", "清"],
  },
  教育友好: {
    keywords: ["动物", "神兽", "龙", "虎", "鸟", "马", "骆驼", "神话"],
    categories: ["玉器", "青铜器", "铜器", "绘画", "陶俑", "杂项"],
    materials: ["玉", "宝玉石", "青铜", "铜", "陶"],
    dynasties: [],
  },
};

const CURATION_NEGATION_CUES = ["不要只讲", "不以", "不要", "不想", "不是", "避免", "少讲", "不只讲", "别只讲"];

const CURATION_NEGATIVE_KEYWORD_EXPANSIONS: Record<string, string[]> = {
  宏大: ["宏大", "国家权力"],
  王朝: ["王朝", "国家权力"],
  礼制: ["礼制", "国家权力"],
  国家: ["国家", "国家权力"],
  国家权力: ["国家权力", "国家"],
  王权: ["王权", "国家权力"],
  青铜: ["青铜", "鼎", "簋", "尊", "盘"],
  礼器: ["礼器", "鼎", "簋", "尊", "盘"],
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function cleanCurationPrompt(query: string) {
  return query
    .replace(/用户的策展问题回答|请优先围绕这些回答确定展览主题|展品选择|叙事线索|知识重点|情感落点/g, " ")
    .replace(/做一个|我想|想做|帮我|生成|创建|设计|策划|策展|关于|相关|主题|展览|展陈|一场|一个|重点看|重点|比较|看的|看/g, " ")
    .replace(/[“”"'\n\r,，。.!！?？:：；;()[\]{}]/g, " ")
    .replace(/展(?=$|\s)/g, " ")
    .replace(/[的和与及、]+\s*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isKeywordNoise(keyword: string) {
  const normalized = keyword.trim();
  return !normalized || CURATION_QUERY_STOP_WORDS.has(normalized);
}

function isWeakGenericKeyword(keyword: string) {
  const normalized = keyword.trim();
  return CURATION_WEAK_GENERIC_WORDS.has(normalized);
}

function curationSearchTokens(query: string): string[] {
  const cleaned = cleanCurationPrompt(query);
  return cleaned
    .split(/\s+|以及|或者|并且|还有|中的|里的|的|和|与|及|、|：/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !isKeywordNoise(token))
    .slice(0, 32);
}

function isTermNegated(prompt: string, term: string) {
  if (!term) return false;
  let index = prompt.indexOf(term);
  while (index >= 0) {
    const before = prompt.slice(Math.max(0, index - 12), index);
    const after = prompt.slice(index + term.length, Math.min(prompt.length, index + term.length + 6));
    if (CURATION_NEGATION_CUES.some((cue) => before.includes(cue))) return true;
    if (/为主/.test(after) && /不以/.test(before)) return true;
    index = prompt.indexOf(term, index + term.length);
  }
  return false;
}

function hasNonNegatedTerm(prompt: string, terms: string[]) {
  return terms.some((term) => prompt.includes(term) && !isTermNegated(prompt, term));
}

function extractNegatedSegments(prompt: string) {
  const segments: string[] = [];
  for (const cue of CURATION_NEGATION_CUES) {
    let index = prompt.indexOf(cue);
    while (index >= 0) {
      const start = index + cue.length;
      const endCandidates = ["。", "，", "\n", "；", ";", "！", "？"]
        .map((mark) => prompt.indexOf(mark, start))
        .filter((position) => position >= 0);
      const end = endCandidates.length ? Math.min(...endCandidates) : Math.min(prompt.length, start + 28);
      segments.push(prompt.slice(index, end));
      index = prompt.indexOf(cue, index + cue.length);
    }
  }
  return uniqueStrings(segments);
}

function extractNegativeKeywords(prompt: string) {
  const segments = extractNegatedSegments(prompt);
  const directKeywords = Object.keys(CURATION_NEGATIVE_KEYWORD_EXPANSIONS).filter((keyword) =>
    segments.some((segment) => segment.includes(keyword)) || isTermNegated(prompt, keyword),
  );
  const tokenKeywords = segments.flatMap((segment) =>
    curationSearchTokens(segment)
      .filter((token) => !CURATION_NEGATION_CUES.some((cue) => token.includes(cue)))
      .filter((token) => !isKeywordNoise(token) && !isWeakGenericKeyword(token)),
  );
  return uniqueStrings([
    ...directKeywords,
    ...directKeywords.flatMap((keyword) => CURATION_NEGATIVE_KEYWORD_EXPANSIONS[keyword] || []),
    ...tokenKeywords,
  ]).slice(0, 40);
}

function detectCurationIntent(prompt: string): CurationIntent {
  const hasGenerateVerb = /生成|创建|设计|策划|策展|做一个|来一个|展览|展/.test(prompt);
  const hasRefineVerb = /改成|修改|调整|优化|重写|替换|更适合|更学术|更轻松|减少|增加|换成/.test(prompt);
  if (hasRefineVerb && !hasGenerateVerb) return "refine";
  if (hasGenerateVerb) return "generate";
  return "unknown";
}

function parseChineseNumber(value: string) {
  const digit = Number(value);
  if (Number.isFinite(digit)) return digit;
  const digits: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  if (value === "十") return 10;
  if (value.startsWith("十")) return 10 + (digits[value.slice(1)] || 0);
  if (value.endsWith("十")) return (digits[value.slice(0, 1)] || 1) * 10;
  if (value.includes("十")) {
    const [tens, ones] = value.split("十");
    return (digits[tens] || 1) * 10 + (digits[ones] || 0);
  }
  return digits[value] || NaN;
}

function clampArtifactCount(value: number) {
  if (!Number.isFinite(value)) return 6;
  return Math.min(10, Math.max(3, value));
}

function parseCurationCountProfile(prompt: string) {
  const numberPattern = "(\\d{1,2}|[一二两三四五六七八九十]{1,3})";
  const parseRange = (leftRaw: string, rightRaw: string) => {
    const left = parseChineseNumber(leftRaw);
    const right = parseChineseNumber(rightRaw);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return undefined;
    return { min: Math.min(left, right), max: Math.max(left, right) };
  };

  const unitMatch = prompt.match(new RegExp(`${numberPattern}\\s*个?\\s*单元`));
  const perUnitRangeMatch = prompt.match(new RegExp(`每个单元\\s*${numberPattern}\\s*(?:到|至|-|~)\\s*${numberPattern}\\s*(?:件文物|件展品|文物|展品|件)`));
  const totalRangeMatch = prompt.match(new RegExp(`(?:总共|总计|一共|共)\\s*${numberPattern}\\s*(?:到|至|-|~)\\s*${numberPattern}\\s*(?:件文物|件展品|文物|展品|件)`));
  const totalSingleMatch = prompt.match(new RegExp(`(?:总共|总计|一共|共)\\s*${numberPattern}\\s*(?:件文物|件展品|文物|展品|件)`));
  const explicitArtifactMatch = Array.from(
    prompt.matchAll(new RegExp(`${numberPattern}\\s*(件文物|个文物|件展品|个展品|文物|展品|件)`, "g")),
  ).find((match) => !/(单元|每个单元|总共|总计|一共|共)\s*$/.test(prompt.slice(Math.max(0, match.index! - 8), match.index)));

  let artifactCount = 6;
  if (totalRangeMatch) {
    const range = parseRange(totalRangeMatch[1], totalRangeMatch[2]);
    if (range) artifactCount = range.max;
  } else if (totalSingleMatch) {
    artifactCount = parseChineseNumber(totalSingleMatch[1]);
  } else if (explicitArtifactMatch) {
    artifactCount = parseChineseNumber(explicitArtifactMatch[1]);
  }

  const perUnitRange = perUnitRangeMatch ? parseRange(perUnitRangeMatch[1], perUnitRangeMatch[2]) : undefined;

  return {
    artifactCount: clampArtifactCount(artifactCount),
    unitCount: unitMatch ? parseChineseNumber(unitMatch[1]) : undefined,
    artifactsPerUnitMin: perUnitRange?.min,
    artifactsPerUnitMax: perUnitRange?.max,
  };
}

function collectAliasValues(prompt: string, aliases: Array<{ triggers: string[]; values: string[] }>) {
  return uniqueStrings(
    aliases.flatMap((alias) => (alias.triggers.some((trigger) => prompt.includes(trigger) && !isTermNegated(prompt, trigger)) ? alias.values : [])),
  );
}

function collectMuseums(prompt: string) {
  const matched = CURATION_MUSEUM_ALIASES.filter((museum) => prompt.includes(museum));
  return uniqueStrings(
    matched.flatMap((museum) => {
      if (museum === "故宫") return ["故宫博物院"];
      if (museum === "国博") return ["中国国家博物馆"];
      if (museum === "三星堆博物馆") return ["广汉三星堆博物馆"];
      return [museum];
    }),
  );
}

function detectPerspective(prompt: string, matchedRules: ThemeExpansionRule[]) {
  if (/儿童|亲子|小朋友|孩子|青少年/.test(prompt)) return "教育友好";
  if (/女性主义|性别|女性|妇女/.test(prompt)) return "性别视角";
  if (hasNonNegatedTerm(prompt, ["情绪", "情感", "孤独", "思念", "哀悼", "欢宴", "信仰", "自我安慰", "悲欢", "离别", "怀念"])) return "情感史 / 生活史";
  if (hasNonNegatedTerm(prompt, ["日常", "生活", "饮食", "起居", "宴饮", "夜生活", "灯火"])) return "生活史";
  if (hasNonNegatedTerm(prompt, ["技术", "工艺", "制造", "材料", "铸造", "烧造", "织造"])) return "技术史";
  if (hasNonNegatedTerm(prompt, ["礼制", "国家", "王权", "宗法", "权力", "青铜", "礼器"])) return "礼制与政治";
  if (hasNonNegatedTerm(prompt, ["丝路", "丝绸之路", "交流", "边疆", "多民族", "西域", "胡人", "粟特"])) return "交流史";
  if (hasNonNegatedTerm(prompt, ["宗教", "信仰", "神话", "佛教", "道教", "神兽", "图像", "祭祀"])) return "宗教与图像";
  if (hasNonNegatedTerm(prompt, ["文人", "书画", "山水", "雅集", "江南", "士人"])) return "文人文化";
  if (/沉浸|体验|故事|叙事/.test(prompt)) return "沉浸叙事";
  if (/学术|严肃|专业|研究/.test(prompt)) return "学术型";
  return matchedRules.find((rule) => rule.perspective)?.perspective || "综合策展";
}

function detectMoodAndStyle(prompt: string, matchedRules: ThemeExpansionRule[], perspective: string) {
  const mood: string[] = [];
  const style: string[] = [];
  const add = (condition: boolean, moods: string[], styles: string[] = []) => {
    if (!condition) return;
    mood.push(...moods);
    style.push(...styles);
  };

  add(/诗意|雅致|温柔|静谧|江南|文人/.test(prompt), ["诗意", "雅致", "静谧"], ["审美叙事"]);
  add(hasNonNegatedTerm(prompt, ["庄重", "宏大", "权力感", "国家", "王权", "礼制"]), ["庄重", "宏大", "权力感"], ["礼制叙事"]);
  add(hasNonNegatedTerm(prompt, ["神秘", "宗教", "仪式感", "信仰", "神话"]), ["神秘", "仪式感"], ["宗教图像"]);
  add(/轻松|亲子|互动|小朋友|儿童|孩子/.test(prompt), ["轻松", "亲子", "互动"], ["教育友好"]);
  add(/学术|严谨|专业|研究/.test(prompt), ["学术", "严谨", "专业"], ["学术型"]);
  add(/生活化|烟火气|日常|饮食|起居/.test(prompt), ["生活化", "烟火气"], ["生活史"]);
  add(/沉浸|体验|故事|叙事/.test(prompt), ["沉浸"], ["沉浸叙事"]);

  mood.push(...matchedRules.flatMap((rule) => rule.mood || []));
  style.push(...matchedRules.flatMap((rule) => rule.style || []));
  if (perspective && perspective !== "综合策展") style.push(perspective);

  return {
    mood: uniqueStrings(mood).slice(0, 10),
    style: uniqueStrings(style).slice(0, 10),
  };
}

function isUsefulCoreConceptToken(token: string) {
  if (isWeakGenericKeyword(token)) return false;
  if (/视角|适合|小朋友|儿童|亲子|比较|学术|专业|严谨|重点|古代人|用户|回答/.test(token)) return false;
  return token.length <= 10;
}

function buildCurationSearchProfile(userPrompt: string): CurationSearchProfile {
  const rawPrompt = userPrompt.trim();
  const normalizedTheme = cleanCurationPrompt(rawPrompt) || "个人策展";
  const promptText = `${rawPrompt} ${normalizedTheme}`;
  const baseTokens = curationSearchTokens(rawPrompt);
  const negativeKeywords = extractNegativeKeywords(rawPrompt);
  const isNegativeKeyword = (keyword: string) =>
    negativeKeywords.some((negative) => keyword.includes(negative) || negative.includes(keyword));
  const matchedRules = CURATION_THEME_EXPANSIONS.filter((rule) =>
    rule.triggers.some((trigger) => promptText.includes(trigger) && !isTermNegated(rawPrompt, trigger)),
  );
  const preferredDynasties = uniqueStrings([
    ...collectAliasValues(promptText, CURATION_DYNASTY_ALIASES),
    ...matchedRules.flatMap((rule) => rule.dynasties || []),
  ]).filter((keyword) => !isNegativeKeyword(keyword)).slice(0, 20);
  const preferredMaterials = uniqueStrings([
    ...collectAliasValues(promptText, CURATION_MATERIAL_ALIASES),
    ...matchedRules.flatMap((rule) => rule.materials || []),
  ]).filter((keyword) => !isNegativeKeyword(keyword)).slice(0, 24);
  const preferredCategories = uniqueStrings([
    ...collectAliasValues(promptText, CURATION_CATEGORY_ALIASES),
    ...matchedRules.flatMap((rule) => rule.categories || []),
  ]).filter((keyword) => !isNegativeKeyword(keyword)).slice(0, 28);
  const preferredMuseums = collectMuseums(promptText).slice(0, 12);
  const perspective = detectPerspective(promptText, matchedRules);
  const { mood, style } = detectMoodAndStyle(promptText, matchedRules, perspective);
  const isEmotionLifePerspective = perspective === "情感史 / 生活史";
  const explicitlyWantsBronzeRitual = hasNonNegatedTerm(rawPrompt, ["青铜", "礼制", "礼器"]);
  const shouldDownrankBronzeRitual = isEmotionLifePerspective && !explicitlyWantsBronzeRitual;
  const bronzeRitualCategories = new Set(["青铜器", "铜器", "其它金属器"]);
  const bronzeRitualMaterials = new Set(["青铜", "铜", "铜,金"]);
  const filteredPreferredCategories = shouldDownrankBronzeRitual
    ? preferredCategories.filter((category) => !bronzeRitualCategories.has(category))
    : preferredCategories;
  const filteredPreferredMaterials = shouldDownrankBronzeRitual
    ? preferredMaterials.filter((material) => !bronzeRitualMaterials.has(material))
    : preferredMaterials;
  const coreConcepts = uniqueStrings([
    ...CURATION_CORE_PHRASES.filter((phrase) => promptText.includes(phrase) && !isTermNegated(rawPrompt, phrase)),
    ...matchedRules.flatMap((rule) => rule.coreConcepts),
    ...baseTokens.filter((token) => isUsefulCoreConceptToken(token) && !isTermNegated(rawPrompt, token)),
  ]).filter((keyword) => !isNegativeKeyword(keyword)).slice(0, 12);
  const candidateStrongKeywords = uniqueStrings([
    ...coreConcepts,
    ...matchedRules.flatMap((rule) => rule.strongKeywords),
  ]);
  const strongKeywords = candidateStrongKeywords
    .filter((keyword) => !isKeywordNoise(keyword) && !isWeakGenericKeyword(keyword) && !isNegativeKeyword(keyword))
    .slice(0, 80);
  const downgradedStrongKeywords = candidateStrongKeywords.filter((keyword) => isWeakGenericKeyword(keyword));
  const weakKeywords = uniqueStrings([
    ...matchedRules.flatMap((rule) => rule.weakKeywords || []),
    ...downgradedStrongKeywords,
    ...baseTokens.filter((token) => !strongKeywords.includes(token) && !isTermNegated(rawPrompt, token)),
  ])
    .filter((keyword) => !isKeywordNoise(keyword) && !isNegativeKeyword(keyword))
    .slice(0, 48);
  const countProfile = parseCurationCountProfile(rawPrompt);

  return {
    rawPrompt,
    normalizedTheme,
    intent: detectCurationIntent(rawPrompt),
    coreConcepts,
    searchKeywords: uniqueStrings([
      ...strongKeywords,
      ...weakKeywords,
      ...filteredPreferredCategories,
      ...filteredPreferredMaterials,
      ...preferredDynasties,
      ...preferredMuseums,
    ]).slice(0, 120),
    strongKeywords,
    weakKeywords,
    preferredCategories: filteredPreferredCategories,
    preferredDynasties,
    preferredMaterials: filteredPreferredMaterials,
    preferredMuseums,
    perspective,
    mood,
    style,
    artifactCount: countProfile.artifactCount,
    unitCount: countProfile.unitCount,
    artifactsPerUnitMin: countProfile.artifactsPerUnitMin,
    artifactsPerUnitMax: countProfile.artifactsPerUnitMax,
    negativeKeywords: uniqueStrings([...negativeKeywords, ...matchedRules.flatMap((rule) => rule.negative || [])]),
  };
}

function curationArtifactText(artifact: Artifact): string {
  return [
    artifactNameRaw(artifact),
    artifactMuseumRaw(artifact),
    artifactEraRaw(artifact),
    artifactMaterialRaw(artifact),
    artifactCultureRaw(artifact),
    artifactCategoryRaw(artifact),
    artifactDescriptionRaw(artifact),
    ...(artifact.tags ?? []).map((tag) => (typeof tag === "string" ? tag : [tag.type, tag.name].filter(Boolean).join(" "))),
  ]
    .map((value) => String(value ?? "").toLowerCase())
	    .join(" ");
}

function includesAny(text: string, keywords: string[]) {
  return uniqueStrings(keywords.map((keyword) => keyword.toLowerCase())).filter((keyword) => keyword && text.includes(keyword));
}

function scoreCurationArtifact(artifact: Artifact, profile: CurationSearchProfile) {
  const name = String(artifactNameRaw(artifact) ?? "").toLowerCase();
  const category = String(artifactCategoryRaw(artifact) ?? "").toLowerCase();
  const dynasty = String(artifactEraRaw(artifact) ?? "").toLowerCase();
  const museum = String(artifactMuseumRaw(artifact) ?? "").toLowerCase();
  const location = String(artifactOriginRaw(artifact) ?? "").toLowerCase();
  const tags = (artifact.tags ?? []).map((tag) => (typeof tag === "string" ? tag : [tag.type, tag.name].filter(Boolean).join(" "))).join(" ").toLowerCase();
  const description = String(artifactDescriptionRaw(artifact) ?? "").toLowerCase();
  const material = String(artifactMaterialRaw(artifact) ?? "").toLowerCase();
  const allText = curationArtifactText(artifact);
  let score = 0;
  let hits = 0;
  let strongSignal = false;
  const matchedTerms = new Set<string>();
  const matchedFields = new Set<string>();
  const strongKeywords = profile.strongKeywords.map((keyword) => keyword.toLowerCase());
  const weakKeywords = profile.weakKeywords.map((keyword) => keyword.toLowerCase()).filter((keyword) => !isWeakGenericKeyword(keyword) || keyword.length >= 2);
  const categories = profile.preferredCategories.map((keyword) => keyword.toLowerCase());
  const dynasties = profile.preferredDynasties.map((keyword) => keyword.toLowerCase());
  const materials = profile.preferredMaterials.map((keyword) => keyword.toLowerCase());
  const museums = profile.preferredMuseums.map((keyword) => keyword.toLowerCase());
  const negativeKeywords = profile.negativeKeywords.map((keyword) => keyword.toLowerCase());

  const addScore = (fieldName: string, fieldText: string, fieldKeywords: string[], weight: number, primarySignal = false) => {
    const matched = includesAny(fieldText, fieldKeywords);
    if (matched.length === 0) return;
    score += matched.length * weight;
    hits += matched.length;
    matched.forEach((keyword) => matchedTerms.add(keyword));
    matchedFields.add(fieldName);
    if (primarySignal) strongSignal = true;
  };

  const negativeMatches = includesAny(allText, negativeKeywords);
  if (negativeMatches.length > 0) {
    score -= 20 * negativeMatches.length;
    negativeMatches.forEach((keyword) => matchedTerms.add(`-${keyword}`));
    matchedFields.add("negative");
  }

  if (profile.perspective === "情感史 / 生活史" && !hasNonNegatedTerm(profile.rawPrompt, ["青铜", "礼制", "礼器"])) {
    const bronzeRitualMatches = includesAny(`${name} ${category} ${material} ${tags}`, [
      "青铜器",
      "青铜",
      "铜器",
      "鼎",
      "簋",
      "尊",
      "礼器",
    ]);
    if (bronzeRitualMatches.length > 0) {
      score -= 18 + bronzeRitualMatches.length * 8;
      bronzeRitualMatches.slice(0, 4).forEach((keyword) => matchedTerms.add(`-${keyword}`));
      matchedFields.add("emotionBronzeDownrank");
    }
  }

  addScore("name", name, strongKeywords, 12, true);
  addScore("tags", tags, strongKeywords, 10, true);
  addScore("description", description, strongKeywords, 4, true);
  addScore("category", category, categories, 8, true);
  addScore("tags", tags, categories, 8, true);
  addScore("material", material, materials, 6, true);
  addScore("category", category, materials, 4, true);
  addScore("dynasty", dynasty, dynasties, 5, true);
  addScore("museum", museum, museums, 5, true);
  addScore("location", location, museums, 5, true);

  const weakMatches = includesAny(allText, weakKeywords);
  if (weakMatches.length > 0) {
    score += 1;
    hits += weakMatches.length;
    weakMatches.slice(0, 6).forEach((keyword) => matchedTerms.add(keyword));
    matchedFields.add("weak");
  }

  return {
    score,
    hits,
    matchedTerms: Array.from(matchedTerms).slice(0, 16),
    matchedFields: Array.from(matchedFields).slice(0, 12),
    strongSignal,
  };
}

function artifactMatchesProfileHints(
  artifact: Artifact,
  hints: { keywords?: string[]; categories?: string[]; materials?: string[]; dynasties?: string[]; museums?: string[] },
) {
  const name = String(artifactNameRaw(artifact) ?? "").toLowerCase();
  const category = String(artifactCategoryRaw(artifact) ?? "").toLowerCase();
  const dynasty = String(artifactEraRaw(artifact) ?? "").toLowerCase();
  const museum = String(artifactMuseumRaw(artifact) ?? "").toLowerCase();
  const location = String(artifactOriginRaw(artifact) ?? "").toLowerCase();
  const tags = (artifact.tags ?? []).map((tag) => (typeof tag === "string" ? tag : [tag.type, tag.name].filter(Boolean).join(" "))).join(" ").toLowerCase();
  const material = String(artifactMaterialRaw(artifact) ?? "").toLowerCase();
  const description = String(artifactDescriptionRaw(artifact) ?? "").toLowerCase();
  const matchedTerms = [
    ...includesAny(`${name} ${tags} ${description}`, hints.keywords || []),
    ...includesAny(category, hints.categories || []),
    ...includesAny(material, hints.materials || []),
    ...includesAny(dynasty, hints.dynasties || []),
    ...includesAny(`${museum} ${location}`, hints.museums || []),
  ];
  return uniqueStrings(matchedTerms);
}

function supplementRankItem(
  artifact: Artifact,
  score: number,
  matchedTerms: string[],
  matchedFields: string[],
): RankedCurationArtifact {
  return {
    artifact,
    score,
    hits: matchedTerms.length,
    matchedTerms,
    matchedFields,
    strongSignal: false,
    random: Math.random(),
  };
}

function rankArtifactsForCurationSearch(artifacts: Artifact[], query: string, limit: number) {
  const profile = buildCurationSearchProfile(query);
  const scored = artifacts
    .map((artifact) => {
      const result = scoreCurationArtifact(artifact, profile);
      return { artifact, ...result, random: Math.random() };
    })
    .sort((left, right) => {
      const scoreDiff = right.score - left.score;
      if (Math.abs(scoreDiff) > 0.75) return scoreDiff;
      const hitDiff = right.hits - left.hits;
      if (hitDiff !== 0) return hitDiff;
      return left.random - right.random;
    });

  const selected: RankedCurationArtifact[] = scored.filter((item) => item.score > 0 && item.strongSignal).slice(0, limit);
  const selectedIds = new Set(selected.map((item) => item.artifact.id));
  const appendUnique = (items: RankedCurationArtifact[]) => {
    for (const item of items) {
      if (selected.length >= limit) break;
      if (selectedIds.has(item.artifact.id)) continue;
      selectedIds.add(item.artifact.id);
      selected.push(item);
    }
  };

  if (selected.length < limit) {
    const perspectiveHints = CURATION_PERSPECTIVE_SUPPLEMENTS[profile.perspective];
    if (perspectiveHints) {
      appendUnique(
        randomShuffle(artifacts.filter((artifact) => !selectedIds.has(artifact.id)))
          .map((artifact) => {
            const matchedTerms = artifactMatchesProfileHints(artifact, perspectiveHints);
            return matchedTerms.length > 0
              ? supplementRankItem(artifact, 0.6 + Math.min(1.8, matchedTerms.length * 0.2), matchedTerms, ["perspectiveSupplement"])
              : null;
          })
          .filter((item): item is RankedCurationArtifact => Boolean(item))
          .sort((left, right) => right.score - left.score || left.random - right.random),
      );
    }
  }

  if (selected.length < limit) {
    appendUnique(
      randomShuffle(artifacts.filter((artifact) => !selectedIds.has(artifact.id)))
        .map((artifact) => {
          const matchedTerms = artifactMatchesProfileHints(artifact, {
            materials: profile.preferredMaterials,
            dynasties: profile.preferredDynasties,
            categories: profile.preferredCategories,
            museums: profile.preferredMuseums,
          });
          return matchedTerms.length > 0
            ? supplementRankItem(artifact, 0.4 + Math.min(1.2, matchedTerms.length * 0.15), matchedTerms, ["structuredSupplement"])
            : null;
        })
        .filter((item): item is RankedCurationArtifact => Boolean(item))
        .sort((left, right) => right.score - left.score || left.random - right.random),
    );
  }

  if (selected.length < limit) {
    appendUnique(scored.filter((item) => item.score > 0 && !item.strongSignal));
  }

  if (selected.length < limit) {
    appendUnique(
      randomShuffle(artifacts.filter((artifact) => !selectedIds.has(artifact.id)))
        .slice(0, limit - selected.length)
        .map((artifact) => supplementRankItem(artifact, 0, [], ["randomSupplement"])),
    );
  }

  return { profile, ranked: selected };
}

function curationProfileLogPayload(profile: CurationSearchProfile) {
  return {
    rawPrompt: profile.rawPrompt,
    normalizedTheme: profile.normalizedTheme,
    intent: profile.intent,
    coreConcepts: profile.coreConcepts,
    strongKeywords: profile.strongKeywords,
    weakKeywords: profile.weakKeywords,
    preferredCategories: profile.preferredCategories,
    preferredMaterials: profile.preferredMaterials,
    preferredDynasties: profile.preferredDynasties,
    preferredMuseums: profile.preferredMuseums,
    perspective: profile.perspective,
    mood: profile.mood,
    style: profile.style,
    artifactCount: profile.artifactCount,
    unitCount: profile.unitCount,
    artifactsPerUnitMin: profile.artifactsPerUnitMin,
    artifactsPerUnitMax: profile.artifactsPerUnitMax,
    negativeKeywords: profile.negativeKeywords,
  };
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

function artifactImagePublicPathExists(value: unknown) {
  const url = typeof value === "string" ? value.trim() : "";
  if (!url || !url.startsWith("/artifact-images/")) return null;

  const relativePath = decodeURIComponent(url.split("?")[0]!.replace(/^\/artifact-images\//, ""));
  const physicalPath = path.resolve(ARTIFACT_IMAGE_PUBLIC_DIR, relativePath);
  if (!physicalPath.startsWith(ARTIFACT_IMAGE_PUBLIC_DIR + path.sep)) return null;

  return fs.existsSync(physicalPath);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  if (isDevRuntime()) {
    console.log("DeepSeek curation config:", deepSeekConfigStatus());
  }

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

  app.get("/api/admin/artifact-image-file-status", requireAdmin, async (_req, res) => {
    try {
      const { artifacts } = await resolveArtifactsSource("auto");
      const statuses = artifacts.map((artifact) => {
        const record = artifact as Record<string, unknown>;
        const localImageUrl = stringValue(record.localImageUrl) || stringValue(record.local_image_url);
        const localThumbnailUrl = stringValue(record.localThumbnailUrl) || stringValue(record.local_thumbnail_url);

        return {
          artifactId: stringValue(record.id),
          localImageUrl,
          localThumbnailUrl,
          localImageExists: artifactImagePublicPathExists(localImageUrl),
          localThumbnailExists: artifactImagePublicPathExists(localThumbnailUrl),
        };
      });

      res.json({ statuses });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/artifacts", requireAdmin, createArtifact);
  app.post("/api/admin/artifacts/:id/image", requireAdmin, uploadArtifactImageFile, uploadArtifactImage);
  app.post("/api/admin/artifacts/:id/image-url", requireAdmin, uploadArtifactImageFromUrl);
  app.patch("/api/admin/artifacts/:id/editor-recommendation", requireAdmin, updateArtifactEditorRecommendation);
  app.put("/api/artifacts/:id", requireAdmin, updateArtifact);
  app.delete("/api/artifacts/:id", requireAdmin, deleteArtifact);
  app.use(museumRoutes);

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
        source: typeof req.body?.source === "string" ? req.body.source : undefined,
        aiGenerated: typeof req.body?.aiGenerated === "boolean" ? req.body.aiGenerated : undefined,
        generationNotice: typeof req.body?.generationNotice === "string" ? req.body.generationNotice : undefined,
        generationError: typeof req.body?.generationError === "string" ? req.body.generationError : undefined,
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

  app.post("/api/exhibition-covers/upload", authMiddleware, uploadExhibitionCoverFile, uploadExhibitionCover);

  app.get("/api/artifacts", async (req, res) => {
    try {
      const source = getSingleQueryParam(req.query.source as string | string[] | undefined) || "auto";
      const limitValue = Number(getSingleQueryParam(req.query.limit as string | string[] | undefined) || "5000");
      const { artifacts, source: resolvedSource } = await resolveArtifactsSource(source);
      const filteredArtifacts = filterArtifacts(artifacts, {
        q: getSingleQueryParam(req.query.q as string | string[] | undefined),
        museum: getSingleQueryParam(req.query.museum as string | string[] | undefined),
        museumId: getSingleQueryParam(req.query.museumId as string | string[] | undefined),
        canonicalMuseumName: getSingleQueryParam(req.query.canonicalMuseumName as string | string[] | undefined),
        museumProvince: getSingleQueryParam(req.query.museumProvince as string | string[] | undefined),
        museumCity: getSingleQueryParam(req.query.museumCity as string | string[] | undefined),
        period: getSingleQueryParam(req.query.period as string | string[] | undefined),
        culture: getSingleQueryParam(req.query.culture as string | string[] | undefined),
        category: getSingleQueryParam(req.query.category as string | string[] | undefined),
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
        const storeArtifact = await getArtifactFromStore(id);
        if (storeArtifact) {
          return res.json({
            source: "imported-artifacts-json",
            artifact: buildArtifactDetail(storeArtifact),
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

  app.get("/api/editor-recommended-artifacts", listEditorRecommendedArtifacts);

  app.get("/api/relics/search", async (req, res) => {
    try {
      const keyword = getSingleQueryParam(req.query.keyword as string | string[] | undefined)?.trim() ?? "";
      const limitValue = Number(getSingleQueryParam(req.query.limit as string | string[] | undefined) || "100");

      if (!keyword) {
        return res.status(400).json({ error: "请输入搜索内容" });
      }

      const limit = Number.isFinite(limitValue) ? limitValue : 100;
      const artifacts = await searchArtifactsInStore(keyword, limit);

      res.json({
        source: "imported-artifacts-json",
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

      const source = typeof req.body?.source === "string" ? req.body.source : "auto";
      const { artifacts } = await resolveArtifactsSource(source as "auto" | "imported" | "seed" | "merged");

      const { profile, ranked } = rankArtifactsForCurationSearch(artifacts, q, limit);
      const keywordIds = ranked.map((item) => item.artifact.id);
      const debugArtifacts = ranked.slice(0, 10).map((item) => ({
        id: item.artifact.id,
        name: artifactNameSafe(item.artifact),
        score: Number(item.score.toFixed(2)),
        matchedTerms: item.matchedTerms,
        matchedFields: item.matchedFields,
      }));
      if (isDevRuntime()) {
        console.debug("[curation/profile]", curationProfileLogPayload(profile));
        console.debug("[rag/search]", {
          query: q,
          matched: ranked.filter((item) => item.score > 0 && item.strongSignal).length,
          returned: debugArtifacts,
        });
      }

      res.json({
        mode: "keyword",
        artifactIds: keywordIds,
        keywordArtifactIds: keywordIds,
        semanticArtifactIds: [] as string[],
        profile,
        debugArtifacts,
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
	      const aiError = normalizeAiCurationError(error);
	      console.error("AI curation failed:", {
	        code: aiError.code,
	        message: aiError.message,
	        detail: aiError.detail,
	      });
	      res.status(aiError.httpStatus).json({
	        error: aiError.message,
	        code: aiError.code,
	        detail: aiError.detail,
	      });
	    }
	  });

  app.get("/api/museums", async (req, res) => {
    try {
      const museums = await listMuseumsFromStore();

      res.json({
        source: "imported-museums-json",
        total: museums.length,
        museums,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get(["/api/museums/:id", "/api/museum/:id"], async (req, res) => {
    try {
      const idOrName = decodeURIComponent(req.params.id);
      const { museum, artifacts } = await getMuseumArtifactsFromStore(idOrName);

      if (!museum) {
        return res.status(404).json({ error: "Museum not found." });
      }

      res.json({
        source: "imported-museums-json",
        museum,
        artifacts,
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
      await syncImportedMuseumsToDb(appDb);
      await refreshMuseumArtifactIndex();
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
  app.use("/exhibition-covers", express.static(path.join(process.cwd(), "public", "exhibition-covers")));
  app.use("/museum-images", express.static(path.join(process.cwd(), "public", "museum-images")));

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

if (process.env.MUSELINK_SKIP_SERVER_START !== "true") {
  startServer();
}

export { buildCurationSearchProfile, rankArtifactsForCurationSearch };
