# data 文件夹说明

## 整体作用
本地 JSON 数据存储。存储所有应用数据的持久化副本。这些文件在开发时充当数据库，可以直接编辑、版本控制和备份。

## 数据文件

### 🔴 最关键的文件

**auth-users.json** - ⭐ 用户账户数据
```json
{
  "version": 1,
  "users": [
    {
      "id": 100000,
      "museId": "12345678",
      "passwordHash": "$2a$12$...",
      "createdAt": "2026-04-20T12:00:00Z",
      "profile": {
        "displayName": "用户名",
        "photoURL": "...",
        "role": "user"
      }
    }
  ],
  "nextId": 100001
}
```

| 字段 | 说明 |
|------|------|
| id | 内部用户 ID |
| museId | MuseLink ID (8-10 位数字) |
| passwordHash | bcrypt 加密后的密码 |
| createdAt | 账户创建时间 |
| role | user 或 admin |

**imported-artifacts.json** - ⭐ 文物数据库
```json
{
  "version": 1,
  "artifacts": [
    {
      "id": "artifact-001",
      "name": "青花瓷瓶",
      "museum": "故宫博物院",
      "era": "明朝",
      "material": "青花瓷",
      "description": "...",
      "imageUrl": "https://...",
      "createdAt": "2026-04-20T12:00:00Z"
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| id | 文物唯一 ID |
| name | 文物名称 |
| museum | 所属博物馆 |
| era | 时代（如"明朝"、"清代") |
| material | 材质 |
| description | 详细描述 |
| imageUrl | 文物图片 URL |

**imported-museums.json** - ⭐ 博物馆数据库（由省级馆基准名单 + 文物库联动生成）
```json
{
  "version": 1,
  "museums": [
    {
      "id": "故宫博物院",
      "name": "故宫博物院",
      "description": "故宫博物院馆藏文物数据库，当前收录 12 件文物。",
      "location": "",
      "imageUrl": "https://...",
      "artifactIds": ["artifact-001", "artifact-002"],
      "artifactCount": 12,
      "periods": ["明", "清"],
      "materials": ["陶瓷", "书画"],
      "updatedAt": "2026-04-20T12:00:00Z"
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| id/name | 博物馆唯一标识与名称 |
| artifactIds | 该馆所属文物 ID 列表 |
| artifactCount | 该馆文物数量 |
| periods/materials | 由馆内文物汇总出的年代与材质 |
| imageUrl | 默认使用该馆热度最高文物图片 |

> `imported-artifacts.json` 中每件文物的 `museum` 字段是联动源；服务启动或调用 `/api/museums`、执行导入后，会刷新 `imported-museums.json`。系统会同时保留 34 个省级行政区对应的省级综合性博物馆基础接口记录，因此没有导入馆藏文物的省级馆也会出现在 `/api/museums`。

**exhibitions.json** - ⭐ 展陈数据
```json
{
  "version": 1,
  "exhibitions": [
    {
      "id": "exhibit-001",
      "name": "故宫精品展",
      "theme": "皇家收藏",
      "description": "...",
      "artifactIds": ["artifact-001", "artifact-002"],
      "createdAt": "2026-04-20T12:00:00Z"
    }
  ]
}
```

### 🟡 其他数据文件

**user-data.json** - 用户个人数据（收藏、点赞等）
```json
{
  "version": 1,
  "userLikes": [
    {
      "userId": 100000,
      "artifactIds": ["artifact-001", "artifact-002"],
      "createdAt": "2026-04-20T12:00:00Z"
    }
  ]
}
```

**auth-user-seq.json** - 用户 ID 序列号
```json
{
  "nextId": 100001
}
```

## 编辑数据

### 直接编辑 JSON

可以直接编辑这些 JSON 文件来修改数据：

```bash
# 编辑用户数据
open data/auth-users.json

# 编辑文物数据
open data/imported-artifacts.json

# 编辑展陈数据
open data/exhibitions.json
```

### 添加新用户
在 `data/auth-users.json` 中：
```json
{
  "id": 100001,
  "museId": "98765432",
  "passwordHash": "bcrypt hash...",
  "createdAt": "2026-04-20T12:00:00Z",
  "profile": {
    "displayName": "新用户",
    "role": "user"
  }
}
```

### 添加新文物
在 `data/imported-artifacts.json` 中：
```json
{
  "id": "artifact-003",
  "name": "古董手镯",
  "museum": "国家博物馆",
  "era": "汉代",
  "material": "黄金",
  "description": "...",
  "imageUrl": "https://...",
  "createdAt": "2026-04-20T12:00:00Z"
}
```

### 上传杂乱文物信息
导入器会自动从常见字段名和长文本中抓取核心字段，不需要每次都手动写完整 `mapping`。优先识别：

| 目标字段 | 可自动识别的信息 |
|------|------|
| name | 名称、文物名称、藏品名称、题名、title、name |
| museum | 所属博物馆、馆藏单位、收藏单位、现藏、藏于，以及文本中的“xx博物馆/xx博物院” |
| period | 年代、时代、朝代、时期、dynasty、period、era |
| material | 材质、质地、材料、material、medium |
| description | 简介、介绍、说明、描述、summary、description |
| imageUrl | 图片、图片链接、imageUrl，或文本中的图片 URL |

示例：即使记录里有多余字段，也可以被整理成标准文物数据：
```json
{
  "raw": "名称：错金银云纹青铜犀尊\n收藏单位：中国国家博物馆\n年代：西汉\n材质：青铜\n简介：这是一段说明。",
  "广告字段": "不用管",
  "图片链接": "https://example.com/a.jpg"
}
```

导入写入后，系统会同步刷新 `imported-museums.json`，因此可以继续按博物馆查看馆内文物。

## 备份和恢复

### 自动备份
系统会在修改时自动创建备份：
```
imported-artifacts.json
imported-artifacts.json.bak
```

### 手动备份
```bash
cp data/imported-artifacts.json data/imported-artifacts.backup.json
cp data/exhibitions.json data/exhibitions.backup.json
```

### 恢复数据
```bash
# 恢复文物数据
cp data/imported-artifacts.backup.json data/imported-artifacts.json

# 恢复展陈数据
cp data/exhibitions.backup.json data/exhibitions.json
```

## 版本控制

这些文件可以加入 Git 版本控制：
```bash
git add data/
git commit -m "Update artifact and exhibition data"
```

⚠️ **注意：** 不要提交包含真实密码的用户数据（auth-users.json 中的密码哈希）

## 数据导入

使用脚本从外部源批量导入数据：
```bash
npm run import:artifacts -- --input imports/example-museum.json
```

更详细信息查看 [scripts/README.md](../scripts/README.md)

## 数据格式校验

添加或编辑数据后，确保：
- ✅ JSON 格式有效
- ✅ 必需字段完整
- ✅ ID 唯一（museum 字段）
- ✅ 时间戳为 ISO 8601 格式
- ✅ URL 有效

## 常见问题

| 问题 | 解决方案 |
|------|--------|
| JSON 格式错误 | 使用 JSON 验证工具检查 |
| 数据丢失 | 从备份文件恢复 |
| ID 重复 | 检查并修改重复的 ID |
| 时间戳格式不对 | 使用 ISO 8601 格式：`2026-04-20T12:00:00Z` |
