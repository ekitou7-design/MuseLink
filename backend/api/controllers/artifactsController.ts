import type { Request, Response } from "express";
import { db } from "../db/client";
import { searchRelics } from "../db/relicSearch";
import type { ArtifactRow } from "../models/types";

export async function listArtifacts(req: Request, res: Response) {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const rows = await db.query<ArtifactRow>(
    `select a.id, a.name, a.dynasty, a.museum_id, m.name as museum, a.description, a.image_url, a.tags, a.created_at
     from artifacts a
     join museums m on m.id = a.museum_id
     order by a.id asc
     limit $1`,
    [Number.isFinite(limit) ? limit : 100],
  );
  res.json({ artifacts: rows.rows });
}

export async function getArtifact(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const row = await db.query<ArtifactRow>(
    `select a.id, a.name, a.dynasty, a.museum_id, m.name as museum, a.description, a.image_url, a.tags, a.created_at
     from artifacts a
     join museums m on m.id = a.museum_id
     where a.id = $1`,
    [id],
  );
  const artifact = row.rows[0];
  if (!artifact) return res.status(404).json({ error: "Not found" });
  res.json({ artifact });
}

export async function searchArtifacts(req: Request, res: Response) {
  const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
  const limit = Math.min(Number(req.query.limit || 100), 500);
  if (!keyword) {
    return res.status(400).json({ error: "请输入搜索内容" });
  }

  const artifacts = await searchRelics(db, {
    keyword,
    limit: Number.isFinite(limit) ? limit : 100,
  });
  res.json({
    keyword,
    total: artifacts.length,
    artifacts,
    relics: artifacts,
  });
}
