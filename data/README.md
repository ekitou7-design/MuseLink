# data 文件夹说明

这个文件夹保存本地数据。

你可以把它理解成项目的「本地小数据库」。

## 这里有什么？

| 文件 | 保存什么 |
|------|------|
| `auth-users.json` | 用户账号 |
| `auth-user-seq.json` | 用户编号计数 |
| `user-data.json` | 收藏、关注等用户个人数据 |
| `exhibitions.json` | 展陈数据 |
| `imported-artifacts.json` | 导入的主文物数据，本地 JSON 模式下的唯一事实来源 |
| `imported-museums.json` | 根据文物数据生成的博物馆数据 |
| `ai-ready-artifacts.json` | 面向 AI、RAG 和策展的文物派生数据 |
| `rag-documents.json` | App 内部使用的 RAG 文档 |
| `artifact-relations.json` | 知识图谱关系候选 |
| `imported-artifacts.ai-ready.v2.json` | 兼容旧工具的 AI-ready 导出 |
| `artifact-relation-seeds.v2.json` | 兼容旧工具的关系候选导出 |
| `rag/artifacts-rag-documents.v2.jsonl` | 兼容外部 RAG 平台的 JSONL 导出 |

## 现有知识库数据进度

当前知识库主数据是 `imported-artifacts.json`，里面有 292 件已导入文物。基于主数据，项目已经生成：

- 292 条 AI-ready 文物数据：`ai-ready-artifacts.json`
- 292 条 RAG 文档：`rag-documents.json`
- 726 条关系候选：`artifact-relations.json`
- 113 个博物馆聚合条目：`imported-museums.json`

这些文件让 App 可以展示文物、搜索文物、生成博物馆列表，并给智能策展和后续外部知识库平台提供材料。

正式使用前仍建议人工审核：文物来源链接、版权说明、自动摘要、自动标签和关系候选都不应直接当作馆方正式内容发布。

## 可以直接改这些文件吗？

可以看，但不建议随便改。

这些文件格式要求比较严格，少一个逗号或多一个符号都可能导致项目启动失败。

如果要改，建议先复制一份备份。

## 文物导入后会写到哪里？

运行导入命令后，文物通常会写入：

```text
data/imported-artifacts.json
```

App 会优先展示这里的文物。

导入或后台新增/更新文物后，系统会自动从主文物库派生 AI-ready、RAG 文档和关系候选。如果派生数据异常，可以运行：

```bash
npm run generate:ai-data
npm run check:rag-data
```

## 用户账号在哪里？

用户账号在：

```text
data/auth-users.json
```

注意：密码不会直接保存成明文，而是保存成加密后的字符串。

所以不要试图在这个文件里直接改密码。

## 管理员账号

项目启动时会确保默认管理员账号存在：

```text
账号：jiangzhong
密码：jiangzhong
```

## 给非技术同学的提醒

如果你只是体验 App，不需要打开这个文件夹。

如果你要核对导入数据，可以主要看：

```text
data/imported-artifacts.json
```

如果你要清空或批量修改数据，最好先找技术同事一起操作。
