# imports 文件夹说明

## 整体作用
数据导入模板和示例。存储要导入到应用中的外部数据源。这些文件用于演示支持的数据格式和导入流程。

## 导入流程

```
准备导入文件 (在 imports/ 目录)
  ↓
运行导入脚本
  ↓
脚本解析文件格式
  ↓
应用数据映射和转换
  ↓
验证数据
  ↓
导入到 data/imported-artifacts.json
```

## 支持的数据格式

### 1. JSON 格式 (推荐)

**example-national-museum.json**
```json
[
  {
    "id": "artifact-001",
    "name": "青花瓷瓶",
    "museum": "故宫博物院",
    "era": "明朝",
    "material": "青花瓷",
    "description": "清晰的青花纹样...",
    "imageUrl": "https://example.com/image.jpg"
  },
  {
    "id": "artifact-002",
    "name": "金字塔模型",
    "museum": "埃及博物馆",
    "era": "古埃及",
    "material": "黄金",
    "description": "精致的黄金工艺...",
    "imageUrl": "https://example.com/pyramid.jpg"
  }
]
```

### 2. CSV 格式

**artifacts.csv**
```csv
id,name,museum,era,material,description,imageUrl
artifact-001,青花瓷瓶,故宫博物院,明朝,青花瓷,清晰的青花纹样...,https://...
artifact-002,金字塔模型,埃及博物馆,古埃及,黄金,精致的黄金工艺...,https://...
```

### 3. NDJSON 格式 (换行分隔的 JSON)

**artifacts.ndjson**
```
{"id":"artifact-001","name":"青花瓷瓶","museum":"故宫博物院","era":"明朝","material":"青花瓷","description":"...","imageUrl":"..."}
{"id":"artifact-002","name":"金字塔模型","museum":"埃及博物馆","era":"古埃及","material":"黄金","description":"...","imageUrl":"..."}
```

## 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| id | string | ✅ | 文物唯一标识符 |
| name | string | ✅ | 文物名称 |
| museum | string | ❌ | 所属博物馆 |
| era | string | ❌ | 时代（如"明朝"、"清代"） |
| material | string | ❌ | 材质（如"瓷器"、"黄金"） |
| description | string | ❌ | 详细描述 |
| imageUrl | string | ❌ | 文物图片 URL |

## 导入命令

### 基本导入
```bash
npm run import:artifacts -- --input imports/example-national-museum.json
```

### 指定导入模式
```bash
# 追加模式（新数据添加到现有数据）
npm run import:artifacts -- --input data.json --mode append

# 替换模式（替换特定博物馆数据）
npm run import:artifacts -- --input data.json --mode replace-museum

# 完全替换（清空现有数据，导入新数据）
npm run import:artifacts -- --input data.json --mode replace-all
```

### 指定输出位置
```bash
npm run import:artifacts -- --input data.json --output ./custom-output.json
```

## 创建自己的导入文件

### 步骤 1：准备数据

收集文物信息，创建 JSON 文件：
```json
[
  {
    "id": "my-artifact-1",
    "name": "文物名称",
    "museum": "博物馆名称",
    "era": "时代",
    "material": "材质",
    "description": "详细描述",
    "imageUrl": "https://example.com/image.jpg"
  }
]
```

### 步骤 2：放在 imports 文件夹
```bash
cp my-data.json imports/
```

### 步骤 3：导入数据
```bash
npm run import:artifacts -- --input imports/my-data.json
```

### 步骤 4：验证结果
在应用中检查导入的数据是否正确显示。

## 字段映射

如果源数据的字段名不同，可以使用字段映射：

```bash
# 指定字段映射配置
npm run import:artifacts -- \
  --input data.json \
  --map-name "文物名称" \
  --map-museum "馆名" \
  --map-era "历代"
```

## 常见问题

### 导入失败：格式错误
**原因：** JSON 格式不正确
**解决：** 使用 JSON 验证工具检查文件

### 导入失败：必需字段缺失
**原因：** 缺少 id 或 name 字段
**解决：** 确保每条记录都有 id 和 name

### 导入结果不符合预期
**原因：** 文件编码不是 UTF-8
**解决：** 使用 UTF-8 编码保存文件

### 如何批量编辑图片 URL？

```bash
# 使用文本编辑工具的查找替换
# 将旧域名替换为新域名
# 从：https://old-domain.com/
# 替换为：https://new-domain.com/
```

## 数据来源建议

### 公开博物馆数据
- 故宫博物院 API
- 国家博物馆开放数据
- UNESCO 文物数据库
- 各地方博物馆网站

### 数据采集方式
1. **API 调用** - 直接从博物馆 API 获取（最佳）
2. **网页爬取** - 使用爬虫从网站提取（需要遵守 robots.txt）
3. **手工录入** - 小规模数据可手工录入
4. **CSV 导入** - 从 Excel 或数据库导出

## 导入后管理

### 查看导入结果
```bash
# 在应用中刷新首页
# 或检查 data/imported-artifacts.json
cat data/imported-artifacts.json | jq '.artifacts | length'
```

### 修改导入数据
直接编辑 `data/imported-artifacts.json`

### 回滚导入
```bash
# 恢复到导入前
cp data/imported-artifacts.backup.json data/imported-artifacts.json
```

## 导入优化

### 大文件处理
对于大文件（>10MB），使用分批导入：
1. 将文件拆分为多个小文件
2. 分别导入每个文件
3. 或使用流式处理

### 去重处理
如果数据中有重复，导入脚本会：
- 按 id 检测重复
- 根据导入模式决定是否覆盖
- append 模式：保留旧数据
- replace 模式：使用新数据

## 快速参考

```bash
# 查看导入帮助
npm run import:artifacts -- --help

# 预览导入结果（不实际导入）
npm run import:artifacts -- --input data.json --preview

# 导入并显示详细日志
npm run import:artifacts -- --input data.json --verbose
```
