import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type AuthedRequest = Request & { auth?: { userId: number; userNumber: number } };

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET. Put it in .env.local");
  return secret;
}

export function signToken(payload: { userId: number; userNumber: number }) {
  return jwt.sign(payload, jwtSecret(), { expiresIn: "7d" });
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }
  try {
    const token = header.slice("Bearer ".length);
    const decoded = jwt.verify(token, jwtSecret()) as any;
    const userId = Number(decoded.userId);
    const userNumber = Number(decoded.userNumber);
    if (!Number.isFinite(userId) || !Number.isFinite(userNumber)) {
      return res.status(401).json({ error: "Invalid token" });
    }
    req.auth = { userId, userNumber };
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

