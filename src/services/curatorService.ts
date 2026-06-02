import { Artifact, Exhibition } from "../types";
import { rankArtifactsByKeywordQuery } from "../lib/artifactSearch";
import { apiUrl } from "../lib/api";
import {
  CONTENT_CURATION_QUESTIONS,
  type CuratorGuideAnswers,
} from "../modules/curation/data/curatorPreferences";
import {
  artifactCategoryRaw,
  artifactCultureRaw,
  artifactDescriptionRaw,
  artifactEraRaw,
  artifactMaterialRaw,
  artifactMuseumRaw,
  artifactNameRaw,
  artifactOriginRaw,
  displayDbString,
  isStrictDbEmpty,
} from "../lib/dbDisplay";

const CURATION_CANDIDATE_LIMIT = 72;

function tagText(tag: Artifact["tags"][number]): string {
  if (typeof tag === "string") return tag;
  return [tag.type, tag.name].filter(Boolean).join(" ");
}

const CURATION_STOP_WORDS = new Set([
  "帮我",
  "策划",
  "一个",
  "一场",
  "关于",
  "主题",
  "展览",
  "展陈",
  "文物",
  "喜欢",
  "印象",
  "深刻",
  "旅行",
  "文化",
  "体验",
  "建筑",
  "风格",
  "生成",
  "大约",
  "左右",
  "开口",
  "即可",
  "ai",
]);
const REMOTE_CURATION_ENDPOINT = "/api/ai/curation";

export type GenerateExhibitionOptions = {
  guideAnswers?: CuratorGuideAnswers;
};

export interface CurationProvider {
  getRelatedArtifacts(
    currentArtifact: Artifact,
    allArtifacts: Artifact[],
  ): Promise<{ artifactId: string; reason: string }[]>;
  generateExhibition(
    userPrompt: string,
    allArtifacts: Artifact[],
    options?: GenerateExhibitionOptions,
  ): Promise<Partial<Exhibition>>;
}

function buildGuideSummary(guideAnswers: CuratorGuideAnswers = {}): string {
  return CONTENT_CURATION_QUESTIONS
    .map((question) => {
      const answer = guideAnswers[question.id]?.trim();
      return answer ? `${question.title} ${question.prompt}${answer}` : "";
    })
    .filter(Boolean)
    .join("；");
}

function buildEffectivePrompt(userPrompt: string, guideAnswers: CuratorGuideAnswers = {}): string {
  const base = userPrompt.trim();
  const guideSummary = buildGuideSummary(guideAnswers);
  if (!guideSummary) return base;
  return [
    base || "请根据我的策展问题回答生成一个个人展览",
    `用户的策展问题回答：${guideSummary}。`,
    "请优先围绕这些回答确定展览主题、展品选择、叙事线索、知识重点和情感落点。",
  ].join("\n");
}

async function retrieveCandidatesForCuration(userPrompt: string, allArtifacts: Artifact[]): Promise<Artifact[]> {
  const query = userPrompt.trim() || "个人策展 展览 文物";
  try {
    const res = await fetch(apiUrl("/api/rag/search"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, limit: CURATION_CANDIDATE_LIMIT }),
    });
    if (!res.ok) throw new Error(`rag ${res.status}`);
    const data = (await res.json()) as { artifactIds?: string[] };
    const ids = data.artifactIds ?? [];
    const map = new Map(allArtifacts.map((a) => [a.id, a]));
    const picked = ids.map((id) => map.get(id)).filter(Boolean) as Artifact[];
    if (picked.length >= 6) return picked;
  } catch (e) {
    console.warn("检索候选不可用，改用关键词:", e);
  }
  const kw = rankArtifactsByKeywordQuery(allArtifacts, query);
  if (kw.length > 0) return kw.slice(0, CURATION_CANDIDATE_LIMIT);
  return allArtifacts.slice(0, Math.min(CURATION_CANDIDATE_LIMIT, allArtifacts.length));
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function artifactName(artifact: Artifact): string {
  return displayDbString(artifactNameRaw(artifact));
}

function extractCurationIntent(prompt: string) {
  const clean = prompt.replace(/[“”"'\n\r,，。.!！?？:：；;]/g, " ");
  const explicitTheme =
    clean.match(/(?:关于|围绕|主题是|策划一个|策划一场|生成一个)([^，。.!！?？]+)/)?.[1]?.trim() ||
    clean.trim();
  const keywords = Array.from(
    new Set(
      clean
        .split(/\s+|的|和|与|及|、/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 2 && !CURATION_STOP_WORDS.has(word)),
    ),
  ).slice(0, 10);

  return {
    theme: (explicitTheme || prompt || "主题展览").slice(0, 36),
    keywords,
  };
}

function artifactText(artifact: Artifact): string {
  return [
    artifactNameRaw(artifact),
    artifactMuseumRaw(artifact),
    artifactEraRaw(artifact),
    artifactMaterialRaw(artifact),
    artifactCultureRaw(artifact),
    artifactOriginRaw(artifact),
    artifactCategoryRaw(artifact),
    artifactDescriptionRaw(artifact),
    ...(artifact.tags ?? []).map(tagText),
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
}

function scoreForPrompt(artifact: Artifact, prompt: string, keywords: string[], index: number): number {
  const text = artifactText(artifact);
  let score = Math.max(0, CURATION_CANDIDATE_LIMIT - index) * 0.08;
  const promptText = prompt.toLowerCase();
  if (promptText && text.includes(promptText)) score += 18;
  keywords.forEach((keyword) => {
    const key = keyword.toLowerCase();
    if (!key) return;
    if (String(artifactNameRaw(artifact) ?? "").toLowerCase().includes(key)) score += 16;
    else if (String(artifactDescriptionRaw(artifact) ?? "").toLowerCase().includes(key)) score += 8;
    else if (text.includes(key)) score += 6;
  });
  score += Math.min(artifact.favsCount ?? 0, 80) * 0.02;
  return score;
}

function diversifyArtifacts(candidates: Artifact[], prompt: string, keywords: string[], targetCount: number): Artifact[] {
  const selected: Artifact[] = [];
  const museumCounts = new Map<string, number>();
  const eraCounts = new Map<string, number>();
  const materialCounts = new Map<string, number>();

  const ranked = candidates
    .map((artifact, index) => ({ artifact, score: scoreForPrompt(artifact, prompt, keywords, index) }))
    .sort((a, b) => b.score - a.score);

  for (const { artifact } of ranked) {
    if (selected.some((item) => item.id === artifact.id)) continue;
    const museum = normalizeText(artifactMuseumRaw(artifact));
    const era = normalizeText(artifactEraRaw(artifact));
    const material = normalizeText(artifactMaterialRaw(artifact));
    const hasDirectKeyword = keywords.some((keyword) => artifactText(artifact).includes(keyword.toLowerCase()));
    const museumLimit = hasDirectKeyword ? 5 : 3;
    const eraLimit = hasDirectKeyword ? 6 : 4;
    const materialLimit = hasDirectKeyword ? 5 : 3;

    if (museum && (museumCounts.get(museum) ?? 0) >= museumLimit) continue;
    if (era && (eraCounts.get(era) ?? 0) >= eraLimit) continue;
    if (material && (materialCounts.get(material) ?? 0) >= materialLimit) continue;

    selected.push(artifact);
    if (museum) museumCounts.set(museum, (museumCounts.get(museum) ?? 0) + 1);
    if (era) eraCounts.set(era, (eraCounts.get(era) ?? 0) + 1);
    if (material) materialCounts.set(material, (materialCounts.get(material) ?? 0) + 1);
    if (selected.length >= targetCount) break;
  }

  if (selected.length < Math.min(6, candidates.length)) {
    for (const artifact of ranked.map((item) => item.artifact)) {
      if (!selected.some((item) => item.id === artifact.id)) selected.push(artifact);
      if (selected.length >= targetCount) break;
    }
  }

  return selected;
}

function commonValue(artifacts: Artifact[], getter: (artifact: Artifact) => unknown): string {
  const counts = new Map<string, number>();
  artifacts.forEach((artifact) => {
    const value = normalizeText(getter(artifact));
    if (!value || isStrictDbEmpty(value)) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function buildSections(theme: string, pick: Artifact[]) {
  const sections = [
    {
      title: "第一单元：生活现场",
      ids: pick.filter((artifact) => {
        const text = artifactText(artifact);
        return /生活|居|文人|书|画|茶|香|琴|砚|笔|墨|山水|园林/.test(text);
      }),
    },
    {
      title: "第二单元：器物与审美",
      ids: pick.filter((artifact) => {
        const text = artifactText(artifact);
        return /瓷|陶|玉|漆|铜|银|金|器|纹|釉|造型|工艺/.test(text);
      }),
    },
    {
      title: "第三单元：地域与时代",
      ids: pick.filter((artifact) => {
        const text = artifactText(artifact);
        return /江南|苏|浙|杭|吴|越|宋|元|明|清|朝|遗址|出土/.test(text);
      }),
    },
  ];

  const assigned = new Set(sections.flatMap((section) => section.ids.map((artifact) => artifact.id)));
  const remaining = pick.filter((artifact) => !assigned.has(artifact.id));
  remaining.forEach((artifact, index) => sections[index % sections.length].ids.push(artifact));

  return sections
    .filter((section) => section.ids.length > 0)
    .map((section) => ({
      title: section.title,
      names: section.ids.slice(0, 5).map(artifactName),
    }));
}

function buildLocalAICuration(theme: string, pick: Artifact[], sourceNote: string) {
  const sections = buildSections(theme, pick);
  const artifactNotes = Object.fromEntries(
    pick.map((artifact, index) => [
      artifact.id,
      `第 ${index + 1} 件展品以「${artifactName(artifact)}」回应主题中的一个侧面，可从馆藏单位、年代、材质和简介中读取它与展览叙事的关系。`,
    ]),
  );

  return {
    theme,
    opening: `这是一场围绕「${theme}」生成的个人展览。它先从一件可感知的器物出发，再把观众带入相关的生活经验、时代背景与审美秩序。`,
    sections: sections.map((section) => ({
      title: section.title,
      summary: `本单元通过 ${section.names.join("、")} 等展品建立观看线索，让观众从展品细节进入更完整的文化语境。`,
      artifactIds: pick
        .filter((artifact) => section.names.includes(artifactName(artifact)))
        .map((artifact) => artifact.id),
    })),
    artifactNotes,
    ending: "当展览回到今天，观众看到的不只是单件文物，而是一组关于生活、工艺、记忆与观看方式的连接。",
    sourceNote,
  };
}

function scoreRelated(candidate: Artifact, current: Artifact): number {
  let s = 0;
  if (
    String(artifactMuseumRaw(candidate) ?? "") === String(artifactMuseumRaw(current) ?? "") &&
    !isStrictDbEmpty(String(artifactMuseumRaw(current) ?? ""))
  )
    s += 8;
  const curEra = String(artifactEraRaw(current) ?? "");
  const candEra = String(artifactEraRaw(candidate) ?? "");
  if (candEra === curEra && !isStrictDbEmpty(curEra)) s += 6;
  if (
    String(artifactCultureRaw(candidate) ?? "") === String(artifactCultureRaw(current) ?? "") &&
    !isStrictDbEmpty(String(artifactCultureRaw(current) ?? ""))
  )
    s += 5;
  if (
    String(artifactMaterialRaw(candidate) ?? "") === String(artifactMaterialRaw(current) ?? "") &&
    !isStrictDbEmpty(String(artifactMaterialRaw(current) ?? ""))
  )
    s += 4;
  const co = String(artifactOriginRaw(candidate) ?? "");
  const ccur = String(artifactOriginRaw(current) ?? "");
  if (!isStrictDbEmpty(co) && !isStrictDbEmpty(ccur) && co === ccur) s += 7;
  s += Math.min(candidate.favsCount ?? 0, 60) * 0.03;
  return s;
}

function relationReason(candidate: Artifact, current: Artifact): string {
  if (String(artifactMuseumRaw(candidate) ?? "") === String(artifactMuseumRaw(current) ?? "") && !isStrictDbEmpty(String(artifactMuseumRaw(current) ?? "")))
    return `同属 ${String(artifactMuseumRaw(current) ?? "")}`;
  const curEra = String(artifactEraRaw(current) ?? "");
  if (String(artifactEraRaw(candidate) ?? "") === curEra && !isStrictDbEmpty(curEra))
    return `年代并列：${curEra}`;
  if (
    String(artifactMaterialRaw(candidate) ?? "") === String(artifactMaterialRaw(current) ?? "") &&
    !isStrictDbEmpty(String(artifactMaterialRaw(current) ?? ""))
  )
    return `同类材质：${String(artifactMaterialRaw(current) ?? "")}`;
  const oCan = String(artifactOriginRaw(candidate) ?? "");
  const oCur = String(artifactOriginRaw(current) ?? "");
  if (!isStrictDbEmpty(oCan) && !isStrictDbEmpty(oCur) && oCan === oCur) return `出土地关联：${oCur}`;
  if (
    String(artifactCultureRaw(candidate) ?? "") === String(artifactCultureRaw(current) ?? "") &&
    !isStrictDbEmpty(String(artifactCultureRaw(current) ?? ""))
  )
    return `文化语境：${String(artifactCultureRaw(current) ?? "")}`;
  return "可与当前展品形成并列或补充叙事";
}

const localRuleCurationProvider: CurationProvider = {
  async getRelatedArtifacts(
    currentArtifact: Artifact,
    allArtifacts: Artifact[],
  ): Promise<{ artifactId: string; reason: string }[]> {
    const others = allArtifacts.filter((a) => a.id !== currentArtifact.id);
    const ranked = others
      .map((a) => ({ a, s: scoreRelated(a, currentArtifact) }))
      .sort((x, y) => y.s - x.s);
    const strong = ranked.filter((x) => x.s >= 4).slice(0, 15);
    const chosen = strong.length >= 8 ? strong : ranked.slice(0, 15);
    return chosen.map(({ a }) => ({
      artifactId: a.id,
      reason: relationReason(a, currentArtifact),
    }));
  },

  async generateExhibition(
    userPrompt: string,
    allArtifacts: Artifact[],
    options: GenerateExhibitionOptions = {},
  ): Promise<Partial<Exhibition>> {
    if (allArtifacts.length === 0) {
      throw new Error("当前后端文物库为空，无法生成展览。");
    }

    const effectivePrompt = buildEffectivePrompt(userPrompt, options.guideAnswers);
    const intent = extractCurationIntent(effectivePrompt);
    const candidates = await retrieveCandidatesForCuration(effectivePrompt, allArtifacts);
    const targetCount = Math.min(15, Math.max(6, Math.min(candidates.length || allArtifacts.length, 12)));
    const pick = diversifyArtifacts(
      candidates.length > 0
        ? candidates
        : [...allArtifacts].sort((a, b) => (b.favsCount ?? 0) - (a.favsCount ?? 0)),
      effectivePrompt,
      intent.keywords,
      targetCount,
    );

    if (pick.length === 0) {
      throw new Error("没有从后端文物库检索到可用于策展的展品。");
    }

    const title = `一念成展：${intent.theme}`;
    const previewNames = pick.slice(0, 4).map(artifactName).join("、");
    const museum = commonValue(pick, artifactMuseumRaw);
    const era = commonValue(pick, artifactEraRaw);
    const material = commonValue(pick, artifactMaterialRaw);
    const sections = buildSections(intent.theme, pick);
    const sectionText = sections
      .map((section) => `\n\n${section.title}\n${section.names.join("、")}`)
      .join("");
    const basis = [
      museum ? `馆藏线索：${museum}` : "",
      era ? `主要年代：${era}` : "",
      material ? `高频材质：${material}` : "",
    ].filter(Boolean).join("；");
    const intro =
      `本展围绕「${intent.theme}」，从后端文物库实时筛选 ${pick.length} 件真实馆藏展品，` +
      `以 ${previewNames}${pick.length > 4 ? " 等" : ""} 建立叙事入口。` +
      `${basis ? `\n\n${basis}` : ""}` +
      `\n\n展览逻辑：由日常经验进入器物细节，再回到地域、时代与审美秩序，让观众从“看见一件物”走向“理解一种生活”。` +
      sectionText +
      `\n\n导览文案：请从展品名称、馆藏单位、年代、材质和简介中读取线索；系统不会补写数据库中不存在的具体来源或故事。`;

    return {
      title,
      intro,
      coverUrl: String(pick[0]?.imageUrl ?? ""),
      artifactIds: pick.map((a) => a.id),
      aiCuration: buildLocalAICuration(
        intent.theme,
        pick,
        "展品来自后端馆藏库；当前方案由本地策展规则根据馆藏字段生成，未补写数据库之外的具体故事。",
      ),
    };
  },
};

async function tryRemoteExhibitionGeneration(
  userPrompt: string,
  allArtifacts: Artifact[],
  options: GenerateExhibitionOptions = {},
): Promise<Partial<Exhibition> | null> {
  try {
    const guideSummary = buildGuideSummary(options.guideAnswers);
    const effectivePrompt = buildEffectivePrompt(userPrompt, options.guideAnswers);
    const candidates = await retrieveCandidatesForCuration(effectivePrompt, allArtifacts);
    const res = await fetch(apiUrl(REMOTE_CURATION_ENDPOINT), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate-exhibition",
        userPrompt,
        guideAnswers: options.guideAnswers ?? {},
        guideSummary,
        artifacts: candidates.slice(0, 36),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || `remote curation ${res.status}`);
    }

    const result = (await res.json()) as Partial<Exhibition>;
    if (!Array.isArray(result.artifactIds) || result.artifactIds.length === 0) {
      throw new Error("remote curation returned no artifactIds");
    }
    return result;
  } catch (error) {
    console.warn("魔搭策展不可用，改用本地规则:", error);
    return null;
  }
}

let activeCurationProvider: CurationProvider = localRuleCurationProvider;

export function setCurationProvider(provider: CurationProvider) {
  activeCurationProvider = provider;
}

export function resetCurationProvider() {
  activeCurationProvider = localRuleCurationProvider;
}

export function createRemoteCurationProvider(endpoint: string): CurationProvider {
  async function postToProvider<T>(action: string, payload: Record<string, unknown>): Promise<T> {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) {
      throw new Error(`AI provider request failed: ${res.status}`);
    }
    return (await res.json()) as T;
  }

  return {
    getRelatedArtifacts(currentArtifact, allArtifacts) {
      return postToProvider<{ artifactId: string; reason: string }[]>("related-artifacts", {
        currentArtifact,
        allArtifacts,
      });
    },
    generateExhibition(userPrompt, allArtifacts, options) {
      return postToProvider<Partial<Exhibition>>("generate-exhibition", {
        userPrompt,
        allArtifacts,
        guideAnswers: options?.guideAnswers ?? {},
        guideSummary: buildGuideSummary(options?.guideAnswers),
      });
    },
  };
}

/** Provider-neutral curation service. Defaults to local rules and can be swapped for any AI gateway. */
export const curatorService: CurationProvider = {
  getRelatedArtifacts(currentArtifact, allArtifacts) {
    return activeCurationProvider.getRelatedArtifacts(currentArtifact, allArtifacts);
  },
  async generateExhibition(userPrompt, allArtifacts, options) {
    if (activeCurationProvider === localRuleCurationProvider) {
      const remoteResult = await tryRemoteExhibitionGeneration(userPrompt, allArtifacts, options);
      if (remoteResult) return remoteResult;
      const fallbackResult = await activeCurationProvider.generateExhibition(userPrompt, allArtifacts, options);
      return {
        ...fallbackResult,
        generationNotice: "AI 服务暂不可用，已用本地策展规则生成草案。",
      } as Partial<Exhibition>;
    }
    return activeCurationProvider.generateExhibition(userPrompt, allArtifacts, options);
  },
};
