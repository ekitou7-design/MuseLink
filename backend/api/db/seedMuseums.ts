import { PROVINCIAL_MUSEUMS } from "../../provincial-museums";

export async function ensureSeedMuseums(db: { query: (sql: string, params?: any[]) => Promise<any> }) {
  for (const museum of PROVINCIAL_MUSEUMS) {
    await db.query(
      `insert into museums (name, description, location)
       values ($1, $2, $3)
       on conflict (name) do update
       set description = case
             when museums.description = '' then excluded.description
             else museums.description
           end,
           location = case
             when museums.location = '' then excluded.location
             else museums.location
           end`,
      [museum.name, `${museum.name}是对应${museum.location}的省级综合性博物馆。`, museum.location],
    );
  }

  return { count: PROVINCIAL_MUSEUMS.length };
}
