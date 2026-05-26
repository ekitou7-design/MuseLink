import { Artifact } from '../../../types';

export const normalizeArtifact = (raw: unknown): Artifact => {
  const source = (raw || {}) as Record<string, unknown>;
  const tags = Array.isArray(source.tags)
    ? source.tags
        .map((tag) => {
          if (tag && typeof tag === 'object' && !Array.isArray(tag)) {
            const record = tag as Record<string, unknown>;
            const name = String(record.name ?? '');
            return name ? { type: String(record.type ?? '文化标签'), name } : null;
          }
          return String(tag);
        })
        .filter(Boolean) as Artifact['tags']
    : [];
  const period = String(source.period ?? source.dynasty ?? source.era ?? source['朝代'] ?? '');
  const imageUrl = String(source.imageUrl ?? source.image_url ?? source['图片链接'] ?? '');
  const museum = String(source.museumName ?? source.museum ?? source['所属博物馆'] ?? '');
  const shortIntro = source.shortIntro ?? source.short_intro ?? source['一句话简介'] ?? source.summary;
  const sourceUrl = source.sourceUrl ?? source.source_url ?? source['来源链接'];

  return {
    ...source,
    id: String(source.id ?? ''),
    name: String(source.name ?? source['文物名称'] ?? ''),
    museum,
    museumName: museum,
    period,
    dynasty: period,
    material: String(source.material ?? source['材质'] ?? ''),
    culture: String(source.culture ?? source['文化'] ?? ''),
    origin: String(source.origin ?? source['出土地'] ?? ''),
    description: String(source.description ?? source['简介'] ?? ''),
    shortIntro: shortIntro === undefined ? undefined : String(shortIntro),
    imageUrl,
    image_url: imageUrl,
    sourceUrl: sourceUrl === undefined ? undefined : String(sourceUrl),
    source_url: sourceUrl === undefined ? undefined : String(sourceUrl),
    tags,
    attributes: Array.isArray(source.attributes) ? source.attributes as Artifact['attributes'] : undefined,
    favsCount: Number(source.favsCount ?? source.favs_count ?? 0),
    category: source.category === undefined ? undefined : String(source.category),
    level: source.level === undefined ? undefined : String(source.level),
    dimensions: source.dimensions === undefined ? undefined : String(source.dimensions),
    remarks: source.remarks === undefined ? undefined : String(source.remarks),
  } as Artifact;
};

export const normalizeArtifacts = (items: unknown): Artifact[] => (
  Array.isArray(items)
    ? items.map(normalizeArtifact).filter((artifact) => artifact.id && artifact.name)
    : []
);
