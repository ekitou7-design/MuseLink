# backend 文件夹说明

这个文件夹放的是「后端逻辑」。

前端是用户看到的页面，后端是 App 背后做事的部分，比如：

- 注册账号
- 登录账号
- 判断是不是管理员
- 保存收藏
- 保存展陈
- 读取和导入文物数据

## 后端里的知识库能力

当前知识库主要由后端负责读取、导入和检索。它已经可以：

- 从 `data/imported-artifacts.json` 读取 226 件导入文物，导入数据存在时优先使用导入库
- 通过 `/api/artifacts` 提供文物列表，并支持关键词、博物馆、时代、文化筛选
- 通过 `/api/artifacts/:id` 提供文物详情
- 通过 `/api/museums` 根据文物自动聚合 113 个博物馆条目
- 通过 `/api/rag/search` 给智能策展和相关文物推荐提供关键词检索候选
- 通过 `/api/import/template`、`/api/import/preview`、`/api/import/run` 支持导入流程

AI-ready v2、RAG JSONL 和知识图谱候选文件保存在 `data` 文件夹，由 `scripts/data-prep` 生成。后端目前使用本地关键词检索，不依赖外部向量数据库。

## 非技术同学先看这个

你可以把后端理解成 App 的「服务台」：

- 前端问：这个账号能不能登录？
- 后端查：账号和密码对不对？
- 前端问：这个用户收藏了哪些文物？
- 后端查：数据文件里有没有记录？
- 前端问：管理员能不能看后台？
- 后端判断：这个账号是不是管理员？

## 默认管理员账号

当前项目启动时会保证这个管理员账号存在：

```text
账号：jiangzhong
密码：jiangzhong
角色：admin
```

如果本地数据文件里这个账号被改坏了，项目启动时会尽量自动修正。

## 数据保存在哪里？

现在项目主要把数据保存在 `data` 文件夹里。

常见文件包括：

| 文件 | 保存什么 |
|------|------|
| `data/auth-users.json` | 用户账号 |
| `data/user-data.json` | 收藏、关注等用户数据 |
| `data/exhibitions.json` | 展陈数据 |
| `data/imported-artifacts.json` | 导入的文物数据 |

这些都是普通文本数据文件，方便演示和调试。

正式上线、用户变多以后，建议再升级成真正的数据库。

## 常见功能对应哪里

| 功能 | 主要文件 |
|------|------|
| 注册、登录、管理员账号 | `backend/auth.ts` |
| 读取和写入 JSON 数据 | `backend/store.ts` |
| 导入文物数据 | `backend/artifact-importer.ts` |
| 用户收藏等数据 | `backend/user-data.ts` |
| 展陈数据 | `backend/exhibitions.ts` |

## 线上部署时要注意

如果前端部署在 Cloudflare Pages，后端必须另外部署到能运行 Node.js 的地方。

后端至少需要配置：

```text
JWT_SECRET=请换成一串只有团队知道的长密码
CORS_ORIGIN=https://你的前端网址
```

`CORS_ORIGIN` 的意思是：允许哪个网页来访问这个后端。

如果这里没配对，线上网页可能会出现登录失败、接口请求失败等问题。

## 给开发同学的提醒

- 密码不是明文保存，会经过 bcrypt 加密
- 登录成功后会返回 JWT token
- 需要登录的接口会检查 `Authorization` 请求头
- 管理员接口会额外检查用户角色是不是 `admin`
