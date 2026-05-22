import type { Artifact } from "../types";
import {
  artifactCategoryRaw,
  artifactCultureRaw,
  artifactDescriptionRaw,
  artifactDimensionsRaw,
  artifactEraRaw,
  artifactLevelRaw,
  artifactMaterialRaw,
  artifactMuseumRaw,
  artifactNameRaw,
  artifactOriginRaw,
  artifactRemarksRaw,
} from "./dbDisplay";

function tagText(tag: Artifact["tags"][number]): string {
  if (typeof tag === "string") return tag;
  return [tag.type, tag.name].filter(Boolean).join(" ");
}

/** Concatenated searchable text for keyword matching（含同义字段归并值 + 原始键上的字符串，小写由调用方处理）。 */
export function artifactSearchBlob(a: Artifact): string {
  const o = a as unknown as Record<string, unknown>;
  return [
    artifactNameRaw(a),
    artifactMuseumRaw(a),
    artifactEraRaw(a),
    artifactMaterialRaw(a),
    artifactCultureRaw(a),
    artifactOriginRaw(a),
    artifactDescriptionRaw(a),
    artifactCategoryRaw(a),
    artifactLevelRaw(a),
    artifactDimensionsRaw(a),
    artifactRemarksRaw(a),
    o.name,
    o.museum,
    o.period,
    o["朝代"],
    o.dynasty,
    o["时代"],
    o.era,
    o["年代"],
    o.imageUrl,
    o.image_url,
    ...(a.tags ?? []).map(tagText),
  ]
    .map((x) => (x === null || x === undefined ? "" : String(x)))
    .filter((s) => s !== "")
    .join("\u0001")
    .toLowerCase();
}

function tokenize(q: string): string[] {
  return q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function scoreTokenHits(a: Artifact, tokens: string[]): number {
  let score = 0;
  const name = String(artifactNameRaw(a) ?? "").toLowerCase();
  const museum = String(artifactMuseumRaw(a) ?? "").toLowerCase();
  const desc = String(artifactDescriptionRaw(a) ?? "").toLowerCase();
  const era = String(artifactEraRaw(a) ?? "").toLowerCase();
  const material = String(artifactMaterialRaw(a) ?? "").toLowerCase();
  const culture = String(artifactCultureRaw(a) ?? "").toLowerCase();
  const origin = String(artifactOriginRaw(a) ?? "").toLowerCase();
  const tags = (a.tags ?? []).map((t) => tagText(t).toLowerCase());
  for (const t of tokens) {
    if (name.includes(t)) score += 12;
    else if (museum.includes(t)) score += 9;
    else if (tags.some((tag) => tag.includes(t))) score += 7;
    else if (
      era.includes(t) ||
      material.includes(t) ||
      culture.includes(t) ||
      origin.includes(t) ||
      String(artifactCategoryRaw(a) ?? "")
        .toLowerCase()
        .includes(t) ||
      String(artifactLevelRaw(a) ?? "")
        .toLowerCase()
        .includes(t) ||
      String(artifactDimensionsRaw(a) ?? "")
        .toLowerCase()
        .includes(t) ||
      String(artifactRemarksRaw(a) ?? "")
        .toLowerCase()
        .includes(t)
    )
      score += 5;
    else if (desc.includes(t)) score += 3;
  }
  score += Math.min(a.favsCount ?? 0, 80) * 0.02;
  return score;
}

/**
 * Keyword search across all artifact fields. Uses token AND when possible;
 * falls back to OR + scoring, then whole-phrase substring match.
 */
export function rankArtifactsByKeywordQuery(artifacts: Artifact[], query: string): Artifact[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return artifacts.slice();

  const blobFn = (a: Artifact) => artifactSearchBlob(a);

  const andMatches = artifacts.filter((a) => {
    const blob = blobFn(a);
    return tokens.every((t) => blob.includes(t));
  });

  const pool = andMatches.length > 0 ? andMatches : artifacts;

  const scored = pool
    .map((a) => {
      const blob = blobFn(a);
      let hits = 0;
      for (const t of tokens) {
        if (blob.includes(t)) hits += 1;
      }
      if (hits === 0 && pool === artifacts) {
        const phrase = query.trim().toLowerCase();
        if (phrase.length >= 2 && blob.includes(phrase)) {
          return { a, s: scoreTokenHits(a, tokens) + 15 };
        }
        return null;
      }
      if (hits === 0) return null;
      return { a, s: scoreTokenHits(a, tokens) + hits * 2 };
    })
    .filter((x): x is { a: Artifact; s: number } => x !== null)
    .sort((x, y) => y.s - x.s);

  if (scored.length > 0) return scored.map((x) => x.a);

  const phrase = query.trim().toLowerCase();
  if (phrase.length >= 2) {
    return artifacts
      .filter((a) => blobFn(a).includes(phrase))
      .sort((a, b) => (b.favsCount ?? 0) - (a.favsCount ?? 0));
  }

  return [];
}
