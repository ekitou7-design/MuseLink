from flask import Flask, request, render_template_string, redirect, jsonify
import ast
import ipaddress
import json
import os
import time
import uuid
from collections import Counter
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen

import pandas as pd

app = Flask(__name__)

# Original standalone backend management site.
# It now uses the unified Node backend API, whose artifact endpoints read/write
# the unified PostgreSQL/pg-mem artifacts table.
API_BASE_URL = os.environ.get("MUSELINK_API_BASE_URL", "http://localhost:3000").rstrip("/")
ADMIN_MUSE_ID = os.environ.get("MUSELINK_ADMIN_MUSE_ID", "jiangzhong")
ADMIN_PASSWORD = os.environ.get("MUSELINK_ADMIN_PASSWORD", "jiangzhong")
IMAGE_DOWNLOAD_USER_AGENT = "MuseLink/1.0 (educational cultural heritage project; contact: ekitou7@gmail.com)"
IMAGE_DOWNLOAD_ACCEPT = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"

MUSEUM_KEYS = ("所属博物馆", "博物馆", "馆藏单位", "收藏单位", "馆名", "museum", "museumName", "馆藏")
ARTIFACT_IMAGE_PUBLIC_DIR = os.path.join(os.getcwd(), "public", "artifact-images")
BULK_IMAGE_DOWNLOAD_REPORT_PATH = os.path.join(os.getcwd(), "data", "bulk-image-download-report.json")
IMAGE_MODE_LABELS = {
    "all": "全部文物",
    "no-image": "完全无图",
    "remote-only": "仅有外链图",
    "local-broken": "本地图异常",
    "local-complete": "本地图已完成",
    "no-local": "无本地图",
}


def clean_value(value):
    if value is None:
        return ""
    text = str(value).replace("`", "").strip()
    if text.lower() in ("", "nan", "none", "null", "undefined"):
        return ""
    return text


def is_placeholder_image_url(value):
    text = clean_value(value).lower()
    if not text:
        return False
    markers = (
        "placeholder",
        "placehold",
        "占位",
        "no-image",
        "no_image",
        "noimage",
        "fallback",
        "default-image",
        "default_image",
        "暂无信息",
    )
    return any(marker in text for marker in markers)


def is_usable_image_url(value):
    text = clean_value(value)
    return bool(text) and not is_placeholder_image_url(text)


def local_artifact_image_exists(value):
    url = clean_value(value).split("?", 1)[0]
    if not url.startswith("/artifact-images/"):
        return None
    relative_path = url.replace("/artifact-images/", "", 1)
    physical_path = os.path.abspath(os.path.join(ARTIFACT_IMAGE_PUBLIC_DIR, relative_path))
    public_root = os.path.abspath(ARTIFACT_IMAGE_PUBLIC_DIR)
    if not physical_path.startswith(public_root + os.sep):
        return None
    return os.path.exists(physical_path)


def pick(item, *keys):
    for key in keys:
        value = clean_value(item.get(key))
        if value:
            return value
    return ""


def api_request(path, method="GET", payload=None, auth=False):
    url = f"{API_BASE_URL}{path}"
    body = None
    headers = {"Content-Type": "application/json"}

    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    if auth:
        headers["Authorization"] = f"Bearer {get_admin_token()}"

    req = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(req, timeout=20) as response:
            content = response.read().decode("utf-8")
            return json.loads(content) if content else {}
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"{method} {url} failed: {error.code} {detail}") from error
    except URLError as error:
        raise RuntimeError(f"无法连接后端 API：{url}。请先启动 npm run dev。") from error


def bearer_token_from_request():
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header.split(" ", 1)[1].strip()
    return ""


def get_admin_token():
    response = api_request(
        "/api/auth/login",
        method="POST",
        payload={"museId": ADMIN_MUSE_ID, "password": ADMIN_PASSWORD},
        auth=False,
    )
    token = response.get("token")
    if not token:
        raise RuntimeError("管理员登录失败，无法获取 token。")
    return token


def is_private_literal_hostname(hostname):
    if not hostname:
        return True
    if hostname.lower() == "localhost" or hostname.lower().endswith(".localhost"):
        return True

    try:
        literal = ipaddress.ip_address(hostname)
        return literal.is_private or literal.is_loopback or literal.is_link_local or literal.is_multicast
    except ValueError:
        return False


def validate_image_url(image_url):
    parsed = urlparse(image_url)
    if parsed.scheme not in ("http", "https"):
        raise RuntimeError("图片链接必须是 http 或 https。")
    if is_private_literal_hostname(parsed.hostname or ""):
        raise RuntimeError("不允许下载 localhost、内网或本机图片链接。")


def is_dev_runtime():
    return os.environ.get("FLASK_ENV") != "production" and os.environ.get("NODE_ENV") != "production"


def log_image_download_debug(**payload):
    if is_dev_runtime():
        print("[artifact-image-url-download]", json.dumps(payload, ensure_ascii=False), flush=True)


def download_image_bytes(image_url):
    validate_image_url(image_url)
    normalized_url = clean_value(image_url)
    req = Request(
        normalized_url,
        headers={
            "User-Agent": IMAGE_DOWNLOAD_USER_AGENT,
            "Accept": IMAGE_DOWNLOAD_ACCEPT,
        },
    )
    try:
        with urlopen(req, timeout=15) as response:
            content_type = response.headers.get("Content-Type", "").split(";")[0].strip().lower()
            content_length = clean_value(response.headers.get("Content-Length"))
            status = getattr(response, "status", 200)
            response_url = response.geturl()
            log_image_download_debug(
                receivedUrl=image_url,
                normalizedUrl=normalized_url,
                **{
                    "response.status": status,
                    "response.headers.content-type": content_type,
                    "response.headers.content-length": content_length,
                    "response.url": response_url,
                },
            )
            if content_type == "image/jpg":
                content_type = "image/jpeg"
            if content_type == "text/html":
                raise RuntimeError("该链接返回的是网页，不是图片文件。请复制图片直链，或手动上传图片。")
            if content_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
                raise RuntimeError("图片链接仅支持 jpg/jpeg/png/webp/gif 图片。")

            if content_length and int(content_length) > 10 * 1024 * 1024:
                raise RuntimeError("图片不能超过 10MB。")

            data = response.read(10 * 1024 * 1024 + 1)
            if len(data) > 10 * 1024 * 1024:
                raise RuntimeError("图片不能超过 10MB。")
            return data, content_type
    except HTTPError as error:
        content_type = error.headers.get("Content-Type", "").split(";")[0].strip().lower()
        content_length = clean_value(error.headers.get("Content-Length"))
        log_image_download_debug(
            receivedUrl=image_url,
            normalizedUrl=normalized_url,
            **{
                "response.status": error.code,
                "response.headers.content-type": content_type,
                "response.headers.content-length": content_length,
                "response.url": error.url,
            },
        )
        if error.code == 429:
            raise RuntimeError("图片站点请求过于频繁，已被限流。请稍后重试，或手动下载后上传。") from error
        if content_type == "text/html":
            raise RuntimeError("该链接返回的是网页，不是图片文件。请复制图片直链，或手动上传图片。") from error
        raise RuntimeError(f"图片下载失败：HTTP {error.code}") from error
    except URLError as error:
        raise RuntimeError(f"下载图片失败：{error.reason}") from error


def post_image_file_to_backend(artifact_id, image_bytes, content_type, token):
    boundary = f"----MuseLink{uuid.uuid4().hex}"
    filename = "downloaded-image.jpg"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="{filename}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode("utf-8") + image_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = Request(
        f"{API_BASE_URL}/api/admin/artifacts/{quote(artifact_id)}/image",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=30) as response:
            content = response.read().decode("utf-8", errors="ignore")
            return json.loads(content) if content else {}
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="ignore")[:300]
        raise RuntimeError(f"上传图片到后端失败：HTTP {error.code} {detail}") from error
    except URLError as error:
        raise RuntimeError(f"无法连接后端图片上传接口：{error.reason}") from error


def save_artifact_source_image_url(artifact_id, image_url):
    detail = api_request(f"/api/artifacts/{quote(artifact_id)}").get("artifact") or {}
    row = artifact_to_row(detail)
    payload = build_payload(
        {
            "name": row["文物名称"],
            "museum": row["所属博物馆"],
            "period": row["朝代"],
            "category": row["类别"],
            "level": row["等级"],
            "material": row["材质"],
            "dimensions": row["尺寸"],
            "short_intro": row["一句话简介"],
            "image_url": image_url,
            "source_url": row["来源链接"],
            "tags": row["标签"],
            "description": row["文物描述"],
        }
    )
    api_request(f"/api/artifacts/{quote(artifact_id)}", method="PUT", payload=payload, auth=True)


def downloadArtifactImageFromUrl(artifact, image_url, token):
    artifact_id = clean_value(artifact.get("_artifact_id") or artifact.get("id"))
    if not artifact_id:
        raise RuntimeError("缺少文物 ID。")

    image_bytes, content_type = download_image_bytes(image_url)
    result = post_image_file_to_backend(artifact_id, image_bytes, content_type, token)
    save_artifact_source_image_url(artifact_id, image_url)
    return {
        **result,
        "imageUrl": image_url,
        "sourceImageUrl": image_url,
        "flaskDownloaded": True,
    }


def write_bulk_image_download_report(records, summary=None):
    os.makedirs(os.path.dirname(BULK_IMAGE_DOWNLOAD_REPORT_PATH), exist_ok=True)
    payload = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "summary": summary or {},
        "records": records,
    }
    with open(BULK_IMAGE_DOWNLOAD_REPORT_PATH, "w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
    return BULK_IMAGE_DOWNLOAD_REPORT_PATH


def read_bulk_image_download_report():
    try:
        with open(BULK_IMAGE_DOWNLOAD_REPORT_PATH, "r", encoding="utf-8") as file:
            payload = json.load(file)
            return payload if isinstance(payload, dict) else {}
    except FileNotFoundError:
        return {}


def normalize_tags(tags):
    if not isinstance(tags, list):
        return []
    normalized = []
    for tag in tags:
        if isinstance(tag, dict):
            name = clean_value(tag.get("name"))
        else:
            name = clean_value(tag)
        if name:
            normalized.append(name)
    return normalized


def attribute_value(artifact, name):
    for group in artifact.get("attributes") or []:
        for item in group.get("items") or []:
            if clean_value(item.get("name")) == name:
                return clean_value(item.get("value"))
    return ""


def artifact_to_row(artifact):
    museum = pick(artifact, "museumName", "museum", "所属博物馆", "博物馆")
    dynasty = pick(artifact, "dynasty", "period", "era", "朝代", "年代")
    local_image_url = pick(artifact, "localImageUrl", "local_image_url")
    local_thumbnail_url = pick(artifact, "localThumbnailUrl", "local_thumbnail_url")
    image_url = pick(artifact, "imageUrl", "image_url", "图片链接")
    thumbnail_url = pick(artifact, "thumbnailUrl", "thumbnail_url", "thumbnail")
    has_local_image = is_usable_image_url(local_image_url) or is_usable_image_url(local_thumbnail_url)
    has_remote_image = is_usable_image_url(image_url) or is_usable_image_url(thumbnail_url)
    has_missing_local_file = (
        (is_usable_image_url(local_image_url) and local_artifact_image_exists(local_image_url) is False)
        or (is_usable_image_url(local_thumbnail_url) and local_artifact_image_exists(local_thumbnail_url) is False)
    )

    if has_local_image and has_missing_local_file:
        image_status = "本地图异常"
        image_status_key = "local-broken"
    elif has_local_image:
        image_status = "本地图"
        image_status_key = "local-complete"
    elif has_remote_image:
        image_status = "仅有外链图"
        image_status_key = "remote-only"
    else:
        image_status = "完全无图"
        image_status_key = "no-image"

    row = {
        "_artifact_id": clean_value(artifact.get("id")),
        "id": clean_value(artifact.get("id")),
        "文物名称": pick(artifact, "name", "文物名称", "名称"),
        "所属博物馆": museum,
        "朝代": dynasty,
        "类别": pick(artifact, "category", "类别", "文物类别"),
        "等级": pick(artifact, "level", "等级") or attribute_value(artifact, "等级"),
        "材质": pick(artifact, "material", "材质") or attribute_value(artifact, "材质"),
        "尺寸": pick(artifact, "dimensions", "size", "尺寸") or attribute_value(artifact, "尺寸"),
        "一句话简介": pick(artifact, "shortIntro", "short_intro", "一句话简介"),
        "文物描述": pick(artifact, "description", "文物描述", "简介"),
        "图片链接": image_url,
        "缩略图链接": thumbnail_url,
        "本地原图": local_image_url,
        "本地缩略图": local_thumbnail_url,
        "显示图片": local_thumbnail_url or local_image_url or thumbnail_url or image_url,
        "图片状态": image_status,
        "图片状态Key": image_status_key,
        "有本地图": has_local_image,
        "有可用图片": has_local_image or has_remote_image,
        "本地文件缺失": has_missing_local_file,
        "建议下载链接": thumbnail_url or image_url,
        "来源链接": pick(artifact, "sourceUrl", "source_url", "来源链接"),
        "标签": "，".join(normalize_tags(artifact.get("tags"))),
    }
    row["__source_file"] = "artifacts 表"
    row["__import_batch"] = "database"
    return row


def load_data(query=""):
    params = {"limit": "10000"}
    if query:
        params["q"] = query
    response = api_request(f"/api/artifacts?{urlencode(params)}")
    artifacts = response.get("artifacts") or []
    return [artifact_to_row(artifact) for artifact in artifacts]


def filter_rows_by_image_mode(rows, mode):
    if mode == "no-local":
        return [row for row in rows if not row.get("有本地图")]
    if mode in ("no-image", "remote-only", "local-broken", "local-complete"):
        return [row for row in rows if row.get("图片状态Key") == mode]
    return rows


def image_mode_counts(rows):
    counts = {mode: 0 for mode in IMAGE_MODE_LABELS}
    counts["all"] = len(rows)
    for row in rows:
        status_key = clean_value(row.get("图片状态Key"))
        if status_key in counts:
            counts[status_key] += 1
        if not row.get("有本地图"):
            counts["no-local"] += 1
    return counts


def detect_museum(item, default_museum=None):
    return pick(item, *MUSEUM_KEYS) or clean_value(item.get("__default_museum")) or clean_value(default_museum) or "未知博物馆"


def get_batch_summaries(data):
    batches = {}
    for item in data:
        batch_id = clean_value(item.get("__import_batch")) or "database"
        source_file = clean_value(item.get("__source_file")) or "artifacts 表"
        museum = detect_museum(item)
        if batch_id not in batches:
            batches[batch_id] = {
                "id": batch_id,
                "source_file": source_file,
                "imported_at": "",
                "count": 0,
                "museums": Counter(),
            }
        batches[batch_id]["count"] += 1
        batches[batch_id]["museums"][museum] += 1

    summaries = []
    for batch in batches.values():
        museum_text = "、".join([f"{museum}({count})" for museum, count in batch["museums"].most_common()])
        summaries.append({**batch, "museum_text": museum_text})
    return summaries


def get_museum_summaries(data):
    return Counter(detect_museum(item) for item in data).most_common()


def parse_selected_ids(form):
    return [clean_value(value) for value in form.getlist("selected") if clean_value(value)]


def parse_tags(value):
    return [tag.strip() for tag in clean_value(value).replace("、", "，").replace(",", "，").split("，") if tag.strip()]


def build_payload(form):
    material = clean_value(form.get("material"))
    dimensions = clean_value(form.get("dimensions"))
    level = clean_value(form.get("level"))
    remarks = clean_value(form.get("remarks"))
    attributes = [
        {
            "group": "基础信息",
            "items": [
                {"name": "材质", "value": material},
                {"name": "尺寸", "value": dimensions},
                {"name": "等级", "value": level},
            ],
        },
        {"group": "其他信息", "items": [{"name": "备注", "value": remarks}]},
    ]

    for group in attributes:
        group["items"] = [item for item in group["items"] if clean_value(item["value"])]

    return {
        "name": clean_value(form.get("name")),
        "museum": clean_value(form.get("museum")),
        "dynasty": clean_value(form.get("period")),
        "category": clean_value(form.get("category")),
        "shortIntro": clean_value(form.get("short_intro")),
        "description": clean_value(form.get("description")),
        "imageUrl": clean_value(form.get("image_url")),
        "sourceUrl": clean_value(form.get("source_url")),
        "tags": parse_tags(form.get("tags")),
        "attributes": [group for group in attributes if group["items"]],
    }


def absolute_api_url(path):
    if not path:
        return ""
    if path.startswith(("http://", "https://")):
        return path
    return f"{API_BASE_URL}{path if path.startswith('/') else '/' + path}"


def parse_attributes(item):
    raw_attributes = item.get("attributes") or item.get("扩展属性") or item.get("扩展信息")
    if isinstance(raw_attributes, list):
        return raw_attributes
    if isinstance(raw_attributes, str) and raw_attributes.strip():
        try:
            parsed = json.loads(raw_attributes)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def import_record_payload(item, default_museum=None):
    record = dict(item)
    if default_museum:
        record["__default_museum"] = default_museum
    return record


def load_records_from_upload(file):
    filename = file.filename or ""
    if filename.endswith(".csv"):
        return pd.read_csv(file).astype(str).to_dict(orient="records")
    if filename.endswith((".xlsx", ".xls")):
        return pd.read_excel(file).astype(str).to_dict(orient="records")

    content = file.read().decode("utf-8").strip()
    try:
        parsed = json.loads(content)
    except Exception:
        parsed = ast.literal_eval(content.replace("`", ""))
    return parsed if isinstance(parsed, list) else [parsed]


HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>博悟 (MuseLink) - 数字博物馆管理后台</title>
    <style>
        body { font-family: "STKaiti", "楷体", serif; margin: 0; background-color: #f4f1ea; color: #4a3728; }
        .header { background-color: #8b4513; color: #f4f1ea; padding: 30px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.2); }
        .container { padding: 30px; max-width: 1180px; margin: auto; }
        .card { background: white; padding: 25px; border-radius: 10px; border: 1px solid #d2b48c; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 30px; }
        .upload-zone { border: 2px dashed #8b4513; padding: 24px; text-align: center; background-color: #fffaf0; border-radius: 8px; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; background: white; border: 1px solid #8b4513; font-size: 14px; }
        th, td { border: 1px solid #d2b48c; padding: 10px; text-align: left; vertical-align: top; }
        th { background-color: #8b4513; color: #f4f1ea; position: sticky; top: 0; z-index: 1; }
        input, textarea, select { padding: 10px; border: 1px solid #d2b48c; border-radius: 5px; color: #4a3728; box-sizing: border-box; }
        .btn { background-color: #8b4513; color: white; padding: 10px 22px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; text-decoration: none; display: inline-block; }
        .btn-clear { background-color: #c0392b; }
        .btn-secondary { background-color: #f4f1ea; color: #4a3728; border: 1px solid #d2b48c; }
        .toolbar { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-top: 12px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 12px; }
        .summary-item { border: 1px solid #ead7bd; border-radius: 8px; padding: 12px; background: #fffaf0; }
        .summary-title { font-weight: bold; color: #4a3728; }
        .summary-meta { color: #8b4513; font-size: 14px; margin-top: 6px; line-height: 1.5; }
        .danger-zone, .bulk-zone { border: 1px solid #e6b0aa; background: #fff5f5; border-radius: 8px; padding: 16px; margin-top: 20px; }
        .edit-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
        .field label { display: block; font-weight: bold; margin-bottom: 6px; }
        .field input, .field textarea { width: 100%; }
        .field textarea { min-height: 90px; resize: vertical; }
        .muted { color: #8b4513; font-size: 14px; }
        .thumb { width: 72px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid #d2b48c; background: #fffaf0; }
        .filter-tabs { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
        .filter-tab { padding: 10px 16px; border-radius: 999px; border: 1px solid #d2b48c; text-decoration: none; color: #4a3728; background: #fffaf0; font-weight: bold; }
        .filter-tab.active { background: #8b4513; color: white; }
        .status-pill { display: inline-block; padding: 6px 10px; border-radius: 999px; font-size: 13px; font-weight: bold; white-space: nowrap; }
        .status-local-complete { background: #ecfdf5; color: #047857; }
        .status-remote-only { background: #eff6ff; color: #1d4ed8; }
        .status-no-image { background: #f4f1ea; color: #4a3728; }
        .status-local-broken { background: #fff5f5; color: #c0392b; }
        .row-upload { min-width: 230px; }
        .row-upload .file-label { cursor: pointer; background: #f4f1ea; border: 1px solid #d2b48c; color: #4a3728; padding: 8px 10px; border-radius: 5px; display: inline-block; font-weight: bold; position: relative; overflow: hidden; }
        .row-upload .file-label input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
        .row-preview { display: none; gap: 10px; margin-top: 10px; padding: 8px; border: 1px solid #ead7bd; border-radius: 8px; background: #fffaf0; }
        .row-preview img { width: 58px; height: 58px; object-fit: cover; border-radius: 6px; border: 1px solid #ead7bd; background: white; }
        .file-meta { min-width: 0; font-size: 12px; line-height: 1.5; color: #8b4513; word-break: break-all; }
        .row-message { margin-top: 8px; font-size: 13px; font-weight: bold; }
        .row-url-tools { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .row-url-input { min-width: 220px; flex: 1; }
        .bulk-download-panel { display: none; margin-top: 12px; padding: 14px; border: 1px solid #d2b48c; border-radius: 8px; background: #fffaf0; }
        .bulk-download-panel.active { display: block; }
        .bulk-progress { font-weight: bold; color: #8b4513; }
        .bulk-failures { margin-top: 8px; color: #c0392b; font-size: 13px; max-height: 180px; overflow: auto; }
    </style>
    <script>
        var bulkDownloadCandidates = {{ bulk_download_candidates_json|safe }};
        var bulkDownloadLimit = {{ bulk_download_limit_json|safe }};

        function toggleAll(source) {
            document.querySelectorAll('input[name="selected"]').forEach(function(box) { box.checked = source.checked; });
        }
        function confirmBulk(actionText) {
            var checked = document.querySelectorAll('input[name="selected"]:checked').length;
            if (checked === 0) { alert('请先勾选要操作的数据'); return false; }
            return confirm('确定要' + actionText + '选中的 ' + checked + ' 条数据吗？');
        }
        function formatFileSize(size) {
            if (size >= 1024 * 1024) return (size / 1024 / 1024).toFixed(2) + " MB";
            if (size >= 1024) return (size / 1024).toFixed(1) + " KB";
            return size + " B";
        }
        function validateImageFile(file) {
            var allowed = ["image/jpeg", "image/png", "image/webp"];
            if (allowed.indexOf(file.type) === -1) return "仅支持 jpg/png/webp 图片。";
            if (file.size > 10 * 1024 * 1024) return "图片不能超过 10MB。";
            return "";
        }
        function currentAdminToken() {
            var input = document.getElementById("adminToken");
            return ((input && input.value) || localStorage.getItem("muselink_admin_token") || localStorage.getItem("muselink_token") || "").trim();
        }
        function persistAdminToken() {
            var input = document.getElementById("adminToken");
            if (input && input.value.trim()) {
                localStorage.setItem("muselink_admin_token", input.value.trim());
                localStorage.setItem("muselink_token", input.value.trim());
                alert("管理员 token 已保存。");
            }
        }
        function setRowMessage(artifactId, message, isError) {
            var el = document.getElementById("rowMessage-" + artifactId);
            if (!el) return;
            el.textContent = message || "";
            el.style.color = isError ? "#c0392b" : "#047857";
        }
        function setBulkStatus(message, failures) {
            var panel = document.getElementById("bulkDownloadPanel");
            var progress = document.getElementById("bulkDownloadProgress");
            var failureBox = document.getElementById("bulkDownloadFailures");
            if (panel) panel.classList.add("active");
            if (progress) progress.textContent = message || "";
            if (failureBox) {
                failureBox.innerHTML = (failures || []).map(function (item) {
                    return "<div>" + item.name + "：" + item.error + "</div>";
                }).join("");
            }
        }
        async function parseJsonResponse(response) {
            var text = await response.text();
            if (!text) return { __rawText: "" };
            try {
                var data = JSON.parse(text);
                if (data && typeof data === "object") data.__rawText = text;
                return data;
            } catch (error) {
                throw new Error(text.slice(0, 300) || "接口没有返回 JSON。");
            }
        }
        function responseError(response, data, fallback) {
            var detail = (data && (data.error || data.message || data.detail || data.__rawText)) || "";
            return "HTTP " + response.status + "：" + (detail || fallback);
        }
        function onRowImageSelected(input, artifactId) {
            var file = input.files && input.files[0];
            var preview = document.getElementById("rowPreview-" + artifactId);
            var image = document.getElementById("rowPreviewImage-" + artifactId);
            var meta = document.getElementById("rowFileMeta-" + artifactId);
            setRowMessage(artifactId, "", false);
            if (!file) {
                if (preview) preview.style.display = "none";
                return;
            }
            var validation = validateImageFile(file);
            if (validation) {
                input.value = "";
                if (preview) preview.style.display = "none";
                setRowMessage(artifactId, validation, true);
                return;
            }
            if (image) image.src = URL.createObjectURL(file);
            if (meta) {
                meta.innerHTML = "<strong>" + file.name + "</strong><br>" + formatFileSize(file.size) + "<br>" + (file.type || "-");
            }
            if (preview) preview.style.display = "flex";
        }
        async function uploadRowImage(artifactId, artifactName) {
            var input = document.getElementById("rowFile-" + artifactId);
            var button = document.getElementById("rowUploadButton-" + artifactId);
            var file = input && input.files && input.files[0];
            var token = currentAdminToken();
            if (!file) {
                setRowMessage(artifactId, "请先选择要上传的图片。", true);
                return;
            }
            var validation = validateImageFile(file);
            if (validation) {
                setRowMessage(artifactId, validation, true);
                return;
            }
            if (!token) {
                setRowMessage(artifactId, "请先在列表顶部填写管理员 token。", true);
                return;
            }
            localStorage.setItem("muselink_admin_token", token);
            localStorage.setItem("muselink_token", token);
            var formData = new FormData();
            formData.set("image", file);
            if (button) button.disabled = true;
            setRowMessage(artifactId, "上传中...", false);
            try {
                var apiBaseUrl = {{ api_base_url_json|safe }};
                var response = await fetch(apiBaseUrl.replace(/\/+$/, "") + "/api/admin/artifacts/" + encodeURIComponent(artifactId) + "/image", {
                    method: "POST",
                    headers: { Authorization: "Bearer " + token },
                    body: formData
                });
                var data = await parseJsonResponse(response);
                if (!response.ok) throw new Error(responseError(response, data, "上传失败"));
                setRowMessage(artifactId, "上传成功：" + (artifactName || artifactId), false);
                setTimeout(function () { window.location.reload(); }, 500);
            } catch (error) {
                setRowMessage(artifactId, error instanceof Error ? error.message : String(error), true);
                if (button) button.disabled = false;
            }
        }
        async function downloadRowImageUrl(artifactId, artifactName) {
            var input = document.getElementById("rowImageUrl-" + artifactId);
            var button = document.getElementById("rowDownloadButton-" + artifactId);
            var imageUrl = input ? input.value.trim() : "";
            var token = currentAdminToken();
            if (!imageUrl) {
                setRowMessage(artifactId, "请先粘贴图片链接。", true);
                return;
            }
            if (!/^https?:\/\//i.test(imageUrl)) {
                setRowMessage(artifactId, "图片链接必须以 http 或 https 开头。", true);
                return;
            }
            if (!token) {
                setRowMessage(artifactId, "请先在列表顶部填写管理员 token。", true);
                return;
            }
            localStorage.setItem("muselink_admin_token", token);
            localStorage.setItem("muselink_token", token);
            if (button) button.disabled = true;
            setRowMessage(artifactId, "正在下载图片...", false);
            try {
                var response = await fetch("/download-image-url/" + encodeURIComponent(artifactId), {
                    method: "POST",
                    headers: {
                        "Authorization": "Bearer " + token,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ imageUrl: imageUrl })
                });
                var data = await parseJsonResponse(response);
                if (!response.ok) throw new Error(responseError(response, data, "下载补图失败"));
                setRowMessage(artifactId, "下载成功：" + (artifactName || artifactId), false);
                setTimeout(function () { window.location.reload(); }, 500);
            } catch (error) {
                setRowMessage(artifactId, error instanceof Error ? error.message : String(error), true);
                if (button) button.disabled = false;
            }
        }
        async function bulkDownloadExternalImages() {
            var token = currentAdminToken();
            if (!token) {
                setBulkStatus("请先填写管理员 token。", []);
                return;
            }
            var candidates = Array.isArray(bulkDownloadCandidates) ? bulkDownloadCandidates.slice() : [];
            if (bulkDownloadLimit && bulkDownloadLimit > 0) candidates = candidates.slice(0, bulkDownloadLimit);
            if (candidates.length === 0) {
                setBulkStatus("当前筛选中没有仅有外链图的文物。", []);
                return;
            }
            if (!confirm("将为当前筛选中的仅有外链图文物批量下载本地图片，可能需要几分钟。是否继续？")) return;

            localStorage.setItem("muselink_admin_token", token);
            localStorage.setItem("muselink_token", token);
            var button = document.getElementById("bulkDownloadButton");
            if (button) button.disabled = true;

            var total = candidates.length;
            var success = 0;
            var failed = 0;
            var skipped = 0;
            var failures = [];

            for (var i = 0; i < candidates.length; i += 1) {
                var item = candidates[i];
                setBulkStatus("正在下载 " + (i + 1) + " / " + total + "：" + item.name + "。成功 " + success + "，失败 " + failed + "，跳过 " + skipped + "。", failures);
                try {
                    var response = await fetch("/bulk-download-image-urls", {
                        method: "POST",
                        headers: {
                            "Authorization": "Bearer " + token,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            mode: "only-external",
                            artifactIds: [item.artifactId],
                            limit: 1,
                            delayMs: 700,
                            appendReport: true,
                            resetReport: i === 0
                        })
                    });
                    var data = await parseJsonResponse(response);
                    if (!response.ok) throw new Error(responseError(response, data, "批量下载失败"));
                    var record = data.records && data.records[0];
                    if (record && record.status === "success") {
                        success += 1;
                    } else if (record && record.status === "skipped") {
                        skipped += 1;
                    } else {
                        failed += 1;
                        failures.push({ name: item.name, error: (record && record.error) || "下载失败。" });
                    }
                } catch (error) {
                    failed += 1;
                    failures.push({ name: item.name, error: error instanceof Error ? error.message : String(error) });
                }
                if (i < candidates.length - 1) await new Promise(function (resolve) { setTimeout(resolve, 700); });
            }

            setBulkStatus("批量下载完成：总数 " + total + "，成功 " + success + "，失败 " + failed + "，跳过 " + skipped + "。报告：/bulk-image-download-report", failures);
            if (button) button.disabled = false;
        }
        window.addEventListener("DOMContentLoaded", function () {
            var input = document.getElementById("adminToken");
            if (input) {
                var storedToken = localStorage.getItem("muselink_admin_token") || localStorage.getItem("muselink_token") || "";
                if (storedToken && !input.value) input.value = storedToken;
                input.addEventListener("input", function () {
                    localStorage.setItem("muselink_admin_token", input.value.trim());
                });
            }
            document.querySelectorAll(".row-file-input").forEach(function (fileInput) {
                fileInput.addEventListener("change", function () {
                    onRowImageSelected(fileInput, fileInput.dataset.artifactId || "");
                });
            });
            document.querySelectorAll(".row-upload-button").forEach(function (button) {
                button.addEventListener("click", function () {
                    uploadRowImage(button.dataset.artifactId || "", button.dataset.artifactName || "");
                });
            });
            document.querySelectorAll(".row-download-button").forEach(function (button) {
                button.addEventListener("click", function () {
                    downloadRowImageUrl(button.dataset.artifactId || "", button.dataset.artifactName || "");
                });
            });
            var bulkButton = document.getElementById("bulkDownloadButton");
            if (bulkButton) {
                bulkButton.addEventListener("click", bulkDownloadExternalImages);
            }
        });
    </script>
</head>
<body>
    <div class="header">
        <h1>🏺 博悟 (MuseLink) 管理后台</h1>
        <p>当前数据源：统一 artifacts 表；后端 API：{{ api_base_url }}</p>
    </div>
    <div class="container">
        {% if error %}<div class="card" style="border-color:#c0392b;color:#c0392b;">{{ error }}</div>{% endif %}

        <div class="card">
            <h2>📜 馆藏文物导入</h2>
            <p class="muted">上传会调用 /api/import/run，导入完成后由后端同步到统一 artifacts 表。</p>
            <div class="upload-zone">
                <form action="/upload" method="post" enctype="multipart/form-data">
                    <div style="margin-bottom: 15px;">
                        <label>给这批文物统一指定博物馆：</label><br>
                        <input type="text" name="default_museum" placeholder="例如：辽宁省博物馆" style="width: 260px; margin-top: 5px;">
                    </div>
                    <input type="file" name="file" accept=".csv, .xlsx, .xls, .json, .txt">
                    <button type="submit" class="btn">✨ 点击导入并同步到 artifacts 表</button>
                </form>
            </div>
        </div>

        <div class="card">
            <h2>➕ 新增文物</h2>
            <form action="/add" method="post">
                {% include "artifact_fields" %}
                <div class="toolbar">
                    <button type="submit" class="btn">新增到 artifacts 表</button>
                </div>
            </form>
        </div>

        <div class="card">
            <h2>🖼️ 当前数字馆藏清单</h2>
            <form action="/" method="get" class="toolbar">
                <input type="text" name="q" value="{{ query }}" placeholder="搜索文物名称、馆藏机构、朝代、类别" style="min-width: 320px;">
                <input type="hidden" name="mode" value="{{ image_mode }}">
                <button type="submit" class="btn">搜索</button>
                <a href="/" class="btn btn-secondary">清空搜索</a>
            </form>
            <div class="filter-tabs">
                {% for option in image_filter_options %}
                    <a class="filter-tab {% if image_mode == option.id %}active{% endif %}" href="/?{{ option.query }}">{{ option.label }} {{ option.count }}</a>
                {% endfor %}
            </div>
            <div class="toolbar">
                <button id="bulkDownloadButton" type="button" class="btn">一键下载当前筛选外链图{% if bulk_download_limit %}（测试 {{ bulk_download_limit }}）{% endif %}</button>
                <a class="btn btn-secondary" href="/bulk-image-download-report" target="_blank">查看下载报告</a>
                <span class="muted">当前可批量下载 {{ bulk_download_candidates|length }} 件；URL 加 <code>bulk_limit=3</code> 可测试前三件。</span>
            </div>
            <div id="bulkDownloadPanel" class="bulk-download-panel">
                <div id="bulkDownloadProgress" class="bulk-progress"></div>
                <div id="bulkDownloadFailures" class="bulk-failures"></div>
            </div>
            <div class="toolbar">
                <label style="font-weight:bold;">
                    管理员 token
                    <input id="adminToken" type="text" value="{{ admin_token }}" placeholder="上传图片需要 Bearer token" style="min-width: 360px; margin-left: 8px;">
                </label>
                <button type="button" class="btn btn-secondary" onclick="persistAdminToken()">保存 token</button>
            </div>

            {% if data %}
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-title">表内数据</div>
                        <div class="summary-meta">当前显示 {{ data|length }} 件；来源为 artifacts 表。</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-title">按博物馆统计</div>
                        <div class="summary-meta">
                            {% for museum, count in museums[:12] %}
                                {{ museum }}：{{ count }} 件{% if not loop.last %}<br>{% endif %}
                            {% endfor %}
                        </div>
                    </div>
                </div>

                <div class="danger-zone">
                    <h3 style="margin-top: 0;">按范围删除数据</h3>
                    <form action="/clear" method="post" class="toolbar">
                        <input type="hidden" name="clear_type" value="museum">
                        <select name="museum" required>
                            <option value="">选择要删除的博物馆</option>
                            {% for museum, count in museums %}
                                <option value="{{ museum }}">{{ museum }}（{{ count }} 件）</option>
                            {% endfor %}
                        </select>
                        <button type="submit" class="btn btn-clear" onclick="return confirm('确定删除这个博物馆的所有文物吗？')">只删除这个博物馆</button>
                    </form>
                </div>

                <form action="/bulk?{{ query_string }}" method="post">
                    <div class="bulk-zone">
                        <div class="toolbar" style="margin-top: 0;">
                            <label><input type="checkbox" onclick="toggleAll(this)"> 全选</label>
                            <button type="submit" name="action" value="delete" class="btn btn-clear" onclick="return confirmBulk('删除')">删除选中</button>
                            <input type="text" name="target_museum" placeholder="移动到：例如 苏州博物馆" style="min-width: 260px;">
                            <button type="submit" name="action" value="move" class="btn" onclick="return confirmBulk('移动')">移动选中</button>
                        </div>
                    </div>
                    <div style="overflow-x: auto; max-height: 720px;">
                        <table>
                            <thead>
                                <tr>
                                    <th>选择</th>
                                    <th>操作</th>
                                    <th>图片</th>
                                    <th>图片状态</th>
                                    <th>补图</th>
                                    <th>ID</th>
                                    <th>文物名称</th>
                                    <th>所属博物馆</th>
                                    <th>朝代</th>
                                    <th>类别</th>
                                    <th>材质</th>
                                    <th>简介</th>
                                    <th>标签</th>
                                </tr>
                            </thead>
                            <tbody>
                                {% for row in data %}
                                    <tr>
                                        <td><input type="checkbox" name="selected" value="{{ row._artifact_id }}"></td>
                                        <td><a class="btn btn-secondary" href="/edit/{{ row._artifact_id }}">编辑</a></td>
                                        <td>
                                            {% if row["显示图片"] %}
                                                <img class="thumb" src="{{ image_url(row['显示图片']) }}" alt="{{ row['文物名称'] }}" onerror="this.closest('tr').querySelector('.status-pill').textContent='图片加载失败'; this.closest('tr').querySelector('.status-pill').className='status-pill status-local-broken';">
                                            {% else %}
                                                <span class="muted">无图</span>
                                            {% endif %}
                                        </td>
                                        <td><span class="status-pill status-{{ row['图片状态Key'] }}">{{ row["图片状态"] }}</span></td>
                                        <td>
                                            {% if row["图片状态Key"] != "local-complete" %}
                                                <div class="row-upload">
                                                    {% if row["图片状态Key"] == "remote-only" %}
                                                        <div class="muted">当前只有外链图，可直接下载成本地图。</div>
                                                    {% elif row["图片状态Key"] == "no-image" %}
                                                        <div class="muted">当前完全无图，请上传图片或粘贴图片链接。</div>
                                                    {% else %}
                                                        <div class="muted">本地图异常，请重新上传或从外链下载补图。</div>
                                                    {% endif %}
                                                    <label class="file-label">
                                                        选择图片
                                                        <input id="rowFile-{{ row._artifact_id }}" class="row-file-input" data-artifact-id="{{ row._artifact_id }}" type="file" accept="image/jpeg,image/png,image/webp">
                                                    </label>
                                                    <button id="rowUploadButton-{{ row._artifact_id }}" type="button" class="btn row-upload-button" data-artifact-id="{{ row._artifact_id }}" data-artifact-name="{{ row['文物名称'] }}" style="padding:8px 10px;font-size:14px;">{% if row["图片状态Key"] == "local-broken" %}重新上传{% else %}上传图片{% endif %}</button>
                                                    <div class="row-url-tools">
                                                        <input id="rowImageUrl-{{ row._artifact_id }}" class="row-url-input" type="url" value="{{ row['建议下载链接'] }}" placeholder="粘贴图片链接：https://...">
                                                        <button id="rowDownloadButton-{{ row._artifact_id }}" type="button" class="btn row-download-button" data-artifact-id="{{ row._artifact_id }}" data-artifact-name="{{ row['文物名称'] }}" style="padding:8px 10px;font-size:14px;">{% if row["图片状态Key"] == "local-broken" %}从外链下载补图{% else %}下载补图{% endif %}</button>
                                                    </div>
                                                    <div id="rowPreview-{{ row._artifact_id }}" class="row-preview">
                                                        <img id="rowPreviewImage-{{ row._artifact_id }}" alt="">
                                                        <div id="rowFileMeta-{{ row._artifact_id }}" class="file-meta"></div>
                                                    </div>
                                                    <div id="rowMessage-{{ row._artifact_id }}" class="row-message"></div>
                                                </div>
                                            {% else %}
                                                <span class="muted">本地图已完成，无需补图。</span>
                                            {% endif %}
                                        </td>
                                        <td>{{ row.id }}</td>
                                        <td>{{ row["文物名称"] }}</td>
                                        <td>{{ row["所属博物馆"] }}</td>
                                        <td>{{ row["朝代"] }}</td>
                                        <td>{{ row["类别"] }}</td>
                                        <td>{{ row["材质"] }}</td>
                                        <td>{{ row["一句话简介"] or row["文物描述"] }}</td>
                                        <td>{{ row["标签"] }}</td>
                                    </tr>
                                {% endfor %}
                            </tbody>
                        </table>
                    </div>
                </form>
            {% else %}
                <p style="text-align: center; font-size: 20px;">🏮 没有查到文物数据。</p>
            {% endif %}
        </div>
    </div>
</body>
</html>
"""

EDIT_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>编辑文物 - 博悟 (MuseLink)</title>
    <style>
        body { font-family: "STKaiti", "楷体", serif; margin: 0; background-color: #f4f1ea; color: #4a3728; }
        .header { background-color: #8b4513; color: #f4f1ea; padding: 24px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.2); }
        .container { padding: 30px; max-width: 1000px; margin: auto; }
        .card { background: white; padding: 25px; border-radius: 10px; border: 1px solid #d2b48c; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .edit-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
        .field label { display: block; font-weight: bold; margin-bottom: 6px; }
        .field input, .field textarea { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #d2b48c; border-radius: 5px; color: #4a3728; }
        .field textarea { min-height: 120px; resize: vertical; }
        .btn { background-color: #8b4513; color: white; padding: 12px 30px; border: none; border-radius: 5px; cursor: pointer; font-size: 18px; text-decoration: none; display: inline-block; }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-secondary { background-color: #f4f1ea; color: #4a3728; border: 1px solid #d2b48c; }
        .toolbar { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-top: 20px; }
        .image-upload-panel { margin-top: 24px; border: 1px dashed #8b4513; background: #fffaf0; border-radius: 10px; padding: 18px; }
        .image-preview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-top: 12px; }
        .image-preview-card { border: 1px solid #ead7bd; border-radius: 8px; background: white; padding: 10px; }
        .image-preview-card img { width: 100%; height: 180px; object-fit: cover; border-radius: 6px; background: #f4f1ea; border: 1px solid #ead7bd; }
        .path-box { margin-top: 8px; padding: 8px; border-radius: 6px; background: #f4f1ea; color: #4a3728; word-break: break-all; font-family: monospace; font-size: 12px; }
        .status { margin-top: 10px; font-weight: bold; }
        .status.ok { color: #047857; }
        .status.error { color: #c0392b; }
    </style>
</head>
<body>
    <div class="header"><h1>编辑文物数据</h1></div>
    <div class="container">
        <div class="card">
            <form action="/edit/{{ artifact_id }}" method="post">
                {% include "artifact_fields" %}
                <div class="toolbar">
                    <button type="submit" class="btn">保存修改</button>
                    <a href="/" class="btn btn-secondary">返回后台</a>
                </div>
            </form>
            <div class="image-upload-panel">
                <h2 style="margin-top:0;">本地图片上传 / 替换</h2>
                <p class="path-box">当前文物 ID：<strong id="artifactId">{{ artifact_id }}</strong></p>
                <div class="image-preview-grid">
                    <div class="image-preview-card">
                        <strong>当前原图</strong>
                        {% if local_image_url or image_url_value %}
                            <img id="fullPreview" src="{{ image_url(local_image_url or image_url_value) }}" alt="当前原图">
                        {% else %}
                            <div id="fullPreviewEmpty" class="path-box">暂无原图</div>
                            <img id="fullPreview" src="" alt="当前原图" style="display:none;">
                        {% endif %}
                        <div class="path-box" id="localImageUrl">{{ local_image_url or "暂无 localImageUrl" }}</div>
                    </div>
                    <div class="image-preview-card">
                        <strong>当前缩略图</strong>
                        {% if local_thumbnail_url or local_image_url or image_url_value %}
                            <img id="thumbPreview" src="{{ image_url(local_thumbnail_url or local_image_url or image_url_value) }}" alt="当前缩略图">
                        {% else %}
                            <div id="thumbPreviewEmpty" class="path-box">暂无缩略图</div>
                            <img id="thumbPreview" src="" alt="当前缩略图" style="display:none;">
                        {% endif %}
                        <div class="path-box" id="localThumbnailUrl">{{ local_thumbnail_url or "暂无 localThumbnailUrl" }}</div>
                    </div>
                </div>
                <div class="toolbar">
                    <label style="font-weight:bold;">
                        管理员 token
                        <input id="adminToken" type="text" value="{{ admin_token }}" style="display:block; min-width:360px; margin-top:6px;">
                    </label>
                    <label style="font-weight:bold;">
                        选择图片
                        <input id="artifactImageFile" type="file" accept="image/jpeg,image/png,image/webp" style="display:block; margin-top:6px;">
                    </label>
                    <button id="uploadImageButton" type="button" class="btn">上传/替换图片</button>
                </div>
                <div class="toolbar">
                    <label style="font-weight:bold; flex:1; min-width:360px;">
                        图片链接
                        <input id="artifactImageUrl" type="url" placeholder="粘贴图片链接：https://..." style="display:block; width:100%; margin-top:6px;">
                    </label>
                    <button id="downloadImageUrlButton" type="button" class="btn">从链接下载</button>
                </div>
                <div class="muted">文件上传会调用 POST {{ api_base_url }}/api/admin/artifacts/{{ artifact_id }}/image；链接下载会调用 /api/admin/artifacts/{{ artifact_id }}/image-url。成功后刷新当前预览；返回后台后列表缩略图也会更新。</div>
                <div id="uploadStatus" class="status"></div>
            </div>
        </div>
    </div>
    <script>
        var apiBaseUrl = {{ api_base_url_json|safe }};
        var artifactId = {{ artifact_id_json|safe }};
        var tokenInput = document.getElementById("adminToken");
        var fileInput = document.getElementById("artifactImageFile");
        var uploadButton = document.getElementById("uploadImageButton");
        var imageUrlInput = document.getElementById("artifactImageUrl");
        var downloadUrlButton = document.getElementById("downloadImageUrlButton");
        var statusEl = document.getElementById("uploadStatus");
        var fullPreview = document.getElementById("fullPreview");
        var thumbPreview = document.getElementById("thumbPreview");
        var fullPreviewEmpty = document.getElementById("fullPreviewEmpty");
        var thumbPreviewEmpty = document.getElementById("thumbPreviewEmpty");
        var localImageUrlEl = document.getElementById("localImageUrl");
        var localThumbnailUrlEl = document.getElementById("localThumbnailUrl");

        var storedToken = localStorage.getItem("muselink_admin_token") || localStorage.getItem("muselink_token") || "";
        if (storedToken && !tokenInput.value) tokenInput.value = storedToken;
        if (tokenInput.value) localStorage.setItem("muselink_admin_token", tokenInput.value);
        tokenInput.addEventListener("input", function () {
            localStorage.setItem("muselink_admin_token", tokenInput.value.trim());
        });

        function resolveImageUrl(path) {
            if (!path) return "";
            if (/^https?:\/\//i.test(path)) return path;
            return apiBaseUrl.replace(/\/+$/, "") + (path.charAt(0) === "/" ? path : "/" + path);
        }

        function setStatus(message, isError) {
            statusEl.textContent = message;
            statusEl.className = "status " + (isError ? "error" : "ok");
        }

        async function parseJsonResponse(response) {
            var text = await response.text();
            if (!text) return { __rawText: "" };
            try {
                var data = JSON.parse(text);
                if (data && typeof data === "object") data.__rawText = text;
                return data;
            } catch (error) {
                throw new Error(text.slice(0, 300) || "接口没有返回 JSON。");
            }
        }
        function responseError(response, data, fallback) {
            var detail = (data && (data.error || data.message || data.detail || data.__rawText)) || "";
            return "HTTP " + response.status + "：" + (detail || fallback);
        }

        function showImage(img, empty, path) {
            if (!path) return;
            img.src = resolveImageUrl(path) + "?v=" + Date.now();
            img.style.display = "block";
            if (empty) empty.style.display = "none";
        }

        function applyUploadedImage(data) {
            var localImageUrl = data.localImageUrl || data.originalPath || "";
            var localThumbnailUrl = data.localThumbnailUrl || data.thumbnailPath || "";
            localImageUrlEl.textContent = localImageUrl || "暂无 localImageUrl";
            localThumbnailUrlEl.textContent = localThumbnailUrl || "暂无 localThumbnailUrl";
            showImage(fullPreview, fullPreviewEmpty, localImageUrl);
            showImage(thumbPreview, thumbPreviewEmpty, localThumbnailUrl || localImageUrl);
        }

        uploadButton.addEventListener("click", async function () {
            var file = fileInput.files && fileInput.files[0];
            var token = tokenInput.value.trim();
            if (!file) {
                setStatus("请先选择 jpg/jpeg/png/webp 图片。", true);
                return;
            }
            if (!token) {
                setStatus("请先填写管理员 token。", true);
                return;
            }

            var formData = new FormData();
            formData.set("image", file);
            uploadButton.disabled = true;
            setStatus("上传中...", false);

            try {
                var response = await fetch(apiBaseUrl.replace(/\/+$/, "") + "/api/admin/artifacts/" + encodeURIComponent(artifactId) + "/image", {
                    method: "POST",
                    headers: { Authorization: "Bearer " + token },
                    body: formData
                });
                var data = await parseJsonResponse(response);
                if (!response.ok) throw new Error(responseError(response, data, "上传失败"));

                applyUploadedImage(data);
                fileInput.value = "";
                localStorage.setItem("muselink_admin_token", token);
                setStatus("上传成功。当前编辑区预览已更新，返回后台列表后缩略图会显示新图片；前端刷新后也会优先显示新图。", false);
            } catch (error) {
                setStatus(error instanceof Error ? error.message : String(error), true);
            } finally {
                uploadButton.disabled = false;
            }
        });

        downloadUrlButton.addEventListener("click", async function () {
            var imageUrl = imageUrlInput.value.trim();
            var token = tokenInput.value.trim();
            if (!imageUrl) {
                setStatus("请先粘贴图片链接。", true);
                return;
            }
            if (!/^https?:\/\//i.test(imageUrl)) {
                setStatus("图片链接必须以 http 或 https 开头。", true);
                return;
            }
            if (!token) {
                setStatus("请先填写管理员 token。", true);
                return;
            }

            downloadUrlButton.disabled = true;
            setStatus("正在下载图片...", false);

            try {
                var response = await fetch("/download-image-url/" + encodeURIComponent(artifactId), {
                    method: "POST",
                    headers: {
                        "Authorization": "Bearer " + token,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ imageUrl: imageUrl })
                });
                var data = await parseJsonResponse(response);
                if (!response.ok) throw new Error(responseError(response, data, "下载补图失败"));

                applyUploadedImage(data);
                localStorage.setItem("muselink_admin_token", token);
                setStatus("下载成功。当前编辑区预览已更新，图片链接也已保存到 imageUrl；前端仍优先显示本地图。", false);
            } catch (error) {
                setStatus(error instanceof Error ? error.message : String(error), true);
            } finally {
                downloadUrlButton.disabled = false;
            }
        });
    </script>
</body>
</html>
"""

FIELD_TEMPLATE = """
<div class="edit-grid">
    {% for field in fields %}
        <div class="field">
            <label>{{ field.label }}</label>
            {% if field.type == "textarea" %}
                <textarea name="{{ field.name }}">{{ field.value }}</textarea>
            {% else %}
                <input type="text" name="{{ field.name }}" value="{{ field.value }}">
            {% endif %}
        </div>
    {% endfor %}
</div>
"""


def render_with_fields(template, **context):
    return render_template_string(
        template.replace('{% include "artifact_fields" %}', FIELD_TEMPLATE),
        **context,
    )


def fields_from_row(row=None):
    row = row or {}
    return [
        {"name": "name", "label": "文物名称", "value": pick(row, "文物名称", "name"), "type": "input"},
        {"name": "museum", "label": "所属博物馆", "value": detect_museum(row), "type": "input"},
        {"name": "period", "label": "朝代 / 年代", "value": pick(row, "朝代", "period", "dynasty"), "type": "input"},
        {"name": "category", "label": "类别", "value": pick(row, "类别", "category"), "type": "input"},
        {"name": "level", "label": "等级", "value": pick(row, "等级", "level"), "type": "input"},
        {"name": "material", "label": "材质", "value": pick(row, "材质", "material"), "type": "input"},
        {"name": "dimensions", "label": "尺寸", "value": pick(row, "尺寸", "dimensions", "size"), "type": "input"},
        {"name": "short_intro", "label": "一句话简介", "value": pick(row, "一句话简介", "shortIntro", "short_intro"), "type": "input"},
        {"name": "image_url", "label": "图片链接", "value": pick(row, "图片链接", "imageUrl", "image_url"), "type": "input"},
        {"name": "source_url", "label": "来源链接", "value": pick(row, "来源链接", "sourceUrl", "source_url"), "type": "input"},
        {"name": "tags", "label": "标签（逗号分隔）", "value": pick(row, "标签", "tags"), "type": "input"},
        {"name": "description", "label": "简介 / 描述", "value": pick(row, "文物描述", "description"), "type": "textarea"},
        {"name": "remarks", "label": "备注", "value": pick(row, "备注", "remarks"), "type": "textarea"},
    ]


@app.route("/")
def index():
    query = clean_value(request.args.get("q"))
    image_mode = clean_value(request.args.get("mode")) or "all"
    bulk_limit_raw = clean_value(request.args.get("bulk_limit"))
    try:
        bulk_limit = max(0, int(bulk_limit_raw)) if bulk_limit_raw else 0
    except ValueError:
        bulk_limit = 0
    if image_mode not in IMAGE_MODE_LABELS:
        image_mode = "all"
    error = clean_value(request.args.get("error"))
    try:
        all_data = load_data(query)
        data = filter_rows_by_image_mode(all_data, image_mode)
    except RuntimeError as exc:
        all_data = []
        data = []
        error = str(exc)
    try:
        admin_token = get_admin_token()
    except RuntimeError:
        admin_token = ""

    def mode_query(mode):
        params = {"mode": mode}
        if query:
            params["q"] = query
        return urlencode(params)

    filter_counts = image_mode_counts(all_data)
    image_filter_options = [
        {
            "id": mode,
            "label": label,
            "count": filter_counts.get(mode, 0),
            "query": mode_query(mode),
        }
        for mode, label in IMAGE_MODE_LABELS.items()
    ]

    query_params = {"mode": image_mode}
    if query:
        query_params["q"] = query

    bulk_download_candidates = [
        {
            "artifactId": clean_value(row.get("_artifact_id")),
            "name": clean_value(row.get("文物名称")) or clean_value(row.get("_artifact_id")),
        }
        for row in data
        if row.get("图片状态Key") == "remote-only"
    ]

    return render_with_fields(
        HTML_TEMPLATE,
        data=data,
        batches=get_batch_summaries(all_data),
        museums=get_museum_summaries(all_data),
        fields=fields_from_row({}),
        query=query,
        image_mode=image_mode,
        image_filter_options=image_filter_options,
        bulk_download_candidates=bulk_download_candidates,
        bulk_download_candidates_json=json.dumps(bulk_download_candidates, ensure_ascii=False),
        bulk_download_limit=bulk_limit,
        bulk_download_limit_json=json.dumps(bulk_limit),
        query_string=urlencode(query_params),
        api_base_url=API_BASE_URL,
        api_base_url_json=json.dumps(API_BASE_URL),
        admin_token=admin_token,
        image_url=absolute_api_url,
        error=error,
    )


@app.route("/add", methods=["POST"])
def add_item():
    try:
        api_request("/api/artifacts", method="POST", payload=build_payload(request.form), auth=True)
    except RuntimeError as exc:
        return redirect(f"/?error={quote(str(exc))}")
    return redirect("/")


@app.route("/bulk", methods=["POST"])
def bulk_action():
    selected_ids = parse_selected_ids(request.form)
    action = request.form.get("action", "")
    query = clean_value(request.args.get("q"))
    image_mode = clean_value(request.args.get("mode")) or "all"
    if image_mode not in IMAGE_MODE_LABELS:
        image_mode = "all"

    try:
        if action == "delete":
            for artifact_id in selected_ids:
                api_request(f"/api/artifacts/{quote(artifact_id)}", method="DELETE", auth=True)
        elif action == "move":
            target_museum = clean_value(request.form.get("target_museum"))
            if target_museum:
                for artifact_id in selected_ids:
                    detail = api_request(f"/api/artifacts/{quote(artifact_id)}").get("artifact") or {}
                    row = artifact_to_row(detail)
                    payload = build_payload(
                        {
                            "name": row["文物名称"],
                            "museum": target_museum,
                            "period": row["朝代"],
                            "category": row["类别"],
                            "level": row["等级"],
                            "material": row["材质"],
                            "dimensions": row["尺寸"],
                            "short_intro": row["一句话简介"],
                            "image_url": row["图片链接"],
                            "source_url": row["来源链接"],
                            "tags": row["标签"],
                            "description": row["文物描述"],
                        }
                    )
                    api_request(f"/api/artifacts/{quote(artifact_id)}", method="PUT", payload=payload, auth=True)
    except RuntimeError as exc:
        return redirect(f"/?error={quote(str(exc))}")

    params = {"mode": image_mode}
    if query:
        params["q"] = query
    return redirect(f"/?{urlencode(params)}")


@app.route("/edit/<artifact_id>", methods=["GET", "POST"])
def edit_item(artifact_id):
    if request.method == "POST":
        try:
            api_request(f"/api/artifacts/{quote(artifact_id)}", method="PUT", payload=build_payload(request.form), auth=True)
        except RuntimeError as exc:
            return redirect(f"/?error={quote(str(exc))}")
        return redirect("/")

    detail = api_request(f"/api/artifacts/{quote(artifact_id)}").get("artifact") or {}
    row = artifact_to_row(detail)
    try:
        admin_token = get_admin_token()
    except RuntimeError:
        admin_token = ""
    return render_with_fields(
        EDIT_TEMPLATE,
        artifact_id=artifact_id,
        artifact_id_json=json.dumps(artifact_id),
        fields=fields_from_row(row),
        api_base_url=API_BASE_URL,
        api_base_url_json=json.dumps(API_BASE_URL),
        admin_token=admin_token,
        image_url=absolute_api_url,
        image_url_value=row["图片链接"],
        local_image_url=row["本地原图"],
        local_thumbnail_url=row["本地缩略图"],
    )


@app.route("/download-image-url/<artifact_id>", methods=["POST"])
def download_image_url(artifact_id):
    try:
        payload = request.get_json(silent=True) or {}
        image_url = clean_value(payload.get("imageUrl"))
        if not image_url:
            return jsonify({"error": "请先粘贴图片链接。"}), 400

        token = bearer_token_from_request() or get_admin_token()
        artifact = {"_artifact_id": clean_value(artifact_id)}
        result = downloadArtifactImageFromUrl(artifact, image_url, token)

        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/bulk-download-image-urls", methods=["POST"])
def bulk_download_image_urls():
    started_at = datetime.now()
    payload = request.get_json(silent=True) or {}
    artifact_ids = {
        clean_value(value)
        for value in (payload.get("artifactIds") or [])
        if clean_value(value)
    }
    mode = clean_value(payload.get("mode")) or "only-external"
    dry_run = bool(payload.get("dryRun"))
    append_report = bool(payload.get("appendReport"))
    reset_report = bool(payload.get("resetReport"))
    limit_raw = payload.get("limit")
    try:
        limit = max(0, int(limit_raw)) if limit_raw not in (None, "") else 0
    except (TypeError, ValueError):
        limit = 0
    try:
        delay_ms = int(payload.get("delayMs") or 700)
    except (TypeError, ValueError):
        delay_ms = 700
    delay_ms = min(max(delay_ms, 500), 1000)

    if mode != "only-external":
        return jsonify({"error": "当前仅支持 mode=only-external。"}), 400

    try:
        token = bearer_token_from_request() or get_admin_token()
        rows = load_data("")
        if artifact_ids:
            rows = [row for row in rows if clean_value(row.get("_artifact_id")) in artifact_ids]

        candidates = [row for row in rows if row.get("图片状态Key") == "remote-only"]
        if limit:
            candidates = candidates[:limit]

        records = []
        summary = {"total": len(candidates), "success": 0, "failed": 0, "skipped": 0, "dryRun": dry_run}

        for index, row in enumerate(candidates):
            artifact_id = clean_value(row.get("_artifact_id"))
            name = clean_value(row.get("文物名称"))
            source_urls = []
            for value in (row.get("缩略图链接"), row.get("图片链接")):
                url = clean_value(value)
                if url and url not in source_urls:
                    source_urls.append(url)

            record = {
                "artifactId": artifact_id,
                "name": name,
                "sourceUrl": source_urls[0] if source_urls else "",
                "status": "skipped",
                "error": "",
                "localImageUrl": "",
                "localThumbnailUrl": "",
            }

            if not source_urls:
                record["error"] = "没有可下载的外链图片。"
                summary["skipped"] += 1
                records.append(record)
                continue

            if dry_run:
                record["error"] = "dry-run：未实际下载。"
                summary["skipped"] += 1
                records.append(record)
                continue

            last_error = ""
            for source_url in source_urls:
                record["sourceUrl"] = source_url
                try:
                    result = downloadArtifactImageFromUrl(row, source_url, token)
                    record.update({
                        "status": "success",
                        "error": "",
                        "localImageUrl": clean_value(result.get("localImageUrl") or result.get("originalPath")),
                        "localThumbnailUrl": clean_value(result.get("localThumbnailUrl") or result.get("thumbnailPath")),
                    })
                    summary["success"] += 1
                    break
                except Exception as exc:
                    last_error = str(exc)

            if record["status"] != "success":
                record["status"] = "failed"
                record["error"] = last_error or "下载失败。"
                summary["failed"] += 1

            records.append(record)
            if index < len(candidates) - 1:
                time.sleep(delay_ms / 1000)

        summary["durationSeconds"] = round((datetime.now() - started_at).total_seconds(), 2)
        report_records = records
        report_summary = summary
        if append_report and not reset_report:
            existing_report = read_bulk_image_download_report()
            existing_records = existing_report.get("records") if isinstance(existing_report.get("records"), list) else []
            report_records = [*existing_records, *records]
            report_summary = {
                "total": len(report_records),
                "success": sum(1 for item in report_records if item.get("status") == "success"),
                "failed": sum(1 for item in report_records if item.get("status") == "failed"),
                "skipped": sum(1 for item in report_records if item.get("status") == "skipped"),
                "dryRun": dry_run,
            }
        report_path = write_bulk_image_download_report(report_records, report_summary)
        return jsonify({
            "ok": True,
            "summary": summary,
            "records": records,
            "reportPath": report_path,
            "reportUrl": "/bulk-image-download-report",
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/bulk-image-download-report")
def bulk_image_download_report():
    try:
        with open(BULK_IMAGE_DOWNLOAD_REPORT_PATH, "r", encoding="utf-8") as file:
            return jsonify(json.load(file))
    except FileNotFoundError:
        return jsonify({"error": "暂无批量下载报告。"}), 404


@app.route("/upload", methods=["POST"])
def upload_file():
    file = request.files.get("file")
    default_museum = clean_value(request.form.get("default_museum"))
    if not file or not file.filename:
        return redirect("/")

    try:
        records = [
            import_record_payload(item, default_museum)
            for item in load_records_from_upload(file)
            if isinstance(item, dict)
        ]
        job = {
            "sourceName": file.filename,
            "sourceType": "inline",
            "format": "json",
            "records": records,
            "mode": "append",
            "persistTo": ["file"],
            "defaults": {"museum": default_museum} if default_museum else {},
        }
        api_request("/api/import/run", method="POST", payload=job)
    except Exception as exc:
        return redirect(f"/?error={quote(str(exc))}")
    return redirect("/")


@app.route("/clear", methods=["POST"])
def clear_data():
    clear_type = request.form.get("clear_type", "")
    museum = clean_value(request.form.get("museum"))

    try:
        data = load_data()
        if clear_type == "museum" and museum:
            for row in data:
                if detect_museum(row) == museum:
                    api_request(f"/api/artifacts/{quote(row['_artifact_id'])}", method="DELETE", auth=True)
    except RuntimeError as exc:
        return redirect(f"/?error={quote(str(exc))}")
    return redirect("/")


if __name__ == "__main__":
    print("博悟管理后台正在启动，请访问：http://localhost:9999")
    app.run(debug=True, port=9999)
