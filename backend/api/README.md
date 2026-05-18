# backend/api 文件夹说明

## 整体作用
Express.js API 服务器的完整实现。定义所有 HTTP 接口、控制器逻辑、数据库操作、路由管理。这是前后端通信的枢纽。

## 核心文件

### 🔴 最关键的文件

**server.ts** - ⭐ Express 服务器启动文件
- 初始化 Express 应用
- 配置 JSON 中间件
- 定义所有 API 路由
- 启动服务器监听（默认端口 3000）
- 包含所有路由定义：
  - `/api/health` - 健康检查
  - `/api/auth/*` - 认证相关
  - `/api/artifacts/*` - 文物管理
  - `/api/exhibitions/*` - 展陈管理
  - `/api/likes/*` - 点赞管理
  - `/api/admin/*` - 管理员接口

### 🟡 其他核心文件

## 子目录说明

| 目录 | 说明 |
|------|------|
| **controllers/** | 请求处理逻辑 |
| **routes/** | 路由定义 |
| **middleware/** | Express 中间件 |
| **models/** | 数据类型定义 |
| **db/** | 数据库相关 |

## API 端点一览

### 认证相关 `/api/auth`
- `POST /api/auth/register` - 注册用户
- `POST /api/auth/login` - 登录用户
- `GET /api/auth/me` - 获取当前用户信息

### 文物管理 `/api/artifacts`
- `GET /api/artifacts` - 列表（分页、搜索、筛选）
- `GET /api/artifacts/:id` - 获取详情
- `POST /api/artifacts` - 创建（管理员）
- `PUT /api/artifacts/:id` - 更新（管理员）
- `DELETE /api/artifacts/:id` - 删除（管理员）

### 展陈管理 `/api/exhibitions`
- `GET /api/exhibitions` - 列表
- `POST /api/exhibitions` - 创建
- `PUT /api/exhibitions/:id` - 更新
- `DELETE /api/exhibitions/:id` - 删除

### 点赞/收藏 `/api/likes`
- `POST /api/likes` - 添加点赞
- `DELETE /api/likes/:id` - 取消点赞
- `GET /api/likes` - 获取用户点赞列表

### 管理员 `/api/admin`
- `GET /api/admin/users` - 用户列表
- `GET /api/admin/stats` - 系统统计

## 请求/响应流程

### 典型的 API 调用流程

```
前端发送请求
  ↓
Express 接收请求
  ↓
检查 URL 路由
  ├─ 匹配对应的 route handler
  └─ 传递给 controller
  ↓
Controller 处理请求
  ├─ 验证参数
  ├─ 调用业务逻辑
  └─ 处理错误
  ↓
返回响应
  ├─ 200: 成功返回数据
  ├─ 400: 参数错误
  ├─ 401: 需要认证
  ├─ 403: 权限不足
  └─ 500: 服务器错误
  ↓
前端接收 JSON 响应
```

## 中间件执行顺序

```
Express 服务器
  ↓
1. express.json() - 解析 JSON body
  ↓
2. authMiddleware (某些路由) - 检查 token
  ↓
3. requireAdmin (某些路由) - 检查管理员权限
  ↓
4. Route Handler (具体业务逻辑)
```

## 错误处理

### 标准错误响应格式

```javascript
// 成功响应
{ 
  status: 200,
  data: { /* 返回数据 */ }
}

// 错误响应
{
  status: 400,
  error: "错误消息"
}
```

### 常见 HTTP 状态码

| 状态码 | 含义 | 示例 |
|-------|------|------|
| 200 | OK，请求成功 | 登录成功 |
| 400 | Bad Request，请求格式错误 | 缺少必要参数 |
| 401 | Unauthorized，需要认证 | 没有 token |
| 403 | Forbidden，权限不足 | 非管理员操作 |
| 404 | Not Found，资源不存在 | 用户不存在 |
| 500 | Server Error，服务器错误 | 数据库错误 |

## 快速参考

### 前端调用示例

```javascript
// 注册
POST /api/auth/register
Body: { password, confirmPassword }

// 登录
POST /api/auth/login
Body: { museId, password }

// 获取文物列表
GET /api/artifacts?q=搜索词&limit=20

// 添加点赞
POST /api/likes
Body: { artifactId }
Header: Authorization: Bearer <token>
```

### 需要认证的端点

所有带 🔒 标记的端点都需要有效的 JWT token：
- GET /api/auth/me 🔒
- POST /api/artifacts 🔒 （仅管理员）
- POST /api/likes 🔒
- DELETE /api/likes/:id 🔒
- 等等

### 仅限管理员的端点

- POST /api/artifacts （创建文物）
- PUT /api/artifacts/:id （修改文物）
- DELETE /api/artifacts/:id （删除文物）
- GET /api/admin/users
- GET /api/admin/stats

## 配置和部署

### 默认配置
- 端口：3000（可通过 PORT 环境变量修改）
- 主机：0.0.0.0（监听所有 IP）

### 环境变量
- `PORT` - 服务器端口（默认 3000）
- `JWT_SECRET` - JWT 签名密钥（必需）

### 启动服务器
```bash
npm run dev          # 开发模式（自动重启）
npm run dev:backend  # 后端服务器模式
```
# MuseLink（博悟）Backend API

This folder is a standalone backend skeleton for:
- 全国博物馆文物聚合
- AI 智能策展（当前内置 fallback 生成器，保证可离线运行）
- 用户体系（编号 + 密码 + JWT）
- 收藏/点赞

## Quick start

### Option A (recommended for “just run”): in-memory Postgres (pg-mem)

1) Seed artifacts into memory DB and run backend
```bash
USE_PGMEM=1 npm run db:seed
USE_PGMEM=1 JWT_SECRET=dev_secret npm run dev:backend
```

### Option B: real PostgreSQL (your local Postgres or Docker)

1) (Optional) If you have Docker, start Postgres
```bash
npm run db:up
```

2) Create schema & seed artifacts
```bash
npm run db:migrate
npm run db:seed
```

3) Run backend
```bash
JWT_SECRET=dev_secret npm run dev:backend
```
