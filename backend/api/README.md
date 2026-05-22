# backend/api 文件夹说明

这个文件夹可以理解成后端的「接口说明区」。

接口就是前端和后端说话的地址。比如用户点击登录按钮时，前端会请求登录接口，后端检查账号密码后再回复结果。

## 这里主要负责什么？

- 接收前端请求
- 判断请求的是登录、注册、文物列表还是后台数据
- 检查用户有没有登录
- 检查用户是不是管理员
- 把结果返回给前端

## 知识库相关接口

当前知识库已经接入这些接口：

| 功能 | 接口 |
|------|------|
| 文物列表、关键词筛选 | `GET /api/artifacts?q=关键词` |
| 单件文物详情 | `GET /api/artifacts/:id` |
| 博物馆聚合列表 | `GET /api/museums` |
| 单个博物馆及馆藏 | `GET /api/museums/:id` |
| 策展候选检索 | `POST /api/rag/search` |
| 导入模板 | `GET /api/import/template` |
| 导入预览 | `POST /api/import/preview` |
| 执行导入 | `POST /api/import/run` |

这些接口现在主要服务于 92 件导入文物、83 个博物馆聚合条目、智能策展候选和后续 RAG 平台接入。`/api/rag/search` 当前是本地关键词排序，不是外部向量检索。

## 常见接口

账号相关：

| 功能 | 接口 |
|------|------|
| 注册 | `POST /api/auth/register` |
| 密码登录 | `POST /api/auth/login` |
| 请求验证码 | `POST /api/auth/code/request` |
| 验证码登录 | `POST /api/auth/code/login` |
| 获取当前用户 | `GET /api/auth/me` |

文物相关：

| 功能 | 接口 |
|------|------|
| 文物列表 | `GET /api/artifacts` |
| 博物馆列表 | `GET /api/museums` |
| 文物详情 | `GET /api/artifacts/:id` |

展陈和收藏：

| 功能 | 接口 |
|------|------|
| 展陈列表 | `GET /api/exhibitions` |
| 创建展陈 | `POST /api/exhibitions` |
| 收藏文物 | `POST /api/likes` |
| 取消收藏 | `DELETE /api/likes/:id` |

管理员：

| 功能 | 接口 |
|------|------|
| 用户列表 | `GET /api/admin/users` |
| 系统统计 | `GET /api/admin/stats` |

## 为什么线上会有跨域问题？

如果前端网页在一个网址，后端服务在另一个网址，浏览器会先确认：

```text
这个网页有没有权限访问这个后端？
```

后端通过 `CORS_ORIGIN` 回答这个问题。

线上部署时请配置：

```text
CORS_ORIGIN=https://你的前端网址
```

如果这里配错，网页可能能打开，但登录或加载数据会失败。

## Cloudflare Pages 特别提醒

Cloudflare Pages 只放前端网页，不会自动运行后端。

线上要正常工作，需要：

1. 把后端部署到能运行 Node.js 的平台
2. 让前端知道后端网址，配置 `VITE_API_BASE_URL`
3. 或者使用 `functions` 文件夹里的代理，配置 `BACKEND_API_BASE_URL`

## 给开发同学的入口

主要启动文件是根目录的：

```text
server.ts
```

需要看具体路由说明，可以继续看：

```text
backend/api/routes/README.md
```
