import { Exhibition } from '../../../types';

export const normalizeExhibition = (raw: unknown): Exhibition | null => {
  const source = ((raw as any)?.exhibition ?? raw) as any;
  if (!source || typeof source !== 'object') return null;

  const artifactIds = Array.isArray(source.artifactIds)
    ? source.artifactIds
    : Array.isArray(source.artifact_ids)
      ? source.artifact_ids
      : [];
  const createdAt = String(source.createdAt ?? source.created_at ?? new Date().toISOString());

  return {
    id: String(source.id ?? ''),
    userId: source.userId ?? source.user_id ?? '',
    userName: String(source.userName ?? source.user_name ?? source.curatorName ?? '博悟用户'),
    userPhoto: String(source.userPhoto ?? source.user_photo ?? ''),
    title: String(source.title ?? source.theme ?? '未命名展陈'),
    intro: String(source.intro ?? source.description ?? source.theme ?? ''),
    coverUrl: String(source.coverUrl ?? source.cover_url ?? ''),
    artifactIds: artifactIds.map((id: unknown) => String(id)),
    isPublic: Boolean(source.isPublic ?? source.is_public),
    likesCount: Number(source.likesCount ?? source.likes_count ?? 0),
    favsCount: Number(source.favsCount ?? source.favs_count ?? 0),
    commentsCount: Number(source.commentsCount ?? source.comments_count ?? 0),
    bgmUrl: source.bgmUrl ?? source.bgm_url,
    slideshowSettings: source.slideshowSettings ?? source.slideshow_settings,
    aiCuration: source.aiCuration ?? source.ai_curation,
    exhibitionIntro: source.exhibitionIntro ?? source.exhibition_intro,
    units: source.units,
    conclusion: source.conclusion,
    selectionReasons: source.selectionReasons ?? source.selection_reasons,
    artifactRoles: source.artifactRoles ?? source.artifact_roles,
    createdAt,
    updatedAt: String(source.updatedAt ?? source.updated_at ?? createdAt),
  };
};

export const normalizeExhibitions = (items: unknown): Exhibition[] => (
  Array.isArray(items)
    ? items.map(normalizeExhibition).filter((item): item is Exhibition => Boolean(item && item.id))
    : []
);
