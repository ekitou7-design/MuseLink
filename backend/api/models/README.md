# backend/api/models 文件夹说明

这个文件夹放数据格式说明。

开发同学会用它来约定：

- 用户数据长什么样
- 文物数据长什么样
- 展陈数据长什么样
- 接口返回结果应该包含哪些字段

## 非技术同学怎么理解？

可以把这里理解成「表格字段规范」。

比如一条文物数据通常会有：

- 文物 ID
- 名称
- 所属博物馆
- 年代
- 材质
- 描述
- 图片地址

## 知识库字段现状

当前知识库数据已经不只包含基础文物字段，还派生了适合 AI 和检索使用的字段：

- `shortIntro`、`description`、`ragText`：用于摘要展示和 RAG 检索文本
- `regionTag`、`cultureTags`、`themeTags`、`materialTags`、`periodTags`：用于筛选、聚类和策展
- `relationSeeds`：用于生成同馆藏、同时代、同类别、同材质等关系候选
- `workflowSummary`、`curatorNote`、`isCuratable`：用于智能策展流程

这些字段主要出现在 `data/imported-artifacts.ai-ready.v2.json`，正式作为模型规范前还需要人工审核和类型收敛。

一条用户数据通常会有：

- 用户 ID
- MuseLink ID
- 角色，是普通用户还是管理员
- 创建时间

## 什么时候需要看这里？

大多数人不用看。

只有当团队要新增字段时，比如：

- 文物要增加「尺寸」
- 文物要增加「等级」
- 展陈要增加「封面图」
- 用户要增加「机构名称」

这时开发同学需要同步修改这里的类型定义。
