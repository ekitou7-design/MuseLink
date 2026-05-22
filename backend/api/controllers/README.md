# backend/api/controllers 文件夹说明

这个文件夹放后端的「具体办事逻辑」。

路由负责把请求送到正确窗口，controller 负责真正处理这件事。

## 它管什么？

- 登录请求来了，要检查账号密码
- 文物列表请求来了，要整理文物数据
- 收藏请求来了，要保存收藏记录
- 展陈请求来了，要创建或读取展陈

## 知识库相关办事逻辑

当前知识库的具体处理主要包括：

- 读取导入文物并返回列表、详情和筛选结果
- 根据文物自动聚合博物馆数据
- 为智能策展提供 `/api/rag/search` 候选文物 ID
- 处理导入模板、导入预览和执行导入

这些能力目前围绕 `data/imported-artifacts.json` 的 92 件文物工作；AI-ready v2、RAG JSONL 和关系候选由 `scripts/data-prep` 离线生成。

## 常见 controller

| 文件 | 做什么 |
|------|------|
| `authController.ts` | 注册、登录、获取当前用户 |
| `artifactsController.ts` | 文物列表、详情、新增、修改、删除 |
| `likesController.ts` | 收藏和取消收藏 |
| `exhibitionsController.ts` | 展陈列表、创建、修改、删除 |

## 给非技术同学的理解

如果接口地址像「窗口号码」，controller 就是窗口后面真正办事的人。

比如点击登录：

```text
登录页
  ↓
登录接口
  ↓
authController
  ↓
账号逻辑
  ↓
返回登录结果
```

## 常见问题

| 现象 | 可能要看哪里 |
|------|------|
| 登录返回错误 | `authController.ts` 和 `backend/auth.ts` |
| 文物列表不对 | `artifactsController.ts` 和数据文件 |
| 收藏失败 | `likesController.ts` 和用户数据 |
| 展陈保存失败 | `exhibitionsController.ts` 和展陈数据 |
