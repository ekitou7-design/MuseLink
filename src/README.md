# src 文件夹说明

## 整体作用
这是前端应用的源代码目录，包含所有 React 组件、页面、业务逻辑和工具函数。使用 TypeScript + React 19 + Tailwind CSS 构建用户界面。

## 核心文件

### 入口文件
- **main.tsx** - 应用的启动入口，挂载根组件到 DOM
- **index.css** - 全局样式定义
- **App.tsx** - 主应用组件（已弃用，使用 RootApp 替代）
- **RootApp.tsx** - ⭐ 真正的根组件，处理路由和页面渲染
- **types.ts** - 全局 TypeScript 类型定义

### 配置文件
- **constants.ts** - 应用全局常量

## 子目录结构

| 目录 | 说明 |
|------|------|
| **auth/** | 用户认证相关逻辑 |
| **components/** | 可复用的 React 组件 |
| **pages/** | 应用页面组件 |
| **router/** | 路由管理和权限守卫 |
| **lib/** | 工具函数和 API 调用 |
| **services/** | 业务服务（AI 等） |
| **data/** | 本地数据文件 |

## 重要文件优先级

### 🔴 最关键（必须了解）
- `RootApp.tsx` - 路由总入口，管理所有页面切换
- `router/router.ts` - 路由系统的核心
- `lib/authClient.ts` - 前端认证 API 调用
- `auth/AuthService.ts` - 认证业务逻辑
- `pages/LoginPage.tsx` - 登录页，用户入口

### 🟡 重要（应该了解）
- `router/AuthGuard.tsx` - 登录保护
- `router/AdminGuard.tsx` - 管理员权限保护
- `components/AuthModal.tsx` - 认证弹窗
- `pages/HomePage.tsx` - 主页
- `services/curatorService.ts` - 本地规则策展与关联推荐

### 🟢 辅助（参考即可）
- `constants.ts` - 常量定义
- `index.css` - CSS 样式

## 架构逻辑

```
启动 (main.tsx)
  ↓
RootApp 组件
  ↓
根据 URL hash 判断路由
  ├─ /login → LoginPage（登录页）
  ├─ /register → RegisterPage（注册页）
  ├─ /home → AuthGuard → HomePage（需要认证）
  ├─ /profile → AuthGuard → ProfilePage（需要认证）
  └─ /admin → AdminGuard → AdminPage（需要管理员）
```

## 数据流向

1. **用户操作** (UI 组件) 
   ↓
2. **调用 API** (lib/authClient.ts, lib/api.ts)
   ↓
3. **后端返回** (server.ts)
   ↓
4. **保存状态** (AuthService, UserSession)
   ↓
5. **重新渲染** (React 组件)

## 快速导航

- **要修改注册流程？** → 查看 `pages/RegisterPage.tsx` 和 `components/AuthModal.tsx`
- **要修改登录流程？** → 查看 `pages/LoginPage.tsx` 和 `lib/authClient.ts`
- **要添加新页面？** → 在 `pages/` 创建文件，然后在 `RootApp.tsx` 注册
- **要修改路由？** → 查看 `router/router.ts`
- **要修改权限？** → 查看 `router/AuthGuard.tsx` 和 `router/AdminGuard.tsx`
- **要调用 API？** → 使用 `lib/api.ts` 中的 `apiFetch()` 函数
