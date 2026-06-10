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
| `imported-artifacts.json` | 导入的文物数据 |
| `imported-museums.json` | 根据文物数据生成的博物馆数据 |
| `imported-artifacts.ai-ready.v2.json` | 面向 AI、RAG 和策展的文物派生数据 |
| `artifact-relation-seeds.v2.json` | 知识图谱关系候选 |
| `rag/artifacts-rag-documents.v2.jsonl` | 可导入外部 RAG 平台的文物文档 |

## 现有知识库数据进度

当前知识库主数据是 `imported-artifacts.json`，里面有 226 件已导入文物，其中 94 件来自国家文物局第三批禁止出境展览文物目录，40 件来自首批禁止出国（境）展览文物专题补充。基于主数据，项目已经生成：

- 92 条 AI-ready v2 文物数据：`imported-artifacts.ai-ready.v2.json`（尚未重新生成）
- 92 条 RAG JSONL 文档：`rag/artifacts-rag-documents.v2.jsonl`（尚未重新生成）
- 229 条关系候选：`artifact-relation-seeds.v2.json`（尚未重新生成）
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
