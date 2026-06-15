import { Router } from "express";
import { requireAdmin } from "../../auth";
import {
  createArtifact,
  deleteArtifact,
  getArtifact,
  listArtifacts,
  ragSearchArtifacts,
  searchArtifacts,
  updateArtifact,
  uploadArtifactImage,
  uploadArtifactImageFile,
  uploadArtifactImageFromUrl,
} from "../controllers/artifactsController";

export const artifactRoutes = Router();

artifactRoutes.get("/api/relics/search", searchArtifacts);
artifactRoutes.get("/relics/search", searchArtifacts);
artifactRoutes.post("/api/rag/search", ragSearchArtifacts);
artifactRoutes.post("/rag/search", ragSearchArtifacts);
artifactRoutes.get("/artifacts/search", searchArtifacts);
artifactRoutes.get("/api/artifacts/search", searchArtifacts);
artifactRoutes.post("/api/artifacts", requireAdmin, createArtifact);
artifactRoutes.post("/artifacts", requireAdmin, createArtifact);
artifactRoutes.post("/api/admin/artifacts/:id/image", requireAdmin, uploadArtifactImageFile, uploadArtifactImage);
artifactRoutes.post("/admin/artifacts/:id/image", requireAdmin, uploadArtifactImageFile, uploadArtifactImage);
artifactRoutes.post("/api/admin/artifacts/:id/image-url", requireAdmin, uploadArtifactImageFromUrl);
artifactRoutes.post("/admin/artifacts/:id/image-url", requireAdmin, uploadArtifactImageFromUrl);
artifactRoutes.put("/api/artifacts/:id", requireAdmin, updateArtifact);
artifactRoutes.put("/artifacts/:id", requireAdmin, updateArtifact);
artifactRoutes.delete("/api/artifacts/:id", requireAdmin, deleteArtifact);
artifactRoutes.delete("/artifacts/:id", requireAdmin, deleteArtifact);
artifactRoutes.get("/api/artifacts/:id", getArtifact);
artifactRoutes.get("/artifacts/:id", getArtifact);
artifactRoutes.get("/api/artifacts", listArtifacts);
artifactRoutes.get("/artifacts", listArtifacts);
artifactRoutes.get("/artifact/:id", getArtifact);
