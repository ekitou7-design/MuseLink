import express from "express";
import dotenv from "dotenv";
import path from "path";
import { authRoutes } from "./routes/authRoutes";
import { artifactRoutes } from "./routes/artifactRoutes";
import { exhibitionRoutes } from "./routes/exhibitionRoutes";
import { likeRoutes } from "./routes/likeRoutes";
import { museumRoutes } from "./routes/museumRoutes";
import { db } from "./db/client";
import { migrateArtifactDetails } from "./db/migrateArtifactDetails";
import { upgradeArtifactsMuseumFk } from "./db/upgradeArtifactsMuseumFk";
import { syncImportedArtifactsToDb } from "./db/syncImportedArtifacts";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const app = express();

app.use((req, res, next) => {
  const allowedOrigin = process.env.CORS_ORIGIN || req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/", (_req, res) =>
  res.json({
    ok: true,
    service: "MuseLink backend API",
    health: "/health",
    artifacts: "/api/artifacts",
    search: "/api/relics/search?keyword=禁止出国",
    museums: "/api/museums",
  }),
);

// API Routes (as requested, no /api prefix)
app.use(authRoutes);
app.use(artifactRoutes);
app.use(exhibitionRoutes);
app.use(likeRoutes);
app.use(museumRoutes);

const port = Number(process.env.BACKEND_PORT || 4000);
app.listen(port, "0.0.0.0", () => {
  console.log(`MuseLink backend listening on http://localhost:${port}`);
});

// Legacy DB upgrade (PostgreSQL). Do not seed sample artifacts here: API results must reflect the connected DB only.
(async () => {
  try {
    const up = await upgradeArtifactsMuseumFk(db);
    if (up.migrated) {
      console.log("Upgraded DB: artifacts.museum → museum_id + museums");
    }
    await migrateArtifactDetails(db);
    const sync = await syncImportedArtifactsToDb(db);
    if (!sync.skipped) {
      console.log(`Synced imported artifacts to DB: ${sync.importedCount} file rows, ${sync.inserted} inserted, ${sync.updated} updated`);
    }
  } catch (err) {
    console.error("DB upgrade failed:", err);
  }
})();
