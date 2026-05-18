# src/auth 文件夹说明

## 整体作用
用户认证状态管理和业务逻辑处理。存储用户登录状态、用户身份信息，以及与后端认证 API 交互的服务。

## 核心文件

### 🔴 重要文件

**AuthService.ts** - ⭐ 认证业务层
- `register(密码, 确认密码)` - 注册新用户，返回生成的 MuseLink ID
- `login(MuseLink ID, 密码)` - 用户登录，获取 JWT token
- `logout()` - 登出，清除会话
- 与后端 API 通信的所有认证相关操作都从这里调用

**UserSession.ts** - ⭐ 用户会话状态管理
- 单例模式存储当前登录用户的信息
- `getMuseId()` - 获取当前用户的 MuseLink ID
- `getToken()` - 获取 JWT token
- `getRole()` - 获取用户角色（user / admin）
- `isLoggedIn()` - 检查是否已登录
- `snapshot()` - 获取当前会话的完整快照
- `setMuseId()`, `setLoggedIn()`, `setRole()` - 更新会话状态
- `clear()` - 清除所有会话数据（登出时调用）

## 工作流程

### 注册流程
```
RegisterPage 用户输入密码
  ↓
调用 AuthService.register()
  ↓
AuthService 调用后端 /api/auth/register
  ↓
后端返回 museId
  ↓
AuthService 调用 UserSession.setMuseId()
  ↓
UserSession 保存 museId
  ↓
返回成功，显示注册成功页面
```

### 登录流程
```
LoginPage 用户输入 MuseLink ID + 密码
  ↓
调用 AuthService.login(museId, password)
  ↓
AuthService 调用后端 /api/auth/login
  ↓
后端返回 token + role
  ↓
AuthService 调用 UserSession 保存登录信息
  ↓
AuthService 将 token 存入 localStorage
  ↓
返回成功，页面跳转到 /home
```

### 登出流程
```
用户点击登出
  ↓
调用 AuthService.logout()
  ↓
AuthService 调用 UserSession.clear()
  ↓
UserSession 清除所有会话数据
  ↓
清除 localStorage 中的 token
  ↓
页面跳转到 /login
```

## 数据结构

### UserSession 中存储的数据
```typescript
{
  museId: "12345678",        // 用户的 MuseLink ID
  token: "jwt.token.xxx",    // JWT 认证 token
  isLoggedIn: true,          // 是否已登录
  role: "user" | "admin"     // 用户角色
}
```

## 重要说明

### 为什么分两个文件？

- **AuthService** 是业务层，负责"做什么"
  - 调用 API
  - 处理返回值
  - 更新状态
  
- **UserSession** 是存储层，负责"怎么存"
  - 单纯地存取用户信息
  - 不处理网络请求
  - 仅管理内存中的状态

### 会话持久化

- UserSession 存储在**内存中**（刷新页面会丢失）
- JWT token 存储在 **localStorage** 中（刷新页面保留）
- 页面刷新时，从 localStorage 读取 token 重新恢复会话

### 会话保护

- `AuthGuard` 组件检查 UserSession 状态
- 如果未登录，自动跳转到 /login
- 如果 token 过期，调用登出清除会话

## 快速参考

| 需求 | 使用方法 |
|------|--------|
| 判断用户是否登录 | `UserSession.isLoggedIn()` |
| 获取当前用户 ID | `UserSession.getMuseId()` |
| 获取用户角色 | `UserSession.getRole()` |
| 注册用户 | `AuthService.register(pwd, confirmPwd)` |
| 登录用户 | `AuthService.login(museId, pwd)` |
| 登出用户 | `AuthService.logout()` |
| 获取完整会话信息 | `UserSession.snapshot()` |
