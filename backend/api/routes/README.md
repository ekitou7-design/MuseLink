# backend/api/routes 文件夹说明

这个文件夹记录后端有哪些「接口地址」。

接口地址可以理解成前端和后端约好的办事窗口。

比如：

- 登录走登录窗口
- 注册走注册窗口
- 文物列表走文物窗口
- 后台用户列表走管理员窗口

## 知识库路由进度

知识库现在已经有可用路由：

| 功能 | 地址 |
|------|------|
| 文物列表和筛选 | `GET /api/artifacts` |
| 文物详情 | `GET /api/artifacts/:id` |
| 博物馆列表 | `GET /api/museums` |
| 单馆详情和馆藏 | `GET /api/museums/:id` |
| 本地 RAG 候选检索 | `POST /api/rag/search` |
| 导入模板 | `GET /api/import/template` |
| 导入预览 | `POST /api/import/preview` |
| 执行导入 | `POST /api/import/run` |

这些路由目前支撑 92 件导入文物的浏览、搜索、详情、博物馆聚合和智能策展候选。外部向量数据库还没有接入，当前检索模式是全字段关键词排序。

## 常见接口地址

账号：

| 功能 | 地址 |
|------|------|
| 注册 | `POST /api/auth/register` |
| 密码登录 | `POST /api/auth/login` |
| 请求验证码 | `POST /api/auth/code/request` |
| 验证码登录 | `POST /api/auth/code/login` |
| 获取当前登录用户 | `GET /api/auth/me` |

文物：

| 功能 | 地址 |
|------|------|
| 获取文物列表 | `GET /api/artifacts` |
| 获取单个文物 | `GET /api/artifacts/:id` |
| 新增文物 | `POST /api/artifacts` |
| 修改文物 | `PUT /api/artifacts/:id` |
| 删除文物 | `DELETE /api/artifacts/:id` |

收藏和展陈：

| 功能 | 地址 |
|------|------|
| 收藏文物 | `POST /api/likes` |
| 取消收藏 | `DELETE /api/likes/:id` |
| 查看收藏 | `GET /api/likes` |
| 查看展陈 | `GET /api/exhibitions` |
| 创建展陈 | `POST /api/exhibitions` |

## 哪些接口需要登录？

一般来说：

- 浏览文物、看展陈：可以公开访问
- 收藏、创建展陈、查看自己信息：需要登录
- 管理用户、增删改文物：需要管理员

## 常见报错是什么意思？

| 报错 | 大概意思 |
|------|------|
| 401 | 没登录，或者登录过期 |
| 403 | 已登录，但不是管理员 |
| 404 | 地址不存在，可能接口写错了 |
| 405 | 线上只有静态网页，没有正确连到后端 |
| 500 | 后端内部出错，需要看终端日志 |

## 给开发同学的提醒

新加接口时，先想清楚：

- 是否公开访问
- 是否需要登录
- 是否只有管理员能用
- 前端会不会在 Cloudflare Pages 部署后还能访问到它
