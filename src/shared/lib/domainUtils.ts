import { Artifact, Exhibition } from '../../types';

export const mergeArtifactsById = (base: Artifact[], incoming: Artifact[]) => {
  const map = new Map<string, Artifact>();
  base.forEach((artifact) => map.set(String(artifact.id), artifact));
  incoming.forEach((artifact) => map.set(String(artifact.id), artifact));
  return Array.from(map.values());
};

export const findArtifactsByIds = (artifactIds: string[] | undefined, artifacts: Artifact[]) => {
  if (!Array.isArray(artifactIds) || artifactIds.length === 0) return [];
  const byId = new Map(artifacts.map((artifact) => [String(artifact.id), artifact]));
  return artifactIds
    .map((id) => byId.get(String(id)))
    .filter((artifact): artifact is Artifact => Boolean(artifact));
};

export const getSlideshowArtifacts = (exhibition: Exhibition | null, artifacts: Artifact[]) => {
  if (!exhibition) return [];
  if (!Array.isArray(exhibition.artifactIds) || exhibition.artifactIds.length === 0) return [];
  const matched = findArtifactsByIds(exhibition.artifactIds, artifacts);
  return matched.length > 0 ? matched : artifacts.slice(0, Math.min(12, artifacts.length));
};
