import { Router } from "express";
import { createAiExhibition, getExhibition, listExhibitions } from "../controllers/exhibitionsController";
import { requireAuth } from "../middleware/auth";

export const exhibitionRoutes = Router();

exhibitionRoutes.post("/exhibition", requireAuth, createAiExhibition);
exhibitionRoutes.get("/exhibitions", listExhibitions);
exhibitionRoutes.get("/exhibition/:id", getExhibition);
exhibitionRoutes.post("/api/exhibition", requireAuth, createAiExhibition);
exhibitionRoutes.get("/api/exhibitions", listExhibitions);
exhibitionRoutes.get("/api/exhibition/:id", getExhibition);
