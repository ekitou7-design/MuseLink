import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db/client";
import { signToken } from "../middleware/auth";
import type { UserRow } from "../models/types";

export async function register(req: Request, res: Response) {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (password.length < 6 || password.length > 64) {
    return res.status(400).json({ error: "password must be 6-64 chars" });
  }
  const passwordHash = await bcrypt.hash(password, 12);

  const inserted = await db.query<Pick<UserRow, "id" | "user_number" | "created_at">>(
    `insert into users (password_hash) values ($1)
     returning id, user_number, created_at`,
    [passwordHash],
  );
  const row = inserted.rows[0];
  return res.json({
    id: row.id,
    user_number: row.user_number,
    created_at: row.created_at,
  });
}

export async function login(req: Request, res: Response) {
  const userNumber = Number(req.body?.user_number);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!Number.isFinite(userNumber)) {
    return res.status(400).json({ error: "user_number must be a number" });
  }

  const found = await db.query<UserRow>(
    `select id, user_number, password_hash, created_at
     from users
     where user_number = $1`,
    [userNumber],
  );
  const user = found.rows[0];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ userId: user.id, userNumber: user.user_number });
  return res.json({ token, user: { id: user.id, user_number: user.user_number } });
}

