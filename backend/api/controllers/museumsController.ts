import type { Request, Response } from "express";
import { db } from "../db/client";
import type { ArtifactRow, MuseumRow } from "../models/types";

export async function listMuseums(_req: Request, res: Response) {
  const rows = await db.query<MuseumRow>(
    `select m.id, m.name, m.description, m.location, m.image_url, m.created_at,
            count(a.id)::int as artifact_count
     from museums m
     left join artifacts a on a.museum_id = m.id
     group by m.id
     order by m.name asc`,
  );
  res.json({ museums: rows.rows });
}

export async function getMuseum(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const museumRow = await db.query<MuseumRow>(
    `select id, name, description, location, image_url, created_at
     from museums where id = $1`,
    [id],
  );
  const museum = museumRow.rows[0];
  if (!museum) return res.status(404).json({ error: "Not found" });

  const artifacts = await db.query<ArtifactRow>(
    `select a.id, a.name, a.dynasty, a.museum_id, m.name as museum, a.description, a.image_url, a.tags, a.created_at
     from artifacts a
     join museums m on m.id = a.museum_id
     where a.museum_id = $1
     order by a.id asc`,
    [id],
  );

  res.json({ museum, artifacts: artifacts.rows });
}
