import type { Artifact, Museum } from "../src/types";
import { artifactEraRaw, artifactImageUrlRaw, artifactMaterialRaw, artifactMuseumRaw, isStrictDbEmpty } from "../src/lib/dbDisplay";
import { buildProvincialMuseumShells, DEFAULT_MUSEUM_IMAGE } from "./provincial-museums";
import { readJsonFile, writeJsonFile } from "./store";

type MuseumStoreDocument = {
  version: 1;
  updatedAt: string;
  museums: Museum[];
};

const MUSEUMS_FILE = "imported-museums.json";

function nowIso() {
  return new Date().toISOString();
}

function slugify(input: string) {
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_一-龥]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "museum";
}

function getImageUrl(artifact: Artifact | undefined) {
  const u = artifact ? String(artifactImageUrlRaw(artifact) ?? "") : "";
  return !isStrictDbEmpty(u) ? u : DEFAULT_MUSEUM_IMAGE;
}

function mergeWithProvincialMuseums(generatedMuseums: Museum[]) {
  const updatedAt = nowIso();
  const byName = new Map<string, Museum>();

  for (const museum of buildProvincialMuseumShells(slugify, updatedAt)) {
    byName.set(museum.name, museum);
  }

  for (const museum of generatedMuseums) {
    const existing = byName.get(museum.name);
    if (!existing) {
      byName.set(museum.name, museum);
      continue;
    }

    byName.set(museum.name, {
      ...existing,
      ...museum,
      location: existing.location || museum.location,
      description:
        museum.artifactCount > 0
          ? `${museum.name}馆藏文物数据库，当前收录 ${museum.artifactCount} 件文物。`
          : existing.description,
    });
  }

  return Array.from(byName.values()).sort(
    (left, right) => right.artifactCount - left.artifactCount || left.name.localeCompare(right.name, "zh-CN"),
  );
}

export function buildMuseumsFromArtifacts(artifacts: Artifact[]): Museum[] {
  const byName = new Map<
    string,
    {
      name: string;
      artifacts: Artifact[];
      periods: Set<string>;
      materials: Set<string>;
    }
  >();

  for (const artifact of artifacts) {
    const mKey = String(artifactMuseumRaw(artifact) ?? "");
    const name = isStrictDbEmpty(mKey) ? "未知博物馆" : mKey;
    const current =
      byName.get(name) ||
      {
        name,
        artifacts: [],
        periods: new Set<string>(),
        materials: new Set<string>(),
      };

    current.artifacts.push(artifact);
    const era = String(artifactEraRaw(artifact) ?? "");
    if (!isStrictDbEmpty(era)) current.periods.add(era);
    const mat = String(artifactMaterialRaw(artifact) ?? "");
    if (!isStrictDbEmpty(mat)) current.materials.add(mat);
    byName.set(name, current);
  }

  const generatedMuseums = Array.from(byName.values())
    .map((entry) => {
      const sortedArtifacts = entry.artifacts.slice().sort((left, right) => right.favsCount - left.favsCount);
      return {
        id: slugify(entry.name),
        name: entry.name,
        description: `${entry.name}馆藏文物数据库，当前收录 ${entry.artifacts.length} 件文物。`,
        location: "",
        imageUrl: getImageUrl(sortedArtifacts[0]),
        artifactIds: sortedArtifacts.map((artifact) => artifact.id),
        artifactCount: entry.artifacts.length,
        periods: Array.from(entry.periods).sort(),
        materials: Array.from(entry.materials).sort(),
        updatedAt: nowIso(),
      };
    })
    .sort((left, right) => right.artifactCount - left.artifactCount || left.name.localeCompare(right.name, "zh-CN"));

  return mergeWithProvincialMuseums(generatedMuseums);
}

export async function readMuseumStore(): Promise<MuseumStoreDocument> {
  return readJsonFile<MuseumStoreDocument>(MUSEUMS_FILE, {
    version: 1,
    updatedAt: nowIso(),
    museums: [],
  });
}

export async function writeMuseumStore(museums: Museum[]) {
  await writeJsonFile<MuseumStoreDocument>(MUSEUMS_FILE, {
    version: 1,
    updatedAt: nowIso(),
    museums,
  });
}

function normalizeMuseumForCompare(museum: Museum) {
  const { updatedAt, ...stableMuseum } = museum;
  return stableMuseum;
}

function hasSameMuseumContent(left: Museum[], right: Museum[]) {
  if (left.length !== right.length) return false;

  return JSON.stringify(left.map(normalizeMuseumForCompare)) ===
    JSON.stringify(right.map(normalizeMuseumForCompare));
}

export async function syncMuseumStoreFromArtifacts(artifacts: Artifact[]) {
  const museums = buildMuseumsFromArtifacts(artifacts);
  const existing = await readMuseumStore();

  if (hasSameMuseumContent(existing.museums, museums)) {
    return existing.museums;
  }

  await writeMuseumStore(museums);
  return museums;
}
