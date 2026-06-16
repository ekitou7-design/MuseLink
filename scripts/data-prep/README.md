# MuseLink AI 数据准备脚本

`prepare-artifacts-for-ai.ts` 是早期一次性数据准备脚本，用于把 `data/imported-artifacts.json` 中已有的导入文物整理为后续 RAG 知识库、知识图谱和 AI Workflow 策展生成可用的标准样板数据。

当前项目已经改为自动派生数据流：主文物库 `artifacts` / `data/imported-artifacts.json` 是唯一事实来源，新增或更新文物后会自动同步 AI-ready、RAG 文档和关系候选。当前主库 292 件，对应 AI-ready 和 RAG 文档也是 292 条。

日常请优先使用：

```bash
npm run generate:ai-data
npm run rebuild:rag-data
npm run check:rag-data
```

旧脚本仍可作为规则参考，但不再是推荐入口。

## 如何运行

```bash
node --import tsx scripts/data-prep/prepare-artifacts-for-ai.ts
```

脚本只读取当前已有文物，不新增文物，不覆盖 `data/imported-artifacts.json`。

## 输出文件

- `data/imported-artifacts.ai-ready.v2.json`：AI-ready v2 文物派生数据。
- `data/artifact-relation-seeds.v2.json`：知识图谱关系候选。
- `data/rag/artifacts-rag-documents.v2.jsonl`：可导入 Dify、FastGPT、RAGFlow 等知识库的 JSONL 文档。

新自动派生入口还会输出：

- `data/ai-ready-artifacts.json`
- `data/artifact-relations.json`
- `data/rag-documents.json`

仓库里仍保留 v1 文件，便于对照规则变化：

- `data/imported-artifacts.ai-ready.json`
- `data/artifact-relation-seeds.json`
- `data/rag/artifacts-rag-documents.jsonl`

## 自动生成字段

RAG 字段：

- `shortIntro`
- `description`
- `ragText`
- `sourceName`
- `sourceUrl`
- `copyrightNote`

知识图谱字段：

- `regionTag`
- `cultureTags`
- `themeTags`
- `materialTags`
- `periodTags`
- `relationSeeds`

AI Workflow 字段：

- `workflowSummary`
- `curatorNote`
- `displayPriority`
- `isCuratable`

## 生成规则说明

- `regionTag` 默认使用 `辽宁`。
- `periodTags` 会根据 `dynasty/period` 生成基础时代标签，例如 `辽代`、`清代`、`明代`。
- `cultureTags` 和 `themeTags` 根据类别、备注、名称、材质中的可判断信息生成，例如佛教文化、玉器文化、陶瓷文化、书画艺术、金属工艺。
- `materialTags` 根据 `material/材质` 拆分生成。
- `ragText` 会整合文物名称、所属博物馆、朝代、类别、等级、材质、尺寸、备注、简介、详细介绍和标签信息。
- `workflowSummary` 和 `curatorNote` 只基于已有结构化字段生成，不补写出土地点、历史事件或人物故事。
- `sourceUrl` 缺失时统一填 `暂无信息`，不使用图片链接冒充来源页面。

## 需要人工审核的内容

- `shortIntro`、`description`、`workflowSummary`、`curatorNote` 是规则化摘要，不等同于馆方正式说明。
- `cultureTags`、`themeTags`、`periodTags` 是自动标签，需要专家或运营审核标签边界。
- `sourceName` 和 `copyrightNote` 需要结合真实授权、馆方开放数据政策和图片使用协议确认。
- `artifact-relation-seeds.v2.json` 是关系候选，不是已确认知识图谱事实。

## 后续接入 RAG 平台

`data/rag/artifacts-rag-documents.v2.jsonl` 每行是一条文物文档：

- `id`：文物 ID。
- `title`：文物名称。
- `museumName`：所属博物馆。
- `text`：用于向量化的完整检索文本。
- `metadata`：包含朝代、类别、地域标签、文化标签、主题标签和来源链接。

接入 Dify、FastGPT、RAGFlow 等平台时，可将 `text` 作为正文导入，将 `metadata` 作为过滤字段或检索增强字段使用。正式上线前建议先抽样检查文本准确性，再补充权威 `sourceUrl` 和版权说明。
