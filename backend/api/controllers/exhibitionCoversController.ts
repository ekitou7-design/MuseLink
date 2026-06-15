import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import type { Request, RequestHandler, Response } from "express";
import multer from "multer";
import sharp from "sharp";

const EXHIBITION_COVERS_DIR = path.join(process.cwd(), "public", "exhibition-covers");
const EXHIBITION_COVER_UPLOADS_DIR = path.join(EXHIBITION_COVERS_DIR, "uploads");
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const multerExhibitionCoverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("仅支持 jpg/jpeg/png/webp 图片。"));
      return;
    }
    cb(null, true);
  },
}).single("image");

export const uploadExhibitionCoverFile: RequestHandler = (req, res, next) => {
  multerExhibitionCoverUpload(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
    return next();
  });
};

export async function uploadExhibitionCover(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "请先选择要上传的图片。" });
    }

    await fs.mkdir(EXHIBITION_COVER_UPLOADS_DIR, { recursive: true });
    const filename = `cover-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.webp`;
    const outputPath = path.join(EXHIBITION_COVER_UPLOADS_DIR, filename);

    await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1600, height: 2200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86 })
      .toFile(outputPath);

    return res.json({ coverUrl: `/exhibition-covers/uploads/${filename}` });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
