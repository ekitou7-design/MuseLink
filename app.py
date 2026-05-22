from flask import Flask, request, render_template_string, redirect, url_for # 拿 Flask 工具
import pandas as pd # 拿表格老师傅
import os # 拿文件管家
import json # 拿记账本工具
from datetime import datetime
import ast # 拿一个能看懂“Python式格式”的工具
from collections import Counter

app = Flask(__name__)
DATA_FILE = 'muse_link_data.json' # 咱们自己的管理本子
# 这是主应用读取数据的地方，要把导出的数据同步到这里
MAIN_APP_DATA_FILE = os.path.join('data', 'imported-artifacts.json')

MUSEUM_KEYS = ('所属博物馆', '博物馆', '馆藏单位', '收藏单位', '馆名', 'museum', '馆藏')

def clean_value(value):
    if value is None:
        return ""
    text = str(value).replace('`', '').replace("'", "").strip()
    if text.lower() in ("", "nan", "none", "null"):
        return ""
    return text

def pick(item, *keys):
    for key in keys:
        value = clean_value(item.get(key))
        if value:
            return value
    return ""

def parse_attributes(item):
    raw_attributes = item.get('attributes') or item.get('扩展属性') or item.get('扩展信息')
    if raw_attributes:
        try:
            parsed = json.loads(raw_attributes) if isinstance(raw_attributes, str) else raw_attributes
        except Exception:
            parsed = []
        if isinstance(parsed, list):
            groups = {}
            for raw in parsed:
                if not isinstance(raw, dict):
                    continue
                if isinstance(raw.get('items'), list):
                    group_name = clean_value(raw.get('group') or raw.get('attribute_group')) or '基础信息'
                    for item_raw in raw.get('items'):
                        if not isinstance(item_raw, dict):
                            continue
                        add_attribute(groups, group_name, item_raw.get('name') or item_raw.get('attribute_name'), item_raw.get('value') or item_raw.get('attribute_value'), item_raw.get('sortOrder') or item_raw.get('sort_order'))
                else:
                    add_attribute(groups, raw.get('group') or raw.get('attribute_group'), raw.get('name') or raw.get('attribute_name'), raw.get('value') or raw.get('attribute_value'), raw.get('sortOrder') or raw.get('sort_order'))
            return groups_to_attributes(groups)

    groups = {}
    add_attribute(groups, item.get('attribute_group') or item.get('属性分组') or item.get('扩展分组'), item.get('attribute_name') or item.get('属性名称') or item.get('扩展名称'), item.get('attribute_value') or item.get('属性值') or item.get('扩展值'), item.get('sort_order') or item.get('sortOrder') or item.get('排序'))
    return groups_to_attributes(groups)

def add_attribute(groups, group, name, value, sort_order=0):
    name_text = clean_value(name)
    value_text = clean_value(value)
    if not name_text or not value_text:
        return
    group_text = clean_value(group) or '基础信息'
    try:
        order = int(float(clean_value(sort_order) or 0))
    except Exception:
        order = 0
    groups.setdefault(group_text, []).append({"name": name_text, "value": value_text, "sortOrder": order})

def groups_to_attributes(groups):
    attributes = []
    for group, items in groups.items():
        valid_items = sorted(items, key=lambda x: x.get("sortOrder", 0))
        if valid_items:
            attributes.append({
                "group": group,
                "items": [{"name": item["name"], "value": item["value"]} for item in valid_items]
            })
    return attributes

def detect_museum(item, default_museum=None):
    museum = pick(item, *MUSEUM_KEYS)

    if not museum:
        museum = clean_value(item.get('__default_museum')) or clean_value(default_museum)

    if not museum:
        museum = '未知博物馆'
        name = pick(item, '文物名称', '名称', '藏品名称', '题名', 'name', 'title')
        remark = pick(item, '备注', '附注', '说明', 'notes', 'remarks', 'remark')
        origin = pick(item, '出土地', '出土地点 / 来源', '来源', '发现地', 'origin', 'provenance')
        description = pick(item, '文物描述', '文物简介', '简介', '介绍', 'description', 'summary')
        full_text = name + remark + origin + description
        if '辽' in full_text and '博物馆' in full_text:
            museum = '辽宁省博物馆'
        elif '博物馆' in remark:
            parts = remark.split('，')
            for p in parts:
                if '博物馆' in p:
                    museum = p.replace('藏', '').strip()
                    break
        elif '故宫博物院' in remark or '故宫' in full_text:
            museum = '故宫博物院'
        elif '金沙遗址博物馆' in remark or '金沙' in full_text:
            museum = '金沙遗址博物馆'

    return museum

def build_artifact(item, index, default_museum=None):
    name = pick(item, '文物名称', '名称', '藏品名称', '题名', 'name', 'title') or '未知文物'
    period = pick(item, '朝代', '所属年代', '年代', '时代', '时期', 'dynasty', 'period', 'era') or '未知'
    category = pick(item, '类别', '文物类别', '藏品类别', '类型', 'category')
    level = pick(item, '等级', '级别', '文物等级', '保护级别', 'level')
    material = pick(item, '材质', '质地', '材料', 'material', 'medium') or '未知'
    dimensions = pick(item, '尺寸', '规格', '体量', '长宽高', 'size', 'dimensions')
    remark = pick(item, '备注', '附注', '说明', 'notes', 'remarks', 'remark')
    origin = pick(item, '出土地', '出土地点 / 来源', '来源', '发现地', 'origin', 'provenance')
    short_intro = pick(item, '一句话简介', '短简介', '摘要', 'shortIntro', 'short_intro', 'summary')
    description = pick(item, '文物描述', '文物简介', '简介', '介绍', 'description', 'summary')
    source_url = pick(item, '来源链接', '数据来源', '原文链接', 'sourceUrl', 'source_url', 'sourceLink')
    museum = detect_museum(item, default_museum)
    img_url = pick(item, '图片链接', '高精度图片链接', '图片URL', '图片', '照片', 'imageUrl', 'image_url', 'image', 'img', 'thumbnail')
    attributes = parse_attributes(item)

    artifact = {
        "id": pick(item, '文物唯一编号', '文物编号', '藏品编号', '编号', 'id') or f"WW-{name}-{index}",
        "name": name,
        "museumName": museum,
        "museum": museum,
        "dynasty": period,
        "period": period,
        "material": material,
        "culture": pick(item, '文化', '文化类型', 'culture') or "中华文化",
        "origin": origin,
        "shortIntro": short_intro,
        "description": description,
        "imageUrl": img_url,
        "sourceUrl": source_url,
        "attributes": attributes,
        "tags": [tag for tag in [category, material, level, "新导入"] if tag],
        "favsCount": 0,
        "图片链接": img_url,
        "所属博物馆": museum,
        "文物名称": name,
        "朝代": period,
        "类别": category,
        "等级": level,
        "材质": material,
        "尺寸": dimensions,
        "备注": remark
    }

    if category:
        artifact["category"] = category
    if level:
        artifact["level"] = level
    if dimensions:
        artifact["dimensions"] = dimensions
    if remark:
        artifact["remarks"] = remark
    if clean_value(item.get('__import_batch')):
        artifact["importBatch"] = clean_value(item.get('__import_batch'))
    if clean_value(item.get('__source_file')):
        artifact["sourceFile"] = clean_value(item.get('__source_file'))

    return artifact

def get_batch_summaries(data):
    batches = {}
    for item in data:
        batch_id = clean_value(item.get('__import_batch')) or 'legacy'
        source_file = clean_value(item.get('__source_file')) or ('历史数据' if batch_id == 'legacy' else '未命名文件')
        imported_at = clean_value(item.get('__imported_at'))
        museum = detect_museum(item)
        if batch_id not in batches:
            batches[batch_id] = {
                "id": batch_id,
                "source_file": source_file,
                "imported_at": imported_at,
                "count": 0,
                "museums": Counter()
            }
        batches[batch_id]["count"] += 1
        batches[batch_id]["museums"][museum] += 1

    summaries = []
    for batch in batches.values():
        museum_text = '、'.join([f"{museum}({count})" for museum, count in batch["museums"].most_common()])
        summaries.append({**batch, "museum_text": museum_text})
    return sorted(summaries, key=lambda item: item["imported_at"], reverse=True)

def get_museum_summaries(data):
    counts = Counter(detect_museum(item) for item in data)
    return counts.most_common()

def parse_selected_indices(form):
    indices = []
    for value in form.getlist('selected'):
        try:
            indices.append(int(value))
        except ValueError:
            continue
    return sorted(set(indices), reverse=True)

def set_item_museum(item, museum):
    museum = clean_value(museum)
    if not museum:
        return item
    item['所属博物馆'] = museum
    item['博物馆'] = museum
    item['museum'] = museum
    item['__default_museum'] = museum
    return item

# 存数据的助手
def save_data(data):
    print(f"正在保存数据到 {DATA_FILE}，总计 {len(data)} 条记录...")
    # 专门加一个“翻译官”，防止日期格式存不进去
    def my_serializer(obj):
        return str(obj)
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4, default=my_serializer)
    
    # 同步存入主应用能读到的地方
    sync_to_main_app(data)

def sync_to_main_app(data):
    print("开始同步到主应用展厅...")
    artifacts = [build_artifact(item, index) for index, item in enumerate(data)]

    main_data = {
        "version": 1,
        "updatedAt": datetime.now().isoformat(),
        "artifacts": artifacts
    }
    
    # 确保文件夹存在
    os.makedirs(os.path.dirname(MAIN_APP_DATA_FILE), exist_ok=True)
    with open(MAIN_APP_DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(main_data, f, ensure_ascii=False, indent=2)
    print(f"同步完成！主应用展厅现在有 {len(artifacts)} 件文物了。")

# 读数据的助手（防死机版）
def load_data():
    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            if not content: return []
            return json.loads(content)
    except:
        return []

# 网页样子
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>博悟 (MuseLink) - 数字博物馆管理后台</title>
    <style>
        body { font-family: "STKaiti", "楷体", serif; margin: 0; background-color: #f4f1ea; color: #4a3728; }
        .header { background-color: #8b4513; color: #f4f1ea; padding: 30px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.2); }
        .container { padding: 30px; max-width: 1000px; margin: auto; }
        .card { background: white; padding: 25px; border-radius: 10px; border: 1px solid #d2b48c; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 30px; }
        .upload-zone { border: 2px dashed #8b4513; padding: 30px; text-align: center; background-color: #fffaf0; border-radius: 8px; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; background: white; border: 1px solid #8b4513; }
        th, td { border: 1px solid #d2b48c; padding: 12px; text-align: left; }
        th { background-color: #8b4513; color: #f4f1ea; }
        .btn { background-color: #8b4513; color: white; padding: 12px 30px; border: none; border-radius: 5px; cursor: pointer; font-size: 18px; }
        .btn-clear { background-color: #c0392b; margin-top: 20px; }
        .danger-zone { border: 1px solid #e6b0aa; background: #fff5f5; border-radius: 8px; padding: 18px; margin-top: 20px; }
        .toolbar { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-top: 12px; }
        select { padding: 10px; border: 1px solid #d2b48c; border-radius: 5px; min-width: 240px; background: white; color: #4a3728; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 12px; }
        .summary-item { border: 1px solid #ead7bd; border-radius: 8px; padding: 12px; background: #fffaf0; }
        .summary-title { font-weight: bold; color: #4a3728; }
        .summary-meta { color: #8b4513; font-size: 14px; margin-top: 6px; line-height: 1.5; }
        .bulk-zone { border: 1px solid #d2b48c; background: #fffaf0; border-radius: 8px; padding: 16px; margin-top: 20px; }
        .btn-small { font-size: 14px; padding: 8px 14px; border-radius: 5px; text-decoration: none; display: inline-block; }
        .btn-secondary { background-color: #f4f1ea; color: #4a3728; border: 1px solid #d2b48c; }
        .edit-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
        .field label { display: block; font-weight: bold; margin-bottom: 6px; }
        .field input, .field textarea { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #d2b48c; border-radius: 5px; color: #4a3728; }
        .field textarea { min-height: 120px; resize: vertical; }
        .sticky-actions { position: sticky; top: 0; z-index: 2; }
    </style>
    <script>
        function toggleAll(source) {
            document.querySelectorAll('input[name="selected"]').forEach(function(box) {
                box.checked = source.checked;
            });
        }
        function confirmBulk(actionText) {
            var checked = document.querySelectorAll('input[name="selected"]:checked').length;
            if (checked === 0) {
                alert('请先勾选要操作的数据');
                return false;
            }
            return confirm('确定要' + actionText + '选中的 ' + checked + ' 条数据吗？');
        }
    </script>
</head>
<body>
    <div class="header">
        <h1>🏺 博悟 (MuseLink) 管理后台</h1>
        <p>在这里导入数据，主应用会自动同步哦</p>
    </div>
    <div class="container">
        <div class="card">
            <h2>📜 馆藏文物导入</h2>
            <p style="color: #8b4513;">支持格式：Excel (.xlsx), CSV, JSON, 以及 Python 列表格式</p>
            <div class="upload-zone">
                <form action="/upload" method="post" enctype="multipart/form-data">
                    <div style="margin-bottom: 15px;">
                        <label>如果您想给这批文物统一指定博物馆，请填在这里：</label><br>
                        <input type="text" name="default_museum" placeholder="例如：辽宁省博物馆" style="padding: 8px; width: 250px; border: 1px solid #d2b48c; border-radius: 5px; margin-top: 5px;">
                    </div>
                    <input type="file" name="file" accept=".csv, .xlsx, .xls, .json, .txt">
                    <br><br>
                    <button type="submit" class="btn">✨ 点击导入并同步到主应用</button>
                </form>
            </div>
        </div>
        <div class="card">
            <h2>🖼️ 当前数字馆藏清单</h2>
            {% if data %}
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-title">按博物馆统计</div>
                        <div class="summary-meta">
                            {% for museum, count in museums %}
                                {{ museum }}：{{ count }} 件{% if not loop.last %}<br>{% endif %}
                            {% endfor %}
                        </div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-title">导入批次</div>
                        <div class="summary-meta">
                            {% for batch in batches %}
                                {{ batch.source_file }}：{{ batch.count }} 件<br>
                                {{ batch.museum_text }}{% if not loop.last %}<br><br>{% endif %}
                            {% endfor %}
                        </div>
                    </div>
                </div>
                <div class="danger-zone">
                    <h3 style="margin-top: 0;">按范围清除数据</h3>
                    <form action="/clear" method="post" class="toolbar">
                        <input type="hidden" name="clear_type" value="museum">
                        <select name="museum" required>
                            <option value="">选择要清除的博物馆</option>
                            {% for museum, count in museums %}
                                <option value="{{ museum }}">{{ museum }}（{{ count }} 件）</option>
                            {% endfor %}
                        </select>
                        <button type="submit" class="btn btn-clear">只清除这个博物馆</button>
                    </form>
                    <form action="/clear" method="post" class="toolbar">
                        <input type="hidden" name="clear_type" value="batch">
                        <select name="batch_id" required>
                            <option value="">选择要清除的导入批次</option>
                            {% for batch in batches %}
                                <option value="{{ batch.id }}">{{ batch.source_file }} / {{ batch.imported_at or "历史数据" }}（{{ batch.count }} 件）</option>
                            {% endfor %}
                        </select>
                        <button type="submit" class="btn btn-clear">只清除这个批次</button>
                    </form>
                    <form action="/clear" method="post" class="toolbar" onsubmit="return confirm('确定要清空所有馆藏吗？这个操作会影响全部博物馆。')">
                        <input type="hidden" name="clear_type" value="all">
                        <button type="submit" class="btn btn-clear">清空所有馆藏</button>
                    </form>
                </div>
                <div style="overflow-x: auto;">
                    <form action="/bulk" method="post">
                        <div class="bulk-zone sticky-actions">
                            <div class="toolbar" style="margin-top: 0;">
                                <label><input type="checkbox" onclick="toggleAll(this)"> 全选</label>
                                <button type="submit" name="action" value="delete" class="btn btn-clear" onclick="return confirmBulk('删除')">删除选中</button>
                                <input type="text" name="target_museum" placeholder="移动到：例如 苏州博物馆" style="padding: 10px; min-width: 260px; border: 1px solid #d2b48c; border-radius: 5px;">
                                <button type="submit" name="action" value="move" class="btn" onclick="return confirmBulk('移动')">移动选中</button>
                            </div>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>选择</th>
                                    <th>操作</th>
                                    {% for key in data[0].keys() %}<th>{{ key }}</th>{% endfor %}
                                </tr>
                            </thead>
                            <tbody>
                                {% for row in data %}
                                    <tr>
                                        <td><input type="checkbox" name="selected" value="{{ loop.index0 }}"></td>
                                        <td><a class="btn-small btn-secondary" href="/edit/{{ loop.index0 }}">编辑</a></td>
                                        {% for value in row.values() %}<td>{{ value }}</td>{% endfor %}
                                    </tr>
                                {% endfor %}
                            </tbody>
                        </table>
                    </form>
                </div>
            {% else %}
                <p style="text-align: center; font-size: 20px;">🏮 博物馆目前空空如也...</p>
            {% endif %}
        </div>
    </div>
</body>
</html>
'''

EDIT_TEMPLATE = '''
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
    <div class="header">
        <h1>编辑文物数据</h1>
    </div>
    <div class="container">
        <div class="card">
            <form action="/edit/{{ index }}" method="post">
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
                <div class="toolbar">
                    <button type="submit" class="btn">保存修改</button>
                    <a href="/" class="btn btn-secondary">返回后台</a>
                </div>
            </form>
        </div>
    </div>
</body>
</html>
'''

@app.route('/')
def index():
    data = load_data()
    return render_template_string(
        HTML_TEMPLATE,
        data=data,
        batches=get_batch_summaries(data),
        museums=get_museum_summaries(data)
    )

@app.route('/bulk', methods=['POST'])
def bulk_action():
    data = load_data()
    selected = parse_selected_indices(request.form)
    action = request.form.get('action', '')

    if not selected:
        return redirect('/')

    if action == 'delete':
        for index in selected:
            if 0 <= index < len(data):
                data.pop(index)
        save_data(data)
        return redirect('/')

    if action == 'move':
        target_museum = clean_value(request.form.get('target_museum'))
        if not target_museum:
            return redirect('/')
        for index in selected:
            if 0 <= index < len(data):
                set_item_museum(data[index], target_museum)
        save_data(data)
        return redirect('/')

    return redirect('/')

@app.route('/edit/<int:index>', methods=['GET', 'POST'])
def edit_item(index):
    data = load_data()
    if index < 0 or index >= len(data):
        return redirect('/')

    item = data[index]
    if request.method == 'POST':
        field_map = {
            'artifact_id': ['文物唯一编号', '文物编号', 'id'],
            'name': ['文物名称', '名称', 'name'],
            'museum': ['所属博物馆', '博物馆', 'museum'],
            'period': ['朝代', '所属年代', '年代', 'period', 'dynasty'],
            'category': ['类别', '文物类别', 'category'],
            'level': ['等级', '级别', 'level'],
            'material': ['材质', '质地', 'material'],
            'dimensions': ['尺寸', '规格', 'dimensions', 'size'],
            'origin': ['出土地', '出土地点 / 来源', '来源', 'origin'],
            'short_intro': ['一句话简介', '短简介', '摘要', 'shortIntro'],
            'image_url': ['图片链接', '高精度图片链接', '图片URL', 'imageUrl', 'image_url'],
            'source_url': ['来源链接', '数据来源', '原文链接', 'sourceUrl', 'source_url'],
            'culture': ['文化', '文化类型', 'culture'],
            'description': ['文物描述', '文物简介', '简介', 'description'],
            'remarks': ['备注', '附注', 'notes', 'remarks'],
        }

        for form_name, keys in field_map.items():
            value = clean_value(request.form.get(form_name))
            if form_name == 'museum':
                set_item_museum(item, value)
                continue
            primary_key = keys[0]
            item[primary_key] = value

        save_data(data)
        return redirect('/')

    fields = [
        {"name": "artifact_id", "label": "文物编号", "value": pick(item, '文物唯一编号', '文物编号', '藏品编号', '编号', 'id'), "type": "input"},
        {"name": "name", "label": "文物名称", "value": pick(item, '文物名称', '名称', '藏品名称', '题名', 'name', 'title'), "type": "input"},
        {"name": "museum", "label": "所属博物馆", "value": detect_museum(item), "type": "input"},
        {"name": "period", "label": "朝代 / 年代", "value": pick(item, '朝代', '所属年代', '年代', '时代', '时期', 'dynasty', 'period', 'era'), "type": "input"},
        {"name": "category", "label": "类别", "value": pick(item, '类别', '文物类别', '藏品类别', '类型', 'category'), "type": "input"},
        {"name": "level", "label": "等级", "value": pick(item, '等级', '级别', '文物等级', '保护级别', 'level'), "type": "input"},
        {"name": "material", "label": "材质", "value": pick(item, '材质', '质地', '材料', 'material', 'medium'), "type": "input"},
        {"name": "dimensions", "label": "尺寸", "value": pick(item, '尺寸', '规格', '体量', '长宽高', 'size', 'dimensions'), "type": "input"},
        {"name": "origin", "label": "出土地 / 来源", "value": pick(item, '出土地', '出土地点 / 来源', '来源', '发现地', 'origin', 'provenance'), "type": "input"},
        {"name": "short_intro", "label": "一句话简介", "value": pick(item, '一句话简介', '短简介', '摘要', 'shortIntro', 'short_intro', 'summary'), "type": "input"},
        {"name": "image_url", "label": "图片链接", "value": pick(item, '图片链接', '高精度图片链接', '图片URL', '图片', '照片', 'imageUrl', 'image_url', 'image', 'img', 'thumbnail'), "type": "input"},
        {"name": "source_url", "label": "来源链接", "value": pick(item, '来源链接', '数据来源', '原文链接', 'sourceUrl', 'source_url'), "type": "input"},
        {"name": "culture", "label": "文化", "value": pick(item, '文化', '文化类型', 'culture'), "type": "input"},
        {"name": "description", "label": "简介 / 描述", "value": pick(item, '文物描述', '文物简介', '简介', '介绍', 'description', 'summary'), "type": "textarea"},
        {"name": "remarks", "label": "备注", "value": pick(item, '备注', '附注', '说明', 'notes', 'remarks', 'remark'), "type": "textarea"},
    ]

    return render_template_string(EDIT_TEMPLATE, index=index, fields=fields)

@app.route('/upload', methods=['POST'])
def upload_file():
    file = request.files.get('file')
    default_museum = request.form.get('default_museum')
    if not file or file.filename == '': return redirect('/')
    print(f"收到文件上传请求：{file.filename}，默认博物馆：{default_museum}")
    try:
        if file.filename.endswith('.csv'): 
            df = pd.read_csv(file)
            new_data = df.astype(str).to_dict(orient='records')
        elif file.filename.endswith(('.json', '.txt')):
            # 如果是 JSON 或 TXT 文件，先尝试各种强力解析
            content = file.read().decode('utf-8').strip()
            print(f"正在尝试解析内容，前100个字符：{content[:100]}")
            
            try:
                # 尝试1：标准 JSON
                new_data = json.loads(content)
                print("解析成功：标准 JSON 格式")
            except:
                try:
                    # 尝试2：Python 字面量格式（处理单引号、反引号）
                    # 先把内容里的反引号去掉，这玩意儿最干扰解析
                    clean_content = content.replace('`', '')
                    new_data = ast.literal_eval(clean_content)
                    print("解析成功：Python 列表格式")
                except Exception as e:
                    print(f"所有解析尝试均失败：{e}")
                    return redirect('/')
            
            # 确保它是一个列表格式
            if not isinstance(new_data, list):
                new_data = [new_data]
        else: 
            df = pd.read_excel(file)
            new_data = df.astype(str).to_dict(orient='records')
        
        print(f"成功读到 {len(new_data)} 条新文物数据！")
        batch_id = datetime.now().strftime('%Y%m%d%H%M%S')
        imported_at = datetime.now().isoformat(timespec='seconds')
        normalized_new_data = []
        for item in new_data:
            if not isinstance(item, dict):
                continue
            item = dict(item)
            item['__import_batch'] = batch_id
            item['__imported_at'] = imported_at
            item['__source_file'] = file.filename
            if default_museum:
                item['__default_museum'] = default_museum
            normalized_new_data.append(item)
        
        # 拿到现有数据，准备合并
        existing = load_data()
        
        # 为了让馆长能“去重并同步”，我们在这里做个简单的检查
        existing_keys = {
            (
                pick(item, '文物唯一编号', '文物编号', '藏品编号', '编号', 'id'),
                pick(item, '文物名称', '名称', '藏品名称', '题名', 'name', 'title'),
                detect_museum(item)
            )
            for item in existing
        }
        
        added_count = 0
        for item in normalized_new_data:
            item_key = (
                pick(item, '文物唯一编号', '文物编号', '藏品编号', '编号', 'id'),
                pick(item, '文物名称', '名称', '藏品名称', '题名', 'name', 'title'),
                detect_museum(item)
            )
            if item_key not in existing_keys:
                existing.append(item)
                existing_keys.add(item_key)
                added_count += 1
        
        print(f"其中 {added_count} 条是新宝贝，正在同步...")
        save_data(existing)
        
    except Exception as e:
        print(f"导入过程彻底出错：{e}")
    return redirect('/')

@app.route('/clear', methods=['POST'])
def clear_data():
    clear_type = request.form.get('clear_type', 'all')
    museum = request.form.get('museum', '')
    batch_id = request.form.get('batch_id', '')
    existing = load_data()

    if clear_type == 'museum' and museum:
        print(f"清除博物馆数据：{museum}")
        remaining = [item for item in existing if detect_museum(item) != museum]
    elif clear_type == 'batch' and batch_id:
        print(f"清除导入批次：{batch_id}")
        remaining = [
            item for item in existing
            if (clean_value(item.get('__import_batch')) or 'legacy') != batch_id
        ]
    else:
        print("清空所有馆藏数据！")
        remaining = []

    save_data(remaining)
    return redirect('/')

if __name__ == '__main__':
    # 改到 9999 号，避开系统占用的端口
    print("博悟管理后台正在启动，请访问：http://localhost:9999")
    app.run(debug=True, port=9999)
