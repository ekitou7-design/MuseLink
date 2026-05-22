import { Router } from "express";
import { getArtifact, listArtifacts, searchArtifacts } from "../controllers/artifactsController";

export const artifactRoutes = Router();

artifactRoutes.get("/api/relics/search", searchArtifacts);
artifactRoutes.get("/relics/search", searchArtifacts);
artifactRoutes.get("/artifacts/search", searchArtifacts);
artifactRoutes.get("/api/artifacts/search", searchArtifacts);
artifactRoutes.get("/api/artifacts/:id", getArtifact);
artifactRoutes.get("/artifacts/:id", getArtifact);
artifactRoutes.get("/api/artifacts", listArtifacts);
artifactRoutes.get("/artifacts", listArtifacts);
artifactRoutes.get("/artifact/:id", getArtifact);
