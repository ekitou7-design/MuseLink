# src/pages 文件夹说明

## 整体作用
应用的各个页面组件。每个文件对应一个可以通过 URL 访问的页面。页面是 RootApp 路由的目的地。

## 核心文件

### 🔴 登录认证相关页面

**LoginPage.tsx** - ⭐ 登录页面
- 用户输入 MuseLink ID 和密码
- 支持从注册页面自动填入 MuseLink ID
- 页面刷新时从 UserSession 恢复之前的 ID
- 登录成功后跳转到首页

**RegisterPage.tsx** - ⭐ 注册页面
- 用户输入密码和确认密码
- 注册成功后显示专门的"注册成功"页面
- 显示生成的 MuseLink ID，支持复制
- 提供"进入应用"按钮跳转到登录页
- 提供"重新注册"选项重新开始

### 🟡 应用主要页面

**HomePage.tsx** - 应用首页
- 显示文物列表和展陈
- 搜索和筛选功能
- 点击文物查看详情
- 收藏/取消收藏功能

**ProfilePage.tsx** - 用户个人资料页
- 显示用户头像、昵称、简介等
- 编辑个人资料
- 显示收藏的文物和展陈
- 显示发布的展陈

**AdminPage.tsx** - 管理员后台
- 查看系统统计数据
- 管理用户（删除、封禁等）
- 文物数据管理
- 仅管理员可见

**ForbiddenPage.tsx** - 权限不足页面
- 用户尝试访问权限页面时显示
- 提供返回首页的链接

## 页面流程

### 用户访问流程
```
未登录状态
  ↓
访问任何页面
  ↓
看 /login 页面

登录成功
  ↓
访问 /home
  ↓
看 HomePage（包含 AuthGuard 保护）

访问 /admin（非管理员）
  ↓
看 ForbiddenPage（包含 AdminGuard 保护）
```

### 页面守卫机制

```typescript
// RootApp.tsx 中的路由定义
if (route === "/login") return <LoginPage />;          // 无保护
if (route === "/register") return <RegisterPage />;    // 无保护
if (route === "/home") return <AuthGuard><HomePage /></AuthGuard>;        // 需要登录
if (route === "/profile") return <AuthGuard><ProfilePage /></AuthGuard>; // 需要登录
if (route === "/admin") return <AdminGuard><AdminPage /></AdminGuard>;   // 需要管理员
```

## 重要的页面状态管理

### LoginPage 的特殊逻辑
- 监听 URL hash 中的 `museId` 参数
- 如果注册成功后跳转过来，会自动填入 museId
- 用户开始输入密码，会自动聚焦
- 刷新页面后从 UserSession 恢复之前的 museId

### RegisterPage 的特殊逻辑
- 用户注册后，立即切换到注册成功视图（不是导航到新页面）
- 注册成功页面展示 museId 和复制按钮
- 用户点击"进入应用"后，自动导航到登录页并填入 museId

## 页面之间的数据传递

### 通过 URL 参数传递
```javascript
// 从 RegisterPage 跳转到 LoginPage，传递 museId
navigate("/login", { museId: registeredMuseId });

// 在 LoginPage 中读取
const museId = getRouteSearchParams().get("museId");
```

### 通过 UserSession 传递
```javascript
// 登录时保存
UserSession.setMuseId(museId);
UserSession.setToken(token);

// 其他页面读取
const currentMuseId = UserSession.getMuseId();
```

## 快速参考

| 页面 | 路由 | 需要认证 | 描述 |
|------|------|--------|------|
| LoginPage | /login | ❌ | 登录 |
| RegisterPage | /register | ❌ | 注册 |
| HomePage | /home | ✅ | 首页 |
| ProfilePage | /profile | ✅ | 个人资料 |
| AdminPage | /admin | ✅ + 管理员 | 管理后台 |
| ForbiddenPage | 无路由 | - | 权限不足 |

## 常见问题

### Q: 如何在页面之间导航？
```javascript
import { navigate } from "../router/router";
navigate("/home");
navigate("/login", { museId: "12345678" });
```

### Q: 如何判断当前用户是否已登录？
```javascript
import { UserSession } from "../auth/UserSession";
const isLoggedIn = UserSession.isLoggedIn();
```

### Q: 注册成功后页面为什么不跳转？
这是有意设计，为了让用户看到生成的 museId，复制后再进入登录页。

### Q: 页面刷新后登录状态会丢失吗？
不会。Token 保存在 localStorage 中，刷新后会自动恢复。
