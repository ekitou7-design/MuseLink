# backend/api/db 文件夹说明

这个文件夹和数据库有关。

目前项目主要使用 `data` 文件夹里的 JSON 文件保存数据，所以普通团队成员通常不用看这里。

## 和知识库的关系

知识库当前还没有强依赖数据库。文物主数据、AI-ready 数据、RAG JSONL 和关系候选都在 `data` 文件夹里。

如果以后要把知识库升级为正式服务，可以从这里接入 PostgreSQL、向量数据库或全文检索服务。现在 `/api/relics/search` 在没有外部数据库配置时，会退回到导入文物库的本地关键词检索。

## 它可能用来做什么？

- 初始化数据库结构
- 准备测试数据
- 以后从 JSON 文件升级到 PostgreSQL 等数据库

## 常见文件

| 文件 | 做什么 |
|------|------|
| `schema.sql` | 数据库表结构草案 |
| `migrate.ts` | 创建或升级数据库结构 |
| `seed.ts` | 填充示例数据 |
| `seedArtifacts.ts` | 填充示例文物 |

## 现在数据主要在哪里？

当前更常看的数据在：

```text
data/
```

比如：

```text
data/auth-users.json
data/imported-artifacts.json
data/exhibitions.json
data/user-data.json
```

## 给非技术同学的提醒

如果只是体验、导入文物、检查数据，优先看 `data` 和 `imports`。

这个文件夹更多是给未来接入正式数据库时使用。
