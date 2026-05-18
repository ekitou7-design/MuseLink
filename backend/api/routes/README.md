# backend/api/routes 文件夹说明

## 整体作用
路由定义层。定义所有 HTTP 接口的路径、方法、中间件和对应的控制器函数。这一层负责请求分发。

## 核心文件

### 路由文件列表

**authRoutes.ts** - ⭐ 认证路由
```
POST   /api/auth/register        → registerUser()
POST   /api/auth/login           → loginUser()
GET    /api/auth/me              → getCurrentUser() 🔒
```

**artifactRoutes.ts** - ⭐ 文物路由
```
GET    /api/artifacts            → getArtifacts()
GET    /api/artifacts/:id        → getArtifactById()
POST   /api/artifacts            → createArtifact() 🔒 👤
PUT    /api/artifacts/:id        → updateArtifact() 🔒 👤
DELETE /api/artifacts/:id        → deleteArtifact() 🔒 👤
```

**likeRoutes.ts** - ⭐ 点赞路由
```
POST   /api/likes                → addLike() 🔒
DELETE /api/likes/:id            → removeLike() 🔒
GET    /api/likes                → getUserLikes() 🔒
```

**exhibitionRoutes.ts** - 展陈路由
```
GET    /api/exhibitions          → getExhibitions()
POST   /api/exhibitions          → createExhibition() 🔒
PUT    /api/exhibitions/:id      → updateExhibition() 🔒
DELETE /api/exhibitions/:id      → deleteExhibition() 🔒
```

## 中间件说明

### 🔒 认证保护
- 需要有效的 JWT token
- 通过 `authMiddleware` 检查
- Token 从 Authorization header 提取

### 👤 管理员权限
- 需要是管理员角色
- 通过 `requireAdmin` 检查
- 在 authMiddleware 之后执行

## 路由执行流程

```
HTTP 请求 (如 POST /api/artifacts)
  ↓
Express 路由匹配
  ├─ 检查方法 (POST)
  └─ 检查路径 (/api/artifacts)
  ↓
执行中间件链
  ├─ authMiddleware 检查 token (如果指定了 🔒)
  ├─ requireAdmin 检查管理员权限 (如果指定了 👤)
  └─ 中间件通过
  ↓
调用控制器函数
  ├─ createArtifact()
  └─ 处理请求
  ↓
返回响应
```

## 快速参考

### 不需要认证的路由
```javascript
POST   /api/auth/register        // 注册
POST   /api/auth/login           // 登录
GET    /api/artifacts            // 浏览文物
GET    /api/artifacts/:id        // 查看文物详情
GET    /api/exhibitions          // 浏览展陈
```

### 需要认证的路由 (🔒)
```javascript
GET    /api/auth/me              // 获取当前用户
POST   /api/likes                // 添加点赞
DELETE /api/likes/:id            // 取消点赞
GET    /api/likes                // 查看我的点赞
POST   /api/exhibitions          // 创建展陈
```

### 需要管理员权限的路由 (👤)
```javascript
POST   /api/artifacts            // 创建文物
PUT    /api/artifacts/:id        // 修改文物
DELETE /api/artifacts/:id        // 删除文物
```

## 添加新路由

1. 创建新文件：`backend/api/routes/newRoutes.ts`
2. 定义路由：
```javascript
import express from "express";
import * as controller from "../controllers/newController";
import { authMiddleware, requireAdmin } from "../middleware/auth";

const router = express.Router();

// 公开路由
router.get("/", controller.getItems);

// 需要认证的路由
router.post("/", authMiddleware, controller.createItem);

// 仅限管理员
router.delete("/:id", authMiddleware, requireAdmin, controller.deleteItem);

export default router;
```

3. 在 `server.ts` 中导入并注册：
```javascript
import newRoutes from "./routes/newRoutes";
app.use("/api/new", newRoutes);
```

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| 404 Not Found | 路由不存在 | 检查路由定义和 URL |
| 401 Unauthorized | 缺少 token | 在请求 header 中添加 Authorization |
| 403 Forbidden | 权限不足 | 确认用户是否为管理员 |
| 400 Bad Request | 参数错误 | 检查请求参数格式 |
