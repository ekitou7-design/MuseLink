import dns from "dns/promises";
import net from "net";

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGE_DOWNLOAD_BYTES = 10 * 1024 * 1024;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 12000;
const IMAGE_DOWNLOAD_USER_AGENT = "MuseLink/1.0 (educational cultural heritage project; contact: ekitou7@gmail.com)";
const IMAGE_DOWNLOAD_ACCEPT = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8";

function isDevRuntime() {
  return process.env.NODE_ENV !== "production";
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

function isPrivateAddress(address: string) {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

export async function assertSafeImageUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("图片链接格式无效。");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("图片链接必须是 http 或 https。");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("不允许下载 localhost 图片链接。");
  }

  const literalFamily = net.isIP(hostname);
  if (literalFamily && isPrivateAddress(hostname)) {
    throw new Error("不允许下载内网或本机图片链接。");
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("不允许下载解析到内网或本机地址的图片链接。");
  }

  return parsed.toString();
}

export async function readImageResponseBody(response: globalThis.Response) {
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_DOWNLOAD_BYTES) {
    throw new Error("图片不能超过 10MB。");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_DOWNLOAD_BYTES) throw new Error("图片不能超过 10MB。");
    return Buffer.from(arrayBuffer);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_IMAGE_DOWNLOAD_BYTES) {
      throw new Error("图片不能超过 10MB。");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function downloadImageBuffer(rawUrl: string, logLabel = "image-url-download") {
  const normalizedUrl = await assertSafeImageUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(normalizedUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": IMAGE_DOWNLOAD_USER_AGENT,
        Accept: IMAGE_DOWNLOAD_ACCEPT,
      },
    });
    const contentType = response.headers.get("content-type") || "";
    const contentLength = response.headers.get("content-length") || "";

    if (isDevRuntime()) {
      console.info(`[${logLabel}]`, {
        receivedUrl: rawUrl,
        normalizedUrl,
        "response.status": response.status,
        "response.headers.content-type": contentType,
        "response.headers.content-length": contentLength,
        "response.url": response.url,
      });
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("图片站点请求过于频繁，已被限流。请稍后重试，或手动下载后上传。");
      }
      throw new Error(`图片下载失败：HTTP ${response.status}`);
    }

    const mimeType = contentType.split(";")[0]?.trim().toLowerCase() || "";
    if (mimeType === "text/html") {
      throw new Error("该链接返回的是网页，不是图片文件。请复制图片直链，或手动上传图片。");
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType) && mimeType !== "image/jpg") {
      throw new Error("图片链接仅支持 jpg/jpeg/png/webp/gif 图片。");
    }

    return { buffer: await readImageResponseBody(response), sourceImageUrl: response.url || normalizedUrl };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("下载图片超时。");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
