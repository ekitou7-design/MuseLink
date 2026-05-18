# backend 文件夹说明

## 整体作用
后端业务逻辑层。包含用户认证、文物数据管理、用户数据管理、展陈管理等核心业务逻辑。这一层负责数据处理，与数据库和 API 路由之间的中间层。

## 核心文件

### 🔴 最关键的文件

**auth.ts** - ⭐ 认证业务逻辑
- `registerUser()` - 用户注册逻辑
  - 生成唯一的 MuseLink ID
  - 对密码进行加密（bcrypt）
  - 创建用户记录
  
- `loginUser()` - 用户登录逻辑
  - 查找用户
  - 验证密码
  - 生成 JWT token
  
- `verifyToken()` - 验证 JWT token
  - 解析 token
  - 检查是否过期
  - 提取用户信息
  
- `authMiddleware()` - Express 中间件
  - 自动检查每个请求的 Authorization header
  - 验证 token
  - 提取用户 ID 和角色
  
- `requireAdmin()` - Express 中间件
  - 检查用户是否为管理员
  - 非管理员返回 403 Forbidden

**store.ts** - ⭐ JSON 文件存储
- `readJsonFile()` - 读取 JSON 数据文件
- `writeJsonFile()` - 写入 JSON 数据文件
- 支持自动创建备份和原子写入
- 所有数据都存储为 JSON 文件在 `data/` 目录

**artifact-importer.ts** - ⭐ 文物数据导入
- `executeArtifactImport()` - 执行导入任务
- `previewArtifactImport()` - 预览导入结果
- 支持多种数据格式：JSON、CSV、NDJSON
- 灵活的字段映射和默认值设置
- 三种导入模式：追加、替换博物馆、完全替换

### 🟡 其他业务逻辑

**user-data.ts** - 用户数据管理
- 用户收藏管理
- 用户关注管理

**exhibitions.ts** - 展陈管理
- 创建展陈
- 删除展陈
- 列出展陈

## 数据存储方式

### JSON 文件存储位置
```
data/
├── auth-users.json          # 所有用户账号（包含密码哈希）
├── auth-user-seq.json       # 用户 ID 序列号
├── imported-artifacts.json  # 文物数据库
├── exhibitions.json         # 展陈数据
└── user-data.json          # 用户收藏、关注等
```

### 数据结构示例

**auth-users.json**
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
  ]
}
```

## 核心流程

### 注册流程
```
前端调用 POST /api/auth/register
  ↓
server.ts 路由到 registerUser()
  ↓
auth.ts generateMuseId() 生成唯一 ID
  ↓
bcrypt.hash() 加密密码
  ↓
loadAuthDb() 读取用户数据库
  ↓
向数据库添加新用户
  ↓
saveAuthDb() 保存数据库
  ↓
返回 { museId: "12345678" }
```

### 登录流程
```
前端调用 POST /api/auth/login
  ↓
server.ts 路由到 loginUser()
  ↓
loadAuthDb() 读取用户数据库
  ↓
查找 MuseLink ID 对应的用户
  ↓
bcrypt.compare() 验证密码
  ↓
jwt.sign() 生成 JWT token
  ↓
返回 { token, museId, role }
  ↓
Token 存储在前端 localStorage
```

### 文物导入流程
```
前端或脚本调用导入命令
  ↓
读取导入配置文件
  ↓
读取数据源（JSON/CSV 文件）
  ↓
通过字段映射提取数据
  ↓
验证每条记录
  ↓
生成预览（可选）
  ↓
决定是追加还是替换
  ↓
保存到 imported-artifacts.json
```

## 子目录结构

| 目录 | 说明 |
|------|------|
| **api/** | Express 服务器相关（路由、控制器、中间件） |

## 重要说明

### 为什么使用 JSON 文件而不是数据库？

✅ 优点：
- 开发简单，无需配置数据库
- 数据易于查看和修改
- 适合小型项目或演示
- 易于版本控制

❌ 缺点：
- 不适合大规模数据
- 并发访问有限制
- 查询性能较差

⚠️ 未来如果数据量变大，可升级为 PostgreSQL 等数据库。

### 密码安全

- 使用 bcrypt 算法加密（Salt rounds = 12）
- 密码长度限制：8-64 位
- 存储时只保存 hash，不保存原文
- 登录时通过 bcrypt.compare() 验证

### JWT Token

- 有效期：7 天
- 包含信息：用户 ID、角色、MuseLink ID
- 存储位置：前端 localStorage
- 传输方式：HTTP Header `Authorization: Bearer <token>`

## 快速参考

| 操作 | 涉及文件 | 功能 |
|------|--------|------|
| 用户注册 | auth.ts | registerUser() |
| 用户登录 | auth.ts | loginUser() |
| Token 验证 | auth.ts | verifyToken() |
| API 保护 | auth.ts | authMiddleware() |
| 管理员检查 | auth.ts | requireAdmin() |
| 导入文物 | artifact-importer.ts | executeArtifactImport() |
| 预览导入 | artifact-importer.ts | previewArtifactImport() |
