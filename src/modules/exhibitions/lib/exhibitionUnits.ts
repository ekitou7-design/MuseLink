import type { Artifact, Exhibition, ExhibitionArtifactRole, ExhibitionUnit } from '../../../types';
import {
  artifactDescriptionRaw,
  artifactNameRaw,
  displayDbString,
  isStrictDbEmpty,
} from '../../../lib/dbDisplay';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function clampSentence(value: string, max = 96) {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/[，,、；;：:。.\s]+$/g, '')}。`;
}

function sanitizeGuideText(value: string) {
  return value
    .replace(/本方案围绕/g, '这场展览围绕')
    .replace(/结构包括/g, '将从')
    .replace(/通过系统分析/g, '沿着展品线索')
    .replace(/AI 为你生成/g, '这场展览呈现')
    .replace(/生成的个人展览/g, '展开')
    .trim();
}

export function exhibitionTextSummary(value: string, max = 96) {
  return clampSentence(sanitizeGuideText(value), max);
}

export function normalizeExhibitionUnits(exhibition: Exhibition): ExhibitionUnit[] {
  const artifactIds = Array.isArray(exhibition.artifactIds) ? exhibition.artifactIds.map(String) : [];
  const sourceUnits = Array.isArray(exhibition.units) ? exhibition.units : [];
  const normalizedUnits = sourceUnits
    .map((unit, index) => ({
      id: text(unit.id) || `unit-${index + 1}`,
      title: text(unit.title) || `第 ${index + 1} 单元`,
      description: text(unit.description) || '本单元从展品之间的关联出发，呈现一条清晰的观看线索。',
      artifactIds: Array.isArray(unit.artifactIds) ? unit.artifactIds.map(String).filter(Boolean) : [],
      curatorNote: text(unit.curatorNote),
    }))
    .filter((unit) => unit.artifactIds.length > 0);

  if (normalizedUnits.length > 0) return normalizedUnits;

  const aiSections = exhibition.aiCuration?.sections;
  if (Array.isArray(aiSections) && aiSections.length > 0) {
    const sectionUnits = aiSections
      .map((section, index) => ({
        id: `ai-unit-${index + 1}`,
        title: text(section.title) || `第 ${index + 1} 单元`,
        description: text(section.summary) || '本单元聚焦一组彼此呼应的展品。',
        artifactIds: Array.isArray(section.artifactIds) ? section.artifactIds.map(String).filter(Boolean) : [],
        curatorNote: text(section.summary),
      }))
      .filter((unit) => unit.artifactIds.length > 0);
    if (sectionUnits.length > 0) return sectionUnits;
  }

  return [
    {
      id: 'default',
      title: '精选展品',
      description: '本单元汇集本展览中的代表性展品。',
      artifactIds,
      curatorNote: '这些展品共同构成本展的基础观看线索。',
    },
  ];
}

export function exhibitionGuideIntro(exhibition: Exhibition) {
  return text(exhibition.aiCuration?.opening) || text(exhibition.exhibitionIntro) || text(exhibition.intro);
}

export function exhibitionConclusion(exhibition: Exhibition) {
  const source = text(exhibition.conclusion) || text(exhibition.aiCuration?.ending);
  return source;
}

export function artifactSelectionReason(exhibition: Exhibition, artifact: Artifact) {
  const id = String(artifact.id);
  const reason = text(exhibition.selectionReasons?.[id]) || text(exhibition.aiCuration?.artifactNotes?.[id]);
  if (reason) return reason;
  const description = text(artifactDescriptionRaw(artifact));
  if (description && !isStrictDbEmpty(description)) return clampSentence(description, 78);
  return `它为这场展览补充了关于「${displayDbString(artifactNameRaw(artifact))}」的观看线索。`;
}

export function artifactRole(exhibition: Exhibition, artifact: Artifact): ExhibitionArtifactRole {
  return exhibition.artifactRoles?.[String(artifact.id)] || '补充展品';
}
