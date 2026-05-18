# src/services 文件夹说明

## 整体作用

业务服务层。当前包含基于文物元数据的**本地规则**策展与关联推荐，并提供 provider-neutral 接口，后续可接任意 AI 网关或自建模型服务。

## 核心文件

**curatorService.ts**

- `generateExhibition(userPrompt, allArtifacts)` — 先通过 `/api/rag/search` 按关键词筛选候选文物，再生成标题、前言与 `artifactIds` 草案。
- `getRelatedArtifacts(currentArtifact, allArtifacts)` — 按馆藏、年代、材质、出土地等规则打分，返回关联文物与简短理由。
- `setCurationProvider(provider)` — 替换策展 provider，可接 OpenAI-compatible 网关、Claude、本地模型或其他后端 AI 服务。
- `createRemoteCurationProvider(endpoint)` — 创建通用远程 provider，向指定 endpoint 发送 `action` 与上下文数据。

## 配置

默认无需云端推理密钥即可运行。需要外部 AI 时，请在后端或自建网关中管理密钥，再通过通用 provider 接入；登录等功能如需可自行配置 `JWT_SECRET` 等（见项目根说明）。
