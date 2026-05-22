# scripts 文件夹说明

这个文件夹放一些辅助脚本。

普通体验 App 不需要看这里。

## 现在最重要的脚本

```text
scripts/import-artifacts.ts
```

它负责把外部文物数据导入 MuseLink。

知识库相关还有一个重要目录：

```text
scripts/data-prep/
```

它负责把已导入文物整理成 AI-ready 数据、RAG JSONL 文档和知识图谱关系候选。当前已基于 92 件文物生成 v2 派生数据，适合用于 RAG 技术验证、智能策展候选和后续人工审核。

## 常用命令

在项目根目录运行：

```bash
npm run import:artifacts -- ./imports/example-national-museum.json
```

这条命令会读取示例导入任务，并把结果写到：

```text
data/imported-artifacts.json
```

## 导入模式是什么意思？

| 模式 | 意思 |
|------|------|
| `append` | 追加新数据，不删除旧数据 |
| `replace-museum` | 替换某个博物馆的旧数据，推荐日常使用 |
| `replace-all` | 清空旧数据后重新导入，使用前要备份 |

## 给非技术同学的提醒

如果你只是整理数据，不一定要改这里。

更常见的做法是：

1. 把原始数据放到 `imports`
2. 配好导入任务文件
3. 运行导入命令

脚本本身一般由技术同事维护。
