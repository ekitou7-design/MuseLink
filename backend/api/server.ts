import express from "express";
import dotenv from "dotenv";
import path from "path";
import { authRoutes } from "./routes/authRoutes";
import { artifactRoutes } from "./routes/artifactRoutes";
import { exhibitionRoutes } from "./routes/exhibitionRoutes";
import { exhibitionCoverRoutes } from "./routes/exhibitionCoverRoutes";
import { likeRoutes } from "./routes/likeRoutes";
import { museumRoutes } from "./routes/museumRoutes";
import { db } from "./db/client";
import { migrateArtifactDetails } from "./db/migrateArtifactDetails";
import { upgradeArtifactsMuseumFk } from "./db/upgradeArtifactsMuseumFk";
import { syncImportedArtifactsToDb } from "./db/syncImportedArtifacts";
import { ensureMuseumSchema, seedBuiltInMuseumAliases } from "../museum-normalizer";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const app = express();
const PUBLIC_DIR = path.join(process.cwd(), "public");

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
app.use("/artifact-images", express.static(path.join(PUBLIC_DIR, "artifact-images")));
app.use("/exhibition-covers", express.static(path.join(PUBLIC_DIR, "exhibition-covers")));
app.use("/museum-images", express.static(path.join(PUBLIC_DIR, "museum-images")));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/", (_req, res) =>
  res.json({
    ok: true,
    service: "MuseLink backend API",
    health: "/health",
    upload: "/upload",
    artifacts: "/api/artifacts",
    search: "/api/relics/search?keyword=禁止出国",
    museums: "/api/museums",
  }),
);

app.get("/upload", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MuseLink 图片上传</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #111827; }
    main { max-width: 960px; margin: 48px auto; padding: 0 20px; }
    section { background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06); }
    section + section { margin-top: 24px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    h2 { margin: 0 0 8px; font-size: 20px; }
    p { margin: 0 0 20px; color: #6b7280; line-height: 1.6; }
    label { display: block; margin-top: 16px; font-weight: 800; font-size: 14px; }
    input { box-sizing: border-box; width: 100%; margin-top: 8px; border: 1px solid #d1d5db; border-radius: 12px; padding: 12px; font-size: 14px; background: white; }
    button { margin-top: 20px; border: 0; border-radius: 12px; padding: 12px 18px; background: #111827; color: white; font-weight: 900; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    pre { white-space: pre-wrap; word-break: break-word; background: #f3f4f6; border-radius: 12px; padding: 16px; margin-top: 20px; color: #374151; }
    .hint { margin-top: 10px; font-size: 12px; color: #6b7280; }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: end; }
    .row button { min-width: 180px; }
    .ok { color: #047857; }
    .error { color: #b91c1c; }
    .preview { display: none; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
    .preview img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 12px; border: 1px solid #e5e7eb; background: #f3f4f6; }
    @media (max-width: 720px) { .row { grid-template-columns: 1fr; } .row button { width: 100%; } }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>MuseLink 文物图片上传</h1>
      <p>输入文物 artifactId，选择本地图片或粘贴图片直链。图片会写入 public/artifact-images，并同步 data/imported-artifacts.json；如数据库可用，也会同步 artifacts 表。</p>
      <form id="uploadForm">
        <label for="artifactId">artifactId</label>
        <input id="artifactId" name="artifactId" placeholder="例如 ncha-third-001-166d402e" required />
        <label for="token">管理员 token</label>
        <input id="token" name="token" placeholder="从前台登录后台后会自动读取；也可以手动粘贴" />
        <div class="hint">如果提示 Missing Authorization Bearer token，请先登录前台后台管理，或把 localStorage 里的 muselink_token 粘贴到这里。</div>
        <label for="image">图片文件</label>
        <input id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
        <button id="submitButton" type="submit">上传</button>
      </form>
      <div class="row">
        <label for="artifactImageUrl">图片链接
          <input id="artifactImageUrl" name="artifactImageUrl" placeholder="粘贴图片链接：https://..." />
        </label>
        <button id="artifactUrlButton" type="button">从链接下载</button>
      </div>
      <div class="hint">文件上传会调用 POST /api/admin/artifacts/{artifactId}/image；链接下载会调用 /api/admin/artifacts/{artifactId}/image-url。</div>
      <pre id="result">等待上传...</pre>
      <div id="preview" class="preview">
        <img id="fullPreview" alt="上传后的原图预览" />
        <img id="thumbPreview" alt="上传后的缩略图预览" />
      </div>
    </section>
    <section>
      <h2>MuseLink 博物馆封面上传</h2>
      <p>输入博物馆 museumId，选择本地图片或粘贴图片直链。封面会写入 public/museum-images/{museumId}/cover.jpg 和 thumbs/cover-thumb.jpg，并同步 museums 表。</p>
      <form id="museumCoverForm">
        <label for="museumId">museumId</label>
        <input id="museumId" name="museumId" placeholder="例如 2" required />
        <label for="museumCoverImage">封面图片文件</label>
        <input id="museumCoverImage" name="museumCoverImage" type="file" accept="image/jpeg,image/png,image/webp" />
        <button id="museumCoverUploadButton" type="submit">上传/替换封面</button>
      </form>
      <div class="row">
        <label for="museumCoverImageUrl">图片链接
          <input id="museumCoverImageUrl" name="museumCoverImageUrl" placeholder="粘贴图片链接：https://..." />
        </label>
        <button id="museumCoverUrlButton" type="button">从链接下载封面</button>
      </div>
      <div class="hint">文件上传会调用 POST /api/admin/museums/{museumId}/cover；链接下载会调用 /api/admin/museums/{museumId}/cover-url。</div>
      <pre id="museumCoverResult">等待上传...</pre>
      <div id="museumCoverPreview" class="preview">
        <img id="museumCoverFullPreview" alt="上传后的博物馆封面原图预览" />
        <img id="museumCoverThumbPreview" alt="上传后的博物馆封面缩略图预览" />
      </div>
    </section>
  </main>
  <script>
    const form = document.getElementById("uploadForm");
    const button = document.getElementById("submitButton");
    const artifactUrlButton = document.getElementById("artifactUrlButton");
    const result = document.getElementById("result");
    const tokenInput = document.getElementById("token");
    const preview = document.getElementById("preview");
    const fullPreview = document.getElementById("fullPreview");
    const thumbPreview = document.getElementById("thumbPreview");
    const museumCoverForm = document.getElementById("museumCoverForm");
    const museumCoverUploadButton = document.getElementById("museumCoverUploadButton");
    const museumCoverUrlButton = document.getElementById("museumCoverUrlButton");
    const museumCoverResult = document.getElementById("museumCoverResult");
    const museumCoverPreview = document.getElementById("museumCoverPreview");
    const museumCoverFullPreview = document.getElementById("museumCoverFullPreview");
    const museumCoverThumbPreview = document.getElementById("museumCoverThumbPreview");

    tokenInput.value = localStorage.getItem("muselink_token") || "";

    async function parseJsonResponse(response) {
      const text = await response.text();
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 300) || "接口没有返回 JSON。");
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const artifactId = document.getElementById("artifactId").value.trim();
      const file = document.getElementById("image").files[0];
      if (!artifactId || !file) {
        result.className = "error";
        result.textContent = "请先填写 artifactId 并选择图片文件。";
        return;
      }

      const formData = new FormData();
      formData.set("image", file);
      button.disabled = true;
      result.className = "";
      result.textContent = "上传中...";
      preview.style.display = "none";

      try {
        const token = tokenInput.value.trim();
        const response = await fetch("/api/admin/artifacts/" + encodeURIComponent(artifactId) + "/image", {
          method: "POST",
          headers: token ? { Authorization: "Bearer " + token } : {},
          body: formData,
        });
        const data = await parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || "上传失败");
        const cacheBust = "?v=" + Date.now();
        fullPreview.src = data.localImageUrl + cacheBust;
        thumbPreview.src = data.localThumbnailUrl + cacheBust;
        preview.style.display = "grid";
        result.className = "ok";
        result.textContent =
          "上传成功\\n" +
          "文物名称：" + (data.artifactName || data.artifact?.name || "-") + "\\n" +
          "原图路径：" + data.localImageUrl + "\\n" +
          "缩略图路径：" + data.localThumbnailUrl + "\\n" +
          "前端刷新后会优先显示这张本地图片。";
      } catch (error) {
        result.className = "error";
        result.textContent = error instanceof Error ? error.message : String(error);
      } finally {
        button.disabled = false;
      }
    });

    artifactUrlButton.addEventListener("click", async () => {
      const artifactId = document.getElementById("artifactId").value.trim();
      const imageUrl = document.getElementById("artifactImageUrl").value.trim();
      if (!artifactId || !imageUrl) {
        result.className = "error";
        result.textContent = "请先填写 artifactId 和图片链接。";
        return;
      }

      artifactUrlButton.disabled = true;
      result.className = "";
      result.textContent = "下载中...";
      preview.style.display = "none";

      try {
        const token = tokenInput.value.trim();
        const response = await fetch("/api/admin/artifacts/" + encodeURIComponent(artifactId) + "/image-url", {
          method: "POST",
          headers: {
            ...(token ? { Authorization: "Bearer " + token } : {}),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageUrl }),
        });
        const data = await parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || "下载失败");
        showArtifactPreview(data);
        result.className = "ok";
        result.textContent =
          "下载成功\\n" +
          "文物名称：" + (data.artifactName || data.artifact?.name || "-") + "\\n" +
          "原图路径：" + data.localImageUrl + "\\n" +
          "缩略图路径：" + data.localThumbnailUrl + "\\n" +
          "前端刷新后会优先显示这张本地图片。";
      } catch (error) {
        result.className = "error";
        result.textContent = error instanceof Error ? error.message : String(error);
      } finally {
        artifactUrlButton.disabled = false;
      }
    });

    museumCoverForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const museumId = document.getElementById("museumId").value.trim();
      const file = document.getElementById("museumCoverImage").files[0];
      if (!museumId || !file) {
        museumCoverResult.className = "error";
        museumCoverResult.textContent = "请先填写 museumId 并选择封面图片文件。";
        return;
      }

      const formData = new FormData();
      formData.set("image", file);
      museumCoverUploadButton.disabled = true;
      museumCoverResult.className = "";
      museumCoverResult.textContent = "上传中...";
      museumCoverPreview.style.display = "none";

      try {
        const token = tokenInput.value.trim();
        const response = await fetch("/api/admin/museums/" + encodeURIComponent(museumId) + "/cover", {
          method: "POST",
          headers: token ? { Authorization: "Bearer " + token } : {},
          body: formData,
        });
        const data = await parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || "上传失败");
        showMuseumCoverPreview(data);
        museumCoverResult.className = "ok";
        museumCoverResult.textContent =
          "上传成功\\n" +
          "博物馆：" + (data.museum?.name || museumId) + "\\n" +
          "原图路径：" + data.localCoverImageUrl + "\\n" +
          "缩略图路径：" + data.localCoverThumbnailUrl;
      } catch (error) {
        museumCoverResult.className = "error";
        museumCoverResult.textContent = error instanceof Error ? error.message : String(error);
      } finally {
        museumCoverUploadButton.disabled = false;
      }
    });

    museumCoverUrlButton.addEventListener("click", async () => {
      const museumId = document.getElementById("museumId").value.trim();
      const imageUrl = document.getElementById("museumCoverImageUrl").value.trim();
      if (!museumId || !imageUrl) {
        museumCoverResult.className = "error";
        museumCoverResult.textContent = "请先填写 museumId 和图片链接。";
        return;
      }

      museumCoverUrlButton.disabled = true;
      museumCoverResult.className = "";
      museumCoverResult.textContent = "下载中...";
      museumCoverPreview.style.display = "none";

      try {
        const token = tokenInput.value.trim();
        const response = await fetch("/api/admin/museums/" + encodeURIComponent(museumId) + "/cover-url", {
          method: "POST",
          headers: {
            ...(token ? { Authorization: "Bearer " + token } : {}),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageUrl }),
        });
        const data = await parseJsonResponse(response);
        if (!response.ok) throw new Error(data.error || "下载失败");
        showMuseumCoverPreview(data);
        museumCoverResult.className = "ok";
        museumCoverResult.textContent =
          "下载成功\\n" +
          "博物馆：" + (data.museum?.name || museumId) + "\\n" +
          "原图路径：" + data.localCoverImageUrl + "\\n" +
          "缩略图路径：" + data.localCoverThumbnailUrl;
      } catch (error) {
        museumCoverResult.className = "error";
        museumCoverResult.textContent = error instanceof Error ? error.message : String(error);
      } finally {
        museumCoverUrlButton.disabled = false;
      }
    });

    function showArtifactPreview(data) {
      const cacheBust = "?v=" + Date.now();
      fullPreview.src = data.localImageUrl + cacheBust;
      thumbPreview.src = data.localThumbnailUrl + cacheBust;
      preview.style.display = "grid";
    }

    function showMuseumCoverPreview(data) {
      const cacheBust = "?v=" + Date.now();
      museumCoverFullPreview.src = data.localCoverImageUrl + cacheBust;
      museumCoverThumbPreview.src = data.localCoverThumbnailUrl + cacheBust;
      museumCoverPreview.style.display = "grid";
    }
  </script>
</body>
</html>`);
});

// API Routes (as requested, no /api prefix)
app.use(authRoutes);
app.use(artifactRoutes);
app.use(exhibitionCoverRoutes);
app.use(exhibitionRoutes);
app.use(likeRoutes);
app.use(museumRoutes);

const port = Number(process.env.BACKEND_PORT || 9999);
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
    await ensureMuseumSchema(db);
    await seedBuiltInMuseumAliases(db);
    await migrateArtifactDetails(db);
    const sync = await syncImportedArtifactsToDb(db);
    if (!sync.skipped) {
      console.log(`Synced imported artifacts to DB: ${sync.importedCount} file rows, ${sync.inserted} inserted, ${sync.updated} updated`);
    }
  } catch (err) {
    console.error("DB upgrade failed:", err);
  }
})();
