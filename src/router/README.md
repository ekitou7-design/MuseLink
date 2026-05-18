# src/router 文件夹说明

## 整体作用
管理应用的路由系统和用户权限控制。决定用户能访问哪些页面，保护需要登录或管理员权限的页面。

## 核心文件

### 🔴 最关键的文件

**router.ts** - ⭐ 路由系统核心
- `navigate(路由, 参数)` - 导航到某个页面
  ```javascript
  navigate("/login");
  navigate("/home");
  navigate("/login", { museId: "12345678" }); // 传递参数
  ```
- `useRoute()` - Hook，获取当前路由（返回 RoutePath）
  ```javascript
  const route = useRoute(); // "/login" | "/home" | "/profile" | "/admin"
  ```
- `getRouteSearchParams()` - 获取 URL 中的查询参数
  ```javascript
  const museId = getRouteSearchParams().get("museId");
  ```
- 使用 URL hash（#）作为路由标记，例如 `http://localhost:3000#/home`

**AuthGuard.tsx** - ⭐ 登录保护
- 包裹需要登录的组件
- 如果用户未登录，自动跳转到登录页
- 使用示例：
  ```jsx
  <AuthGuard>
    <HomePage />
  </AuthGuard>
  ```
- 检查点：
  - 用户是否已登录（`isLoggedIn`）
  - 是否有有效 token（`token`）
  - 是否有 MuseLink ID（`museId`）
- 所有条件都满足才能访问内部组件

**AdminGuard.tsx** - ⭐ 管理员保护
- 比 AuthGuard 更严格
- 不仅检查是否登录，还检查用户角色是否为 `admin`
- 如果不是管理员，显示 ForbiddenPage
- 使用示例：
  ```jsx
  <AdminGuard>
    <AdminPage />
  </AdminGuard>
  ```

### 🟢 辅助文件

**authChecks.ts** - 权限检查工具函数
- `isUserAuthenticated()` - 检查用户是否已认证
- `isUserAdmin()` - 检查用户是否为管理员
- 被 AuthGuard 和 AdminGuard 使用

## 路由流程

### 路由工作原理

```javascript
// 用户访问 http://localhost:3000#/home
// ↓
// URL 中的 hash 是 #/home
// ↓
// useRoute() 读取 hash
// ↓
// 返回 "/home"
// ↓
// RootApp 根据返回值决定显示哪个页面
```

### 守卫机制流程

```javascript
// 未登录用户访问 /home
// ↓
// RootApp 尝试渲染 <AuthGuard><HomePage /></AuthGuard>
// ↓
// AuthGuard 检查 isUserAuthenticated()
// ↓
// 检查失败，调用 navigate("/login")
// ↓
// URL hash 变为 #/login
// ↓
// RootApp 重新渲染，显示 LoginPage
```

## 权限检查逻辑

### AuthGuard 检查流程
```
用户已登录？ ✅
  ├─ 有 token？✅
  │   ├─ 有 museId？✅
  │   │   └─ ✅ 显示页面
  │   └─ ❌ 跳转到登录
  └─ ❌ 跳转到登录
```

### AdminGuard 检查流程
```
通过 AuthGuard 检查？✅
  ├─ 用户角色是 admin？✅
  │   └─ ✅ 显示页面
  └─ ❌ 显示权限不足页面
```

## 典型使用场景

### 场景1：用户登录后访问首页
```javascript
1. 用户在浏览器输入 localhost:3000
2. navigate("/home") 被调用
3. URL 变为 #/home
4. RootApp 读取路由为 "/home"
5. AuthGuard 检查：已登录 ✅
6. 显示 HomePage
```

### 场景2：未登录用户直接访问首页
```javascript
1. 用户访问 localhost:3000#/home
2. RootApp 读取路由为 "/home"
3. AuthGuard 检查：未登录 ❌
4. AuthGuard 调用 navigate("/login")
5. URL 变为 #/login
6. 显示 LoginPage
```

### 场景3：普通用户访问管理页面
```javascript
1. 用户访问 localhost:3000#/admin
2. RootApp 读取路由为 "/admin"
3. AdminGuard 检查登录：✅
4. AdminGuard 检查角色：❌（普通用户）
5. 显示 ForbiddenPage
```

## 重要说明

### 为什么使用 Hash 路由？

应用使用 `#` 而不是传统的 URL path：
- ✅ 不需要服务器改变
- ✅ 刷新页面不会 404
- ✅ 浏览器历史记录保留
- ❌ 不利于 SEO（但此应用主要是内部工具）

URL 示例：
- `http://localhost:3000#/login`
- `http://localhost:3000#/home`
- `http://localhost:3000#/profile`

### 导航参数的传递

```javascript
// 传递参数
navigate("/login", { museId: "12345678" });

// URL 变为 #/login?museId=12345678

// 在目标页面读取
const museId = getRouteSearchParams().get("museId");
```

## 快速参考

| 方法 | 用途 |
|------|------|
| `navigate(path)` | 跳转到某个页面 |
| `useRoute()` | 获取当前页面路由（Hook） |
| `getRouteSearchParams()` | 获取 URL 查询参数 |
| `<AuthGuard>` | 保护需要登录的页面 |
| `<AdminGuard>` | 保护需要管理员权限的页面 |

## 添加新页面的步骤

1. 在 `src/pages/` 创建新页面组件
2. 在 `src/router/router.ts` 中定义新路由（可选）
3. 在 `RootApp.tsx` 中添加路由判断
4. 如果需要保护，包裹上 AuthGuard 或 AdminGuard
5. 使用 `navigate("/new-page")` 进行导航
