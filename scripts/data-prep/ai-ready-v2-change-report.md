# AI-ready v2 规则变更报告

生成时间：2026-05-20

本轮基于 `scripts/data-prep/ai-ready-sample-review.md` 调整 `scripts/data-prep/prepare-artifacts-for-ai.ts`，输出第二版 AI-ready 派生数据。脚本仍只读取 `data/imported-artifacts.json`，不覆盖原始文件，也不覆盖 v1 文件。

## 1. 本轮修改的规则

1. 输出路径改为 v2：
   - `data/imported-artifacts.ai-ready.v2.json`
   - `data/artifact-relation-seeds.v2.json`
   - `data/rag/artifacts-rag-documents.v2.jsonl`
2. 新增审核字段：
   - `needsHumanReview`
   - `reviewFlags`
3. `shortIntro` 改为类型化短句，控制在 30-60 字。
4. `description` 改为类型化模板，控制在 120-200 字，并加入谨慎表达。
5. 标签规则扩展到社会文书、印章文化、金属器文化、铜镜文化、佛教文化、书画艺术、陶瓷文化、玉器文化、碑刻文献等。
6. `periodTags` 优先使用结构化 `dynasty/period` 字段；当字段缺失或为 `暂无信息/其他` 时，可从题名生成待核时代标签，并加入审核标记。
7. `curatorNote` 改为按文化标签和主题标签生成，更偏策展主题，而不是只写材质工艺。
8. 关系候选优先级调整为：同文化主题、同策展主题、同时代、同类别、同材质、同馆藏。
9. RAG JSONL metadata 增加审核和标签字段，便于后续按 `needsHumanReview` 过滤。

## 2. v1 与 v2 主要区别

| 项目 | v1 | v2 |
| --- | --- | --- |
| 输出文件 | `imported-artifacts.ai-ready.json` 等 | `*.v2.*` 独立文件 |
| `shortIntro` | 多为字段拼接 | 按类型生成，30-60 字 |
| `description` | 统一模板，重复字段较多 | 按书画、陶瓷、玉器、金属器、宗教、文书印章、生活器具等类型组织 |
| 标签体系 | 以玉器、书画、陶瓷、金属工艺和馆藏精品为主 | 增加社会文书、印章文化、金属器文化、身份凭信、制度管理、审美生活等 |
| `馆藏精品` | 52 条 | 13 条 |
| 审核标记 | 无 | 有 `reviewFlags` 和 `needsHumanReview` |
| RAG metadata | 基础元数据 | 增加 `needsHumanReview`、`reviewFlags`、`materialTags`、`periodTags`、`isCuratable` |
| 关系候选 | 容易受同馆藏影响 | 优先文化/主题/时代关系，同馆藏 confidence 降到 0.55 |

## 3. 标签体系改进点

v2 文化标签分布更细：

- `金属器文化`：26 条
- `印章文化`：16 条
- `书画艺术`：15 条
- `玉器文化`：13 条
- `陶瓷文化`：3 条
- `佛教文化`、`社会文书`、`铜镜文化`、`碑刻文献` 各有少量命中

v2 主题标签明显减少泛化：

- `馆藏精品` 从 v1 的 52 条降至 v2 的 13 条。
- 新增或增强 `日用器物`、`审美生活`、`身份凭信`、`制度管理`、`金属工艺` 等主题。
- 地契不再只归入纸质工艺，而是进入 `社会文书`、`社会生活`、`制度文书`。
- 石印、印信类进入 `印章文化`、`身份凭信`、`制度管理`。
- 铜器和金属器进入 `金属器文化`、`金属工艺`。

## 4. reviewFlags 说明

当前 v2 已生成以下标记：

| reviewFlag | 含义 |
| --- | --- |
| `missing_source_url` | 缺少权威来源链接，当前为 `暂无信息` 或空 |
| `missing_description_source` | 原始数据没有正式介绍来源 |
| `template_generated_description` | `description` 由规则模板生成，不是馆方正式文案 |
| `low_tag_confidence` | 自动标签仍只能落到较泛主题 |
| `period_in_title_but_missing_dynasty` | 题名包含时代词，但结构化时代字段缺失或不确定 |
| `uncertain_period` | 时代信息需要人工核定 |
| `generic_curator_note` | 策展提示仍偏泛 |
| `needs_authority_check` | 自动生成内容需要权威资料复核 |

本轮所有 92 条均包含 `needs_authority_check`，因为简介、详细介绍、标签和策展提示都是规则生成结果。当前 92 条全部 `needsHumanReview: true`，适合在 RAG 平台中先作为可过滤的测试数据，而非正式上线内容。

## 5. 仍需人工审核的内容

1. `sourceUrl` 和版权说明：当前缺少可回链的权威页面。
2. `description`：虽已类型化，但仍是规则生成文案，不等同于馆方正式说明。
3. 题名含时代但 period 缺失的文物：如 `春秋战国曲刃青铜短剑`，v2 只生成待核标签，不覆盖正式字段。
4. 类别与材质疑似冲突的文物：如类别为瓷器但材质为玻璃的鼻烟壶。
5. 特定主题标签：佛教造像、碑刻铭文、社会文书等需要专家或馆方资料确认。
6. 关系候选：`artifact-relation-seeds.v2.json` 仍是候选边，不是已确认知识图谱事实。

## 6. 是否建议进入小规模 RAG 检索测试

建议进入小规模 RAG 检索测试。

适合测试：

- 名称、朝代、类别、材质、文化标签、主题标签召回。
- 按 `needsHumanReview` 或 `reviewFlags` 过滤高风险内容。
- 比较 v1 与 v2 在“石印”“铜器”“地契”“鼻烟壶”“书画”等查询下的召回质量。

不建议：

- 不建议直接作为正式讲解文本上线。
- 不建议把自动关系候选作为事实图谱发布。
- 不建议让模型基于当前数据生成出土故事、人物经历或确定性历史解释。

结论：v2 比 v1 更适合做 RAG 技术验证和知识图谱候选边预处理，但仍应保持“人工审核优先”的上线策略。
