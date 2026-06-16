import { Router } from "express";
import { requireAdmin } from "../../auth";
import {
  addMuseumAlias,
  deleteMuseumAlias,
  deleteMuseumCover,
  getMuseum,
  getMuseumDuplicates,
  listMuseumArtifacts,
  listMuseums,
  mergeMuseum,
  updateMuseum,
  uploadMuseumCover,
  uploadMuseumCoverFile,
} from "../controllers/museumsController";

export const museumRoutes = Router();

museumRoutes.get("/museums", listMuseums);
museumRoutes.get("/museum/:id", getMuseum);
museumRoutes.get("/api/museums", listMuseums);
museumRoutes.get("/api/museums/:id", getMuseum);
museumRoutes.get("/api/museum/:id", getMuseum);

museumRoutes.get("/api/admin/museums", requireAdmin, listMuseums);
museumRoutes.get("/api/admin/museums/duplicates", requireAdmin, getMuseumDuplicates);
museumRoutes.get("/api/admin/museums/:id", requireAdmin, getMuseum);
museumRoutes.put("/api/admin/museums/:id", requireAdmin, updateMuseum);
museumRoutes.post("/api/admin/museums/:id/cover", requireAdmin, uploadMuseumCoverFile, uploadMuseumCover);
museumRoutes.delete("/api/admin/museums/:id/cover", requireAdmin, deleteMuseumCover);
museumRoutes.post("/api/admin/museums/:id/aliases", requireAdmin, addMuseumAlias);
museumRoutes.delete("/api/admin/museums/:id/aliases/:aliasId", requireAdmin, deleteMuseumAlias);
museumRoutes.post("/api/admin/museums/:id/merge", requireAdmin, mergeMuseum);
museumRoutes.get("/api/admin/museums/:id/artifacts", requireAdmin, listMuseumArtifacts);
