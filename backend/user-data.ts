import { readJsonFile, writeJsonFile } from "./store";

type UserDataDb = {
  version: 1;
  favoritesByUserId: Record<string, string[]>;
  favExhibitionsByUserId: Record<string, string[]>;
};

const FILE = "user-data.json";

async function loadDb(): Promise<UserDataDb> {
  return readJsonFile<UserDataDb>(FILE, {
    version: 1,
    favoritesByUserId: {},
    favExhibitionsByUserId: {},
  });
}

async function saveDb(db: UserDataDb) {
  await writeJsonFile(FILE, db);
}

function ensureArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
}

export async function getFavorites(userId: number): Promise<string[]> {
  const db = await loadDb();
  return ensureArray(db.favoritesByUserId[String(userId)]);
}

export async function toggleFavorite(userId: number, artifactId: string): Promise<string[]> {
  const db = await loadDb();
  const key = String(userId);
  const current = new Set(ensureArray(db.favoritesByUserId[key]));
  if (current.has(artifactId)) current.delete(artifactId);
  else current.add(artifactId);
  db.favoritesByUserId[key] = Array.from(current);
  await saveDb(db);
  return db.favoritesByUserId[key];
}

export async function getFavExhibitions(userId: number): Promise<string[]> {
  const db = await loadDb();
  return ensureArray(db.favExhibitionsByUserId[String(userId)]);
}

export async function toggleFavExhibition(userId: number, exhibitionId: string): Promise<{ favExhibitions: string[]; isFavorite: boolean; favsCount: number }> {
  const db = await loadDb();
  const key = String(userId);
  const current = new Set(ensureArray(db.favExhibitionsByUserId[key]));
  let isFavorite = true;
  if (current.has(exhibitionId)) {
    current.delete(exhibitionId);
    isFavorite = false;
  } else {
    current.add(exhibitionId);
  }
  db.favExhibitionsByUserId[key] = Array.from(current);
  await saveDb(db);
  const favsCount = Object.values(db.favExhibitionsByUserId).reduce(
    (count, ids) => count + (ensureArray(ids).includes(exhibitionId) ? 1 : 0),
    0,
  );
  return { favExhibitions: db.favExhibitionsByUserId[key], isFavorite, favsCount };
}

export async function getUserDataStatsByUserId() {
  const db = await loadDb();
  const userIds = new Set([
    ...Object.keys(db.favoritesByUserId),
    ...Object.keys(db.favExhibitionsByUserId),
  ]);

  const stats: Record<string, { favoriteArtifacts: number; favoriteExhibitions: number }> = {};
  for (const userId of userIds) {
    stats[userId] = {
      favoriteArtifacts: ensureArray(db.favoritesByUserId[userId]).length,
      favoriteExhibitions: ensureArray(db.favExhibitionsByUserId[userId]).length,
    };
  }

  return stats;
}
