import fs from "fs/promises";
import path from "path";

type SeedArtifact = {
  name: string;
  dynasty: string;
  museum: string;
  description: string;
  image_url: string;
  tags: string[];
};

export async function ensureSeedArtifacts(db: { query: (sql: string, params?: any[]) => Promise<any> }) {
  const existing = await db.query("select count(*)::text as count from artifacts");
  if (Number(existing.rows[0]?.count || "0") > 0) {
    return { seeded: false };
  }

  const filePath = path.join(process.cwd(), "backend", "api", "db", "seed-artifacts.json");
  const raw = await fs.readFile(filePath, "utf-8");
  const artifacts = JSON.parse(raw) as SeedArtifact[];

  const names = [...new Set(artifacts.map((x) => x.museum))];
  for (const name of names) {
    await db.query(`insert into museums (name) values ($1) on conflict (name) do nothing`, [name]);
  }
  const idRows = await db.query(`select id, name from museums`);
  const museumIdByName = new Map(
    (idRows.rows as { id: number; name: string }[]).map((r) => [r.name, r.id]),
  );

  for (const a of artifacts) {
    const museumId = museumIdByName.get(a.museum);
    if (museumId == null) throw new Error(`Missing museum row for: ${a.museum}`);
    await db.query(
      `insert into artifacts (name, dynasty, museum_id, description, image_url, tags)
       values ($1,$2,$3,$4,$5,$6)`,
      [a.name, a.dynasty, museumId, a.description, a.image_url, a.tags],
    );
  }
  return { seeded: true, count: artifacts.length };
}

