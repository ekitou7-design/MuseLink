# backend/api/db 文件夹说明

## 整体作用
数据库访问层。处理与数据存储的所有交互。目前使用 JSON 文件存储，可扩展为 SQL 数据库或 NoSQL。

## 核心文件

### 🔴 最关键的文件

**client.ts** - ⭐ 数据库客户端
- 初始化数据库连接
- 提供数据库查询接口
- 支持多种存储方式：
  - JSON 文件（当前）
  - SQL 数据库（未来扩展）

**migrate.ts** - ⭐ 数据库迁移
- 创建或升级数据库架构
- 初始化数据表结构
- 运行迁移脚本
```bash
npm run db:migrate
```

**seed.ts** - ⭐ 数据播种（初始化示例数据）
- 生成测试用的初始数据
- 创建示例文物记录
- 创建示例用户
```bash
npm run db:seed
```

**schema.sql** - 数据库架构定义
- 定义所有数据表结构
- SQL 约束和索引
- 关键字段说明

### 🟡 其他文件

**seedArtifacts.ts** - 文物数据播种
- 专门处理文物数据初始化

**seed-artifacts.json** - 示例文物数据
- JSON 格式的示例文物数据
- 用于开发和测试

## 数据表结构

### users 表
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  museId VARCHAR(10) UNIQUE NOT NULL,
  passwordHash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 用户内部 ID（自增） |
| museId | VARCHAR(10) | MuseLink ID（唯一，8-10 位） |
| passwordHash | VARCHAR(255) | 加密后的密码 |
| role | VARCHAR(20) | 用户角色（user/admin） |
| createdAt | TIMESTAMP | 创建时间 |

### artifacts 表
```sql
CREATE TABLE artifacts (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  museum VARCHAR(255),
  era VARCHAR(100),
  material VARCHAR(255),
  description TEXT,
  imageUrl VARCHAR(500),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### likes 表
```sql
CREATE TABLE likes (
  id SERIAL PRIMARY KEY,
  userId INTEGER REFERENCES users(id),
  artifactId VARCHAR(50) REFERENCES artifacts(id),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(userId, artifactId)
)
```

### exhibitions 表
```sql
CREATE TABLE exhibitions (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  theme VARCHAR(255),
  description TEXT,
  artifactIds JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

## 数据库操作流程

### 查询流程

```
控制器调用数据库函数
  ↓
查询条件处理
  ├─ 搜索关键词
  ├─ 分页参数
  └─ 筛选条件
  ↓
执行数据库查询
  ├─ 从 JSON 文件读取
  └─ （或从 SQL 数据库读取）
  ↓
结果处理
  ├─ 过滤和排序
  ├─ 分页
  └─ 格式转换
  ↓
返回结果
```

### 写入流程

```
控制器传递数据
  ↓
数据验证
  ├─ 检查必需字段
  ├─ 验证数据类型
  └─ 检查约束
  ↓
生成新记录
  ├─ 分配 ID
  └─ 添加时间戳
  ↓
保存到数据库
  ├─ 读取现有数据
  ├─ 添加新记录
  ├─ 创建备份
  └─ 写入文件
  ↓
返回成功或错误
```

## 快速参考

### 常用命令

```bash
# 创建/升级数据库架构
npm run db:migrate

# 初始化示例数据
npm run db:seed

# 导入文物数据
npm run import:artifacts -- --input file.json

# 重置数据库（谨慎！会删除所有数据）
npm run db:reset
```

## 文件位置

数据存储位置：
```
data/
├── auth-users.json           # 用户账户数据
├── imported-artifacts.json   # 文物数据
├── exhibitions.json          # 展陈数据
└── user-data.json           # 用户收藏等
```

## 备份和恢复

### 自动备份
每次写入都会自动创建备份：
```
artifact.json → artifact.json.bak
```

### 手动备份
```bash
cp data/imported-artifacts.json data/imported-artifacts.backup.json
```

### 恢复数据
```bash
cp data/imported-artifacts.backup.json data/imported-artifacts.json
```

## 存储方式选择

### 当前：JSON 文件
✅ 优点：
- 开发简单
- 无需配置
- 易于版本控制
- 数据易于查看

❌ 缺点：
- 不适合大数据量
- 并发访问有限制
- 查询性能低

### 未来：SQL 数据库
推荐用 PostgreSQL 或 MySQL：
```bash
# 使用 Docker 启动 PostgreSQL
npm run db:up

# 连接到数据库
psql postgresql://user:password@localhost/muselink
```
