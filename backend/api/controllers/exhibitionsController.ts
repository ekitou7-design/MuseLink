import type { Response } from "express";
import { db } from "../db/client";
import type { AuthedRequest } from "../middleware/auth";
import type { ExhibitionRow } from "../models/types";

function fallbackAiTitle(theme: string) {
  const clean = theme.trim() || "未命名主题";
  const candidates = [
    `山河与器物：${clean}`,
    `千年回响：${clean}`,
    `王朝与匠心：${clean}`,
    `光阴博物馆：${clean}`,
    `在历史里漫游：${clean}`,
  ];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export async function createAiExhibition(req: AuthedRequest, res: Response) {
  const theme = typeof req.body?.theme === "string" ? req.body.theme : "";
  const artifactIds = Array.isArray(req.body?.artifact_ids) ? req.body.artifact_ids : [];
  const bgmUrl = typeof req.body?.bgm_url === "string" ? req.body.bgm_url : null;

  if (!theme.trim()) return res.status(400).json({ error: "theme is required" });
  if (artifactIds.length === 0) return res.status(400).json({ error: "artifact_ids is required" });

  // Very lightweight “AI” fallback generator (project can run without external AI keys).
  const title = fallbackAiTitle(theme);

  const inserted = await db.query<ExhibitionRow>(
    `insert into exhibitions (user_id, title, theme, bgm_url)
     values ($1,$2,$3,$4)
     returning id, user_id, title, theme, bgm_url, created_at`,
    [req.auth!.userId, title, theme, bgmUrl],
  );
  const exhibition = inserted.rows[0];

  // Insert items with order_index and curator_note
  for (let i = 0; i < artifactIds.length; i += 1) {
    const artifactId = Number(artifactIds[i]);
    if (!Number.isFinite(artifactId)) continue;
    await db.query(
      `insert into exhibition_items (exhibition_id, artifact_id, order_index, curator_note)
       values ($1,$2,$3,$4)
       on conflict (exhibition_id, artifact_id) do nothing`,
      [exhibition.id, artifactId, i, ""],
    );
  }

  res.json({ exhibition });
}

export async function listExhibitions(_req: AuthedRequest, res: Response) {
  const rows = await db.query<ExhibitionRow>(
    `select id, user_id, title, theme, bgm_url, created_at
     from exhibitions
     order by created_at desc
     limit 50`,
  );
  res.json({ exhibitions: rows.rows });
}

export async function getExhibition(req: AuthedRequest, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const exhibitionRow = await db.query<ExhibitionRow>(
    `select id, user_id, title, theme, bgm_url, created_at
     from exhibitions where id = $1`,
    [id],
  );
  const exhibition = exhibitionRow.rows[0];
  if (!exhibition) return res.status(404).json({ error: "Not found" });

  const items = await db.query(
    `select ei.exhibition_id, ei.artifact_id, ei.order_index, ei.curator_note,
            a.name, a.dynasty, m.name as museum, a.description, a.image_url, a.tags
     from exhibition_items ei
     join artifacts a on a.id = ei.artifact_id
     join museums m on m.id = a.museum_id
     where ei.exhibition_id = $1
     order by ei.order_index asc`,
    [id],
  );

  res.json({ exhibition, items: items.rows });
}

