import { readJsonFile, writeJsonFile } from "./store";

export type ExhibitionRecord = {
  id: string;
  userId: number;
  userName: string;
  userPhoto: string;
  title: string;
  intro: string;
  coverUrl: string;
  artifactIds: string[];
  isPublic: boolean;
  likesCount: number;
  favsCount: number;
  commentsCount: number;
  bgmUrl?: string;
  slideshowSettings?: unknown;
  source?: string;
  aiGenerated?: boolean;
  generationNotice?: string;
  generationError?: string;
  aiCuration?: unknown;
  exhibitionIntro?: string;
  units?: unknown;
  conclusion?: string;
  selectionReasons?: unknown;
  artifactRoles?: unknown;
  createdAt: string;
  updatedAt: string;
};

type ExhibitionsDb = {
  version: 1;
  exhibitions: ExhibitionRecord[];
};

const FILE = "exhibitions.json";

function nowIso() {
  return new Date().toISOString();
}

function newExhibitionId() {
  return `exh_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

async function loadDb(): Promise<ExhibitionsDb> {
  return readJsonFile<ExhibitionsDb>(FILE, { version: 1, exhibitions: [] });
}

async function saveDb(db: ExhibitionsDb) {
  await writeJsonFile(FILE, db);
}

export async function listSquareExhibitions(limit = 10): Promise<ExhibitionRecord[]> {
  const db = await loadDb();
  return db.exhibitions
    .filter((e) => e.isPublic)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function listMyExhibitions(userId: number): Promise<ExhibitionRecord[]> {
  const db = await loadDb();
  return db.exhibitions
    .filter((e) => e.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listExhibitionsByIds(ids: string[]): Promise<ExhibitionRecord[]> {
  if (ids.length === 0) return [];
  const db = await loadDb();
  const order = new Map(ids.map((id, index) => [id, index]));
  return db.exhibitions
    .filter((e) => order.has(e.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function createExhibition(input: {
  userId: number;
  userName: string;
  userPhoto: string;
  title: string;
  intro: string;
  coverUrl: string;
  artifactIds: string[];
  isPublic: boolean;
  bgmUrl?: string;
  slideshowSettings?: unknown;
  source?: string;
  aiGenerated?: boolean;
  generationNotice?: string;
  generationError?: string;
  aiCuration?: unknown;
  exhibitionIntro?: string;
  units?: unknown;
  conclusion?: string;
  selectionReasons?: unknown;
  artifactRoles?: unknown;
}): Promise<ExhibitionRecord> {
  const db = await loadDb();
  const createdAt = nowIso();
  const record: ExhibitionRecord = {
    id: newExhibitionId(),
    userId: input.userId,
    userName: input.userName,
    userPhoto: input.userPhoto,
    title: input.title || "未命名展陈",
    intro: input.intro || "",
    coverUrl: input.coverUrl || "",
    artifactIds: Array.isArray(input.artifactIds) ? input.artifactIds.slice(0, 50) : [],
    isPublic: Boolean(input.isPublic),
    likesCount: 0,
    favsCount: 0,
    commentsCount: 0,
    bgmUrl: input.bgmUrl,
    slideshowSettings: input.slideshowSettings,
    source: input.source,
    aiGenerated: input.aiGenerated,
    generationNotice: input.generationNotice,
    generationError: input.generationError,
    aiCuration: input.aiCuration,
    exhibitionIntro: input.exhibitionIntro,
    units: input.units,
    conclusion: input.conclusion,
    selectionReasons: input.selectionReasons,
    artifactRoles: input.artifactRoles,
    createdAt,
    updatedAt: createdAt,
  };
  db.exhibitions.unshift(record);
  await saveDb(db);
  return record;
}

export async function updateExhibition(userId: number, id: string, patch: Partial<ExhibitionRecord>) {
  const db = await loadDb();
  const exhibition = db.exhibitions.find((e) => e.id === id);
  if (!exhibition) throw new Error("Exhibition not found.");
  if (exhibition.userId !== userId) throw new Error("Not allowed.");

  const updated: ExhibitionRecord = {
    ...exhibition,
    ...patch,
    id: exhibition.id,
    userId: exhibition.userId,
    updatedAt: nowIso(),
  };
  const index = db.exhibitions.findIndex((e) => e.id === id);
  db.exhibitions[index] = updated;
  await saveDb(db);
  return updated;
}

export async function deleteExhibition(userId: number, id: string) {
  const db = await loadDb();
  const exhibition = db.exhibitions.find((e) => e.id === id);
  if (!exhibition) return;
  if (exhibition.userId !== userId) throw new Error("Not allowed.");
  db.exhibitions = db.exhibitions.filter((e) => e.id !== id);
  await saveDb(db);
}

export async function setExhibitionFavoriteCount(id: string, favsCount: number) {
  const db = await loadDb();
  const exhibition = db.exhibitions.find((e) => e.id === id);
  if (!exhibition) return null;
  exhibition.favsCount = Math.max(0, favsCount);
  exhibition.updatedAt = nowIso();
  await saveDb(db);
  return exhibition;
}

export async function getExhibitionStatsByUserId() {
  const db = await loadDb();
  const stats: Record<string, { exhibitions: number; publicExhibitions: number }> = {};

  for (const exhibition of db.exhibitions) {
    const userId = String(exhibition.userId);
    stats[userId] ??= { exhibitions: 0, publicExhibitions: 0 };
    stats[userId].exhibitions += 1;
    if (exhibition.isPublic) {
      stats[userId].publicExhibitions += 1;
    }
  }

  return stats;
}
