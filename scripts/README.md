# scripts 文件夹说明

## 整体作用
数据导入和处理脚本。包含将外部数据源（JSON、CSV 等）导入到应用中的工具。这些脚本在开发和数据管理过程中使用。

## 核心文件

### 🔴 最关键的文件

**import-artifacts.ts** - ⭐ 文物数据导入脚本
- 从外部数据源导入文物信息
- 支持多种格式：JSON、CSV、NDJSON
- 灵活的字段映射
- 多种导入模式：
  - `append` - 追加（不覆盖现有数据）
  - `replace-museum` - 替换特定博物馆数据
  - `replace-all` - 完全替换所有数据

### 使用方式

```bash
# 基本导入
npm run import:artifacts -- --input ./imports/example-museum.json

# 指定导入模式
npm run import:artifacts -- --input data.json --mode replace-all

# 指定输出位置
npm run import:artifacts -- --input data.json --output ./custom-output.json
```

## 导入流程

```
用户运行脚本
  ↓
脚本读取输入文件
  ├─ 检测文件格式（JSON/CSV/NDJSON）
  └─ 解析数据
  ↓
应用字段映射
  ├─ 重命名字段
  ├─ 提取嵌套数据
  └─ 应用默认值
  ↓
验证数据
  ├─ 检查必需字段
  ├─ 验证字段类型
  └─ 检查数据完整性
  ↓
根据导入模式处理
  ├─ append: 直接添加
  ├─ replace-museum: 删除该博物馆的旧数据
  └─ replace-all: 清空现有数据
  ↓
保存到 imported-artifacts.json
  ↓
返回导入统计信息
```

## 数据格式示例

### 输入格式（JSON）
```json
[
  {
    "id": "artifact-001",
    "name": "青花瓷瓶",
    "museum": "故宫博物院",
    "era": "明朝",
    "material": "青花瓷",
    "description": "...",
    "imageUrl": "https://..."
  }
]
```

### 输出格式（imported-artifacts.json）
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

## 快速参考

| 任务 | 命令 |
|------|------|
| 导入文物数据 | `npm run import:artifacts -- --input file.json` |
| 追加数据 | `npm run import:artifacts -- --input file.json --mode append` |
| 替换数据 | `npm run import:artifacts -- --input file.json --mode replace-all` |
| 查看帮助 | `npm run import:artifacts -- --help` |

## 错误处理

### 常见问题

| 问题 | 解决方案 |
|------|--------|
| 文件不存在 | 检查输入文件路径是否正确 |
| 格式不支持 | 使用 JSON、CSV 或 NDJSON 格式 |
| 字段缺失 | 检查必需字段是否齐全 |
| 导入失败 | 查看错误日志，调整数据或字段映射 |

## 字段映射

导入脚本支持自定义字段映射。常见映射：
```javascript
{
  "input_name": "name",           // 将 input_name 映射到 name
  "museum_id": "museum",          // 博物馆 ID 映射到 museum 字段
  "photo_url": "imageUrl",        // 图片 URL 映射
  "era_period": "era"             // 时代字段映射
}
```

## 导入模式详解

### append（追加）
- 新增数据追加到现有数据
- 不删除任何现有记录
- 适合增量更新
- 可能导致重复（如果 ID 重复）

### replace-museum（替换博物馆）
- 删除指定博物馆的旧数据
- 添加新数据
- 适合更新特定博物馆的文物
- 需要指定博物馆 ID

### replace-all（完全替换）
- 清空所有现有数据
- 导入新数据
- 适合初始化或大规模更新
- ⚠️ 谨慎使用，会丢失所有现有数据

## 备份和恢复

导入脚本会自动备份：
```
imported-artifacts.json          # 当前数据
imported-artifacts.backup.json   # 上一次备份
```

如需恢复：
```bash
cp imported-artifacts.backup.json imported-artifacts.json
```
