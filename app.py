from flask import Flask, request, render_template_string, redirect
import ast
import json
import os
from collections import Counter
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

import pandas as pd

app = Flask(__name__)

# Original standalone backend management site.
# It now uses the unified Node backend API, whose artifact endpoints read/write
# the unified PostgreSQL/pg-mem artifacts table.
API_BASE_URL = os.environ.get("MUSELINK_API_BASE_URL", "http://localhost:3000").rstrip("/")
ADMIN_MUSE_ID = os.environ.get("MUSELINK_ADMIN_MUSE_ID", "jiangzhong")
ADMIN_PASSWORD = os.environ.get("MUSELINK_ADMIN_PASSWORD", "jiangzhong")

MUSEUM_KEYS = ("所属博物馆", "博物馆", "馆藏单位", "收藏单位", "馆名", "museum", "museumName", "馆藏")


def clean_value(value):
    if value is None:
        return ""
    text = str(value).replace("`", "").strip()
    if text.lower() in ("", "nan", "none", "null", "undefined"):
        return ""
    return text


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
        "图片链接": pick(artifact, "imageUrl", "image_url", "图片链接"),
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
    </style>
    <script>
        function toggleAll(source) {
            document.querySelectorAll('input[name="selected"]').forEach(function(box) { box.checked = source.checked; });
        }
        function confirmBulk(actionText) {
            var checked = document.querySelectorAll('input[name="selected"]:checked').length;
            if (checked === 0) { alert('请先勾选要操作的数据'); return false; }
            return confirm('确定要' + actionText + '选中的 ' + checked + ' 条数据吗？');
        }
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
                <input type="text" name="q" value="{{ query }}" placeholder="搜索文物名称、博物馆、年代、标签" style="min-width: 320px;">
                <button type="submit" class="btn">搜索</button>
                <a href="/" class="btn btn-secondary">清空搜索</a>
            </form>

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
        .btn-secondary { background-color: #f4f1ea; color: #4a3728; border: 1px solid #d2b48c; }
        .toolbar { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-top: 20px; }
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
        </div>
    </div>
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
    error = clean_value(request.args.get("error"))
    try:
        data = load_data(query)
    except RuntimeError as exc:
        data = []
        error = str(exc)
    return render_with_fields(
        HTML_TEMPLATE,
        data=data,
        batches=get_batch_summaries(data),
        museums=get_museum_summaries(data),
        fields=fields_from_row({}),
        query=query,
        query_string=urlencode({"q": query}) if query else "",
        api_base_url=API_BASE_URL,
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

    return redirect(f"/?{urlencode({'q': query})}" if query else "/")


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
    return render_with_fields(EDIT_TEMPLATE, artifact_id=artifact_id, fields=fields_from_row(row))


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
