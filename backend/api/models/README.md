# backend/api/models 文件夹说明

## 整体作用
数据类型定义。使用 TypeScript 定义所有数据模型和接口，提供类型安全和代码智能提示。

## 核心文件

### 🔴 最关键的文件

**types.ts** - ⭐ 所有数据类型定义

#### 用户相关
```typescript
interface User {
  id: number;              // 内部 ID
  museId: string;          // MuseLink ID (8-10 位)
  passwordHash: string;    // bcrypt 加密后的密码
  role: "user" | "admin";  // 用户角色
  createdAt: string;       // ISO 8601 时间戳
}

interface LoginPayload {
  museId: string;
  password: string;
}

interface RegisterPayload {
  password: string;
  confirmPassword: string;
}
```

#### 文物相关
```typescript
interface Artifact {
  id: string;                    // 文物 ID（唯一）
  name: string;                  // 文物名称
  museum?: string;               // 所属博物馆
  era?: string;                  // 时代（如"明朝"）
  material?: string;             // 材质
  description?: string;          // 详细描述
  imageUrl?: string;             // 图片 URL
  createdAt: string;             // 创建时间
}

interface ArtifactListQuery {
  search?: string;               // 搜索关键词
  museum?: string;               // 筛选博物馆
  era?: string;                  // 筛选时代
  limit?: number;                // 分页：每页条数
  offset?: number;               // 分页：偏移量
}
```

#### 展陈相关
```typescript
interface Exhibition {
  id: string;                    // 展陈 ID
  name: string;                  // 展陈名称
  theme?: string;                // 主题
  description?: string;          // 描述
  artifactIds: string[];         // 包含的文物 ID 列表
  createdAt: string;             // 创建时间
}

interface ExhibitionPayload {
  name: string;
  theme?: string;
  description?: string;
  artifactIds: string[];
}
```

#### 点赞相关
```typescript
interface Like {
  id: number;                    // 点赞 ID
  userId: number;                // 用户 ID
  artifactId: string;            // 文物 ID
  createdAt: string;             // 点赞时间
}

interface LikePayload {
  artifactId: string;
}
```

#### API 响应
```typescript
interface ApiResponse<T> {
  status: number;                // HTTP 状态码
  data?: T;                       // 响应数据
  error?: string;                // 错误消息
}
```

## 类型使用示例

### 在控制器中
```typescript
import { User, Artifact, ApiResponse } from "../models/types";

export async function getArtifacts(
  req: Request,
  res: Response
): Promise<void> {
  const query: ArtifactListQuery = req.query;
  
  const artifacts: Artifact[] = await db.getArtifacts(query);
  
  const response: ApiResponse<Artifact[]> = {
    status: 200,
    data: artifacts
  };
  
  res.json(response);
}
```

### 在业务逻辑中
```typescript
import { User, RegisterPayload } from "../models/types";

export async function registerUser(
  payload: RegisterPayload
): Promise<{ museId: string }> {
  // 类型安全的参数访问
  const password = payload.password;
  
  // 生成用户
  const user: User = {
    id: generateId(),
    museId: generateMuseId(),
    passwordHash: await bcrypt.hash(password, 12),
    role: "user",
    createdAt: new Date().toISOString()
  };
  
  return { museId: user.museId };
}
```

## 类型检查

TypeScript 提供自动类型检查：
```bash
npm run lint
```

常见错误会被捕获：
```typescript
// ❌ 错误：role 只能是 "user" 或 "admin"
user.role = "superuser";

// ❌ 错误：缺少必需字段
const artifact: Artifact = {
  id: "123"
  // ❌ 缺少 name 字段
};

// ✅ 正确
const artifact: Artifact = {
  id: "123",
  name: "瓷器",
  era: "明朝"
};
```

## 添加新类型

1. 在 `types.ts` 中定义接口
2. 导出类型供其他模块使用
3. 在相关代码中应用这个类型

```typescript
// 添加新的评论类型
interface Comment {
  id: string;
  userId: number;
  artifactId: string;
  content: string;
  createdAt: string;
}

// 在控制器中使用
export async function getComments(
  artifactId: string
): Promise<Comment[]> {
  return db.getComments(artifactId);
}
```

## 可选字段 vs 必需字段

```typescript
// 可选字段（用 ? 标记）
interface Artifact {
  id: string;                    // 必需
  name: string;                  // 必需
  description?: string;          // 可选
  imageUrl?: string;             // 可选
}

// 使用
const artifact: Artifact = {
  id: "123",
  name: "瓷器"
  // description 和 imageUrl 可以省略
};
```

## 快速参考

| 类型 | 文件 | 用途 |
|------|------|------|
| User | types.ts | 用户数据 |
| Artifact | types.ts | 文物数据 |
| Exhibition | types.ts | 展陈数据 |
| Like | types.ts | 点赞数据 |
| ApiResponse | types.ts | API 响应格式 |
