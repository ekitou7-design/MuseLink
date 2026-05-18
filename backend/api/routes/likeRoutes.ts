import { Router } from "express";
import { toggleLike } from "../controllers/likesController";
import { requireAuth } from "../middleware/auth";

export const likeRoutes = Router();

likeRoutes.post("/like", requireAuth, toggleLike);

