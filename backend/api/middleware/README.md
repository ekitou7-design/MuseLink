# backend/api/middleware 文件夹说明

## 整体作用
Express 中间件。在请求到达控制器之前进行预处理（认证、授权、日志等）。

## 核心文件

### 🔴 最关键的文件

**auth.ts** - ⭐ 认证和授权中间件

- `authMiddleware` - 验证 JWT token
  ```javascript
  // 在路由中使用
  router.get("/me", authMiddleware, getCurrentUser);
  
  // 检查流程
  // 1. 从 Authorization header 提取 token
  // 2. 验证 token 有效性和签名
  // 3. 提取用户信息（museId、role）
  // 4. 将用户信息存储在 req.user 中
  // 5. 允许请求继续
  ```

- `requireAdmin` - 检查管理员权限
  ```javascript
  // 必须在 authMiddleware 之后使用
  router.post("/artifacts", authMiddleware, requireAdmin, createArtifact);
  
  // 检查流程
  // 1. 检查 req.user.role 是否为 "admin"
  // 2. 如果是管理员，继续
  // 3. 如果不是，返回 403 Forbidden
  ```

## 中间件执行流程

### 典型的受保护路由

```
HTTP 请求
  ↓
authMiddleware 执行
  ├─ 检查 Authorization header
  ├─ 解析 JWT token
  ├─ 验证签名
  ├─ 检查过期时间
  ├─ 提取用户信息
  └─ 存储在 req.user
  ↓
requireAdmin 执行（如果指定）
  ├─ 检查 req.user 是否存在
  ├─ 检查 req.user.role 是否为 "admin"
  └─ 如果不是管理员，返回 403
  ↓
控制器函数执行
  ├─ 可以使用 req.user 访问用户信息
  └─ 处理请求
  ↓
返回响应
```

## 错误响应

### 没有 token
```json
{
  "status": 401,
  "error": "No token provided"
}
```

### Token 无效
```json
{
  "status": 401,
  "error": "Invalid or expired token"
}
```

### 权限不足（非管理员）
```json
{
  "status": 403,
  "error": "Admin access required"
}
```

## 在控制器中使用用户信息

```javascript
// 在控制器中
export async function createArtifact(req, res) {
  // authMiddleware 已验证 token
  // 用户信息在 req.user 中
  
  const { museId, role } = req.user;
  
  console.log(`User ${museId} creating artifact`);
  
  // 继续处理请求
  const result = await artifact.create(req.body);
  res.json({ status: 200, data: result });
}
```

## 快速参考

### 保护路由示例

```javascript
import { authMiddleware, requireAdmin } from "../middleware/auth";

// 仅需认证
router.get("/me", authMiddleware, getCurrentUser);

// 需要认证且为管理员
router.post("/artifacts", authMiddleware, requireAdmin, createArtifact);

// 公开路由（不需要中间件）
router.get("/artifacts", getArtifacts);
```

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 401 错误 | token 不存在或无效 | 检查 Authorization header 和 token 内容 |
| 403 错误 | 用户非管理员 | 确认用户角色或使用管理员账户 |
| token 过期 | JWT 有效期已过 | 重新登录获取新 token |

## 添加新中间件

如需添加其他中间件（如日志、速率限制等）：

1. 创建中间件函数
2. 在 `server.ts` 中全局使用或在特定路由中使用
3. 确保中间件顺序正确（认证应在授权之前）
