import fs from "fs/promises";
import path from "path";

type SeedArtifact = {
  name: string;
  dynasty: string;
  museum: string;
  category?: string;
  short_intro?: string;
  description: string;
  image_url: string;
  source_url?: string;
  tags: string[];
};

export async function ensureSeedArtifacts(db: { query: (sql: string, params?: any[]) => Promise<any> }) {
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

  let count = 0;
  for (const a of artifacts) {
    const museumId = museumIdByName.get(a.museum);
    if (museumId == null) throw new Error(`Missing museum row for: ${a.museum}`);
    const result = await db.query(
      `insert into artifacts (name, dynasty, museum_id, category, short_intro, description, image_url, source_url, tags)
       select $1,$2,$3,$4,$5,$6,$7,$8,$9
       where not exists (
         select 1 from artifacts
         where name = $1 and museum_id = $3
       )`,
      [
        a.name,
        a.dynasty,
        museumId,
        a.category || "",
        a.short_intro || "",
        a.description,
        a.image_url,
        a.source_url || "",
        a.tags,
      ],
    );
    count += Number(result.rowCount || 0);
  }
  return { seeded: count > 0, count };
}
