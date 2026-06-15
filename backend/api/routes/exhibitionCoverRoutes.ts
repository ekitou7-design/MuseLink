import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { uploadExhibitionCover, uploadExhibitionCoverFile } from "../controllers/exhibitionCoversController";

export const exhibitionCoverRoutes = Router();

exhibitionCoverRoutes.post(
  "/api/exhibition-covers/upload",
  requireAuth,
  uploadExhibitionCoverFile,
  uploadExhibitionCover,
);
exhibitionCoverRoutes.post(
  "/exhibition-covers/upload",
  requireAuth,
  uploadExhibitionCoverFile,
  uploadExhibitionCover,
);
