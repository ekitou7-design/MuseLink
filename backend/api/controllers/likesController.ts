import type { Response } from "express";
import { db } from "../db/client";
import type { AuthedRequest } from "../middleware/auth";
import type { LikeRow } from "../models/types";

export async function toggleLike(req: AuthedRequest, res: Response) {
  const targetType = req.body?.target_type as LikeRow["target_type"];
  const targetId = Number(req.body?.target_id);

  if (targetType !== "artifact" && targetType !== "exhibition") {
    return res.status(400).json({ error: "target_type must be artifact|exhibition" });
  }
  if (!Number.isFinite(targetId)) {
    return res.status(400).json({ error: "target_id must be a number" });
  }

  // toggle
  const exists = await db.query(
    `select 1 from likes where user_id=$1 and target_type=$2 and target_id=$3`,
    [req.auth!.userId, targetType, targetId],
  );
  if (exists.rowCount && exists.rowCount > 0) {
    await db.query(
      `delete from likes where user_id=$1 and target_type=$2 and target_id=$3`,
      [req.auth!.userId, targetType, targetId],
    );
    return res.json({ liked: false });
  }

  await db.query(
    `insert into likes (user_id, target_type, target_id) values ($1,$2,$3) on conflict do nothing`,
    [req.auth!.userId, targetType, targetId],
  );
  return res.json({ liked: true });
}

