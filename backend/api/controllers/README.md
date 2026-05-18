# backend/api/controllers 文件夹说明

## 整体作用
请求处理逻辑层。每个控制器对应一个功能模块，负责处理特定类型的 HTTP 请求，验证参数，调用业务逻辑，并返回响应。

## 核心文件

### 🔴 最关键的文件

**authController.ts** - ⭐ 认证请求处理
- `registerUser()` - 处理注册请求
  - 接收：`{ password, confirmPassword }`
  - 调用：`auth.registerUser()`
  - 返回：`{ museId }`
  
- `loginUser()` - 处理登录请求
  - 接收：`{ museId, password }`
  - 调用：`auth.loginUser()`
  - 返回：`{ token, museId, role }`
  
- `getCurrentUser()` - 处理获取当前用户请求
  - 需要有效 token
  - 返回：`{ museId, role, displayName }`

**artifactsController.ts** - ⭐ 文物管理
- `getArtifacts()` - 列表（支持分页、搜索、筛选）
- `getArtifactById()` - 获取单个文物详情
- `createArtifact()` - 创建文物（管理员）
- `updateArtifact()` - 更新文物（管理员）
- `deleteArtifact()` - 删除文物（管理员）

**likesController.ts** - ⭐ 点赞/收藏管理
- `addLike()` - 添加点赞
- `removeLike()` - 取消点赞
- `getUserLikes()` - 获取用户点赞列表

### 🟡 其他控制器

**exhibitionsController.ts** - 展陈管理
- `getExhibitions()` - 列表
- `createExhibition()` - 创建
- `updateExhibition()` - 更新
- `deleteExhibition()` - 删除

## 控制器执行流程

```
Express 路由接收请求
  ↓
路由调用控制器函数
  ↓
控制器验证参数
  ├─ 类型检查
  ├─ 值范围检查
  └─ 必需字段检查
  ↓
控制器调用业务逻辑
  ├─ 调用 auth.ts 函数
  ├─ 调用 artifact-importer.ts
  └─ 处理异常
  ↓
控制器格式化响应
  ├─ 设置 HTTP 状态码
  ├─ 包装数据
  └─ 添加元数据
  ↓
返回 JSON 响应
```

## 标准错误处理模式

```javascript
// 在控制器中
try {
  const result = await auth.loginUser(museId, password);
  res.json({ status: 200, data: result });
} catch (error) {
  if (error instanceof ValidationError) {
    res.status(400).json({ status: 400, error: error.message });
  } else if (error instanceof AuthError) {
    res.status(401).json({ status: 401, error: error.message });
  } else {
    res.status(500).json({ status: 500, error: "Internal server error" });
  }
}
```

## 快速参考

| 控制器 | 主要职责 |
|-------|--------|
| authController.ts | 用户注册、登录、获取当前用户信息 |
| artifactsController.ts | 文物的 CRUD 操作和列表查询 |
| likesController.ts | 点赞和收藏管理 |
| exhibitionsController.ts | 展陈的 CRUD 操作 |

## 添加新控制器

1. 创建新文件：`backend/api/controllers/newController.ts`
2. 定义请求处理函数
3. 在 `server.ts` 中导入并使用
4. 为新路由添加认证检查（如需要）
