# src/lib 文件夹说明

## 整体作用
工具函数和 API 调用库。提供与后端通信的接口，以及公共的业务逻辑工具函数。

## 核心文件

### 🔴 最关键的文件

**api.ts** - ⭐ HTTP 请求核心
- `apiFetch()` - 所有 API 调用都通过这个函数
  ```javascript
  const data = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ museId, password })
  });
  ```
- `setAuthToken(token)` - 保存 JWT token 到 localStorage
- `clearAuthToken()` - 清除保存的 token
- `getAuthToken()` - 获取保存的 token
- 自动在每个请求的 Header 中添加 `Authorization: Bearer <token>`
- 错误处理：如果收到 401 响应，自动清除 token 并跳转到登录页

**authClient.ts** - ⭐ 认证 API 调用
- `register(密码, 确认密码)` - 调用注册 API
  ```javascript
  const { museId } = await register(pwd, confirmPwd);
  ```
- `login(MuseLink ID, 密码)` - 调用登录 API
  ```javascript
  const { token, museId, role } = await login(museId, pwd);
  ```
- `logout()` - 调用登出 API
- `me()` - 获取当前用户信息
- 处理后端返回的各种数据格式
- 自动验证 MuseLink ID 和 role 的有效性

**authUtils.ts** - ⭐ 认证工具函数
- `MUSE_ID_REGEX` - MuseLink ID 验证正则表达式
- `normalizeMuseId()` - 规范化并验证 MuseLink ID
- `getStoredMuseId()` - 从 localStorage 获取已保存的 ID
- `saveMuseId()` - 保存 MuseLink ID 到 localStorage
- `clearStoredMuseId()` - 清除保存的 MuseLink ID
- `copyToClipboard()` - 复制文本到剪贴板（带兼容性处理）

### 🟢 辅助文件

**utils.ts** - 通用工具函数
- 字符串处理
- 数组处理
- 日期处理
- 其他通用工具

**adminClient.ts** - 管理员 API 调用
- 获取系统统计数据
- 用户管理 API
- 文物管理 API

## API 调用流程

### 典型的 API 调用流程

```
React 组件
  ↓
调用 AuthService.login()
  ↓
AuthService 调用 login() 从 authClient.ts
  ↓
login() 调用 apiFetch()
  ↓
apiFetch() 准备 HTTP 请求
  ├─ 添加 Authorization header
  ├─ 设置 Content-Type
  └─ 发送到后端
  ↓
后端返回响应
  ↓
apiFetch() 检查状态码
  ├─ 200: 正常返回数据
  ├─ 401: token 过期，清除并跳转登录
  └─ 4xx/5xx: 抛出错误
  ↓
login() 处理数据
  ├─ 提取 museId 和 role
  └─ 验证有效性
  ↓
返回到 AuthService
  ↓
AuthService 更新 UserSession
  ↓
组件收到结果并重新渲染
```

## Token 管理

### Token 的生命周期

```
用户登录
  ↓
后端返回 JWT token
  ↓
authClient.login() 拿到 token
  ↓
调用 setAuthToken(token) 保存到 localStorage
  ↓
后续所有 API 请求都会自动带上这个 token
  ↓
用户登出或 token 过期
  ↓
调用 clearAuthToken() 清除
  ↓
跳转到登录页
```

### Token 验证

```javascript
// 在 apiFetch 中自动进行
const token = getAuthToken();
if (token) {
  headers["Authorization"] = `Bearer ${token}`;
}

// 如果后端返回 401
// 说明 token 无效或过期
// ↓
clearAuthToken();
navigate("/login");
```

## 数据验证

### MuseLink ID 验证

所有涉及 MuseLink ID 的地方都会验证：
```javascript
const MUSE_ID_REGEX = /^\d{8,10}$/;
// 必须是 8-10 位纯数字

normalizeMuseId("12345678");    // ✅ "12345678"
normalizeMuseId("123456789");   // ✅ "123456789"
normalizeMuseId("1234567890");  // ✅ "1234567890"
normalizeMuseId("123");         // ❌ null （太短）
normalizeMuseId("123456789012");// ❌ null （太长）
normalizeMuseId("1234567a");    // ❌ null （包含字母）
```

### 角色验证

```javascript
const role = "admin" || "user"; // ✅ 有效
const role = "superuser";       // ❌ 无效（会被认为 undefined）
```

## 快速参考

### 常用的 API 调用

```javascript
// 注册
import { register } from "../lib/authClient";
const { museId } = await register("password", "confirmPassword");

// 登录
import { login } from "../lib/authClient";
const { token, role } = await login(museId, password);

// 一般性 API 调用
import { apiFetch } from "../lib/api";
const data = await apiFetch("/api/endpoint", {
  method: "GET"
});

// 获取当前用户
import { me } from "../lib/authClient";
const userInfo = await me();

// Token 操作
import { setAuthToken, getAuthToken, clearAuthToken } from "../lib/api";
setAuthToken(token);
const token = getAuthToken();
clearAuthToken();

// MuseLink ID 工具
import { normalizeMuseId, MUSE_ID_REGEX } from "../lib/authUtils";
const valid = MUSE_ID_REGEX.test(museId);
const normalized = normalizeMuseId(input);

// 复制到剪贴板
import { copyToClipboard } from "../lib/authUtils";
await copyToClipboard("要复制的文本");
```

## 错误处理

### 常见错误处理模式

```javascript
try {
  const result = await login(museId, password);
  // 处理成功
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message); // "ID不存在" 或 "密码错误"
  }
}
```

### API 错误类型

| 错误 | 原因 | 处理 |
|------|------|------|
| "ID不存在" | MuseLink ID 不存在 | 提示用户重新输入或注册 |
| "密码错误" | 密码不正确 | 提示用户重新输入 |
| "缺少 name/名称 字段" | 导入数据格式错误 | 检查导入文件格式 |
| 401 Unauthorized | Token 过期或无效 | 清除 token 跳转登录 |

## 添加新的 API 调用

1. 在 `api.ts` 中使用 `apiFetch()` 发送请求
2. 如果是认证相关，在 `authClient.ts` 中创建函数
3. 如果是工具函数，在 `utils.ts` 中添加
4. 导出函数供组件使用
5. 错误处理使用 try-catch
