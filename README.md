# 博悟 MuseLink 使用说明

这份文档写给所有项目成员，不要求你会写代码。你可以把 MuseLink 理解成一个文博 App：

- 可以浏览文物
- 可以搜索文物、博物馆和展陈
- 可以注册、登录、收藏
- 可以用关键词生成展陈草案
- 管理员可以进入后台看用户和统计
- 团队可以导入自己的博物馆文物数据

## 先看这里：你是哪种角色？

如果你只是想打开 App 看效果：

1. 看「本地运行：Mac 和 Windows 都适用」
2. 打开浏览器
3. 注册或用管理员账号登录

如果你要导入文物数据：

1. 先确认 App 能正常打开
2. 再看「导入文物数据」

如果你要部署到线上：

1. 先看「线上部署要知道的事」
2. 再找会部署后端的同事一起做

## 本地运行：Mac 和 Windows 都适用

### 第一步：安装 Node.js

这个项目需要 Node.js 20 或更高版本。

你可以在这里下载：

```text
https://nodejs.org/
```

安装完成后，重新打开终端。

Mac 用户通常打开「终端」或 VS Code 里的 Terminal。

Windows 用户建议打开 VS Code 里的 Terminal，或者打开 PowerShell。

### 第二步：打开项目文件夹

用 VS Code 打开这个项目文件夹，也就是包含 `package.json` 的那个文件夹。

如果你不确定是不是正确位置，看左侧文件列表里有没有这些文件：

- `README.md`
- `package.json`
- `src`
- `backend`
- `data`

### 第三步：安装依赖

在 VS Code 底部的 Terminal 里输入：

```bash
npm install
```

这一步会下载项目需要的工具。第一次运行会慢一点。

### 第四步：启动 App

继续输入：

```bash
npm run dev
```

看到类似 `localhost:3000` 的地址后，打开浏览器访问：

```text
http://localhost:3000
```

### 如果 3000 端口被占用

有时候电脑上别的软件已经占用了 3000 端口，可以换成 3001。

Mac / Windows PowerShell 都可以用：

```bash
npm run dev -- --port 3001
```

然后打开：

```text
http://localhost:3001
```

## 登录和账号

### 普通用户

你可以在 App 里注册新账号。注册成功后，系统会给你一个 MuseLink ID。

请保存好这个 ID，它就是之后登录用的账号。

### 管理员账号

当前默认管理员账号是：

```text
账号：jiangzhong
密码：jiangzhong
```

登录后可以进入后台管理页：

```text
http://localhost:3000/#/admin
```

如果你用的是 3001 端口，就打开：

```text
http://localhost:3001/#/admin
```

## App 怎么体验

建议第一次按这个顺序试：

1. 打开首页
2. 注册一个普通账号，或者直接用管理员账号登录
3. 在「探索」里浏览文物
4. 搜索一个关键词
5. 收藏几个文物
6. 到「展陈」里试一次智能策展
7. 到「我的」里查看收藏和展陈
8. 如果是管理员，进入后台看看用户列表和统计

## 常见问题

### npm install 很慢怎么办？

这是正常的，第一次会下载很多依赖。可以先等几分钟。

如果一直失败，把终端里的报错截图发给负责技术的同事。

### npm run dev 后网页打不开怎么办？

先看终端里有没有 `localhost` 地址。

如果有，就复制那个地址到浏览器。

如果没有，说明项目没启动成功，请把终端报错发给技术同事。

### 登录时报 405 Method Not Allowed 是什么意思？

这通常发生在线上部署时。

简单说：网页部署成功了，但处理登录的后端没有部署好，或者网页没有连到后端。

请看下面「线上部署要知道的事」。

### Mac 和 Windows 命令一样吗？

大多数命令一样，比如：

```bash
npm install
npm run dev
npm run build
```

少数设置环境变量的命令在 Mac 和 Windows 上不同。为了避免混乱，本文尽量使用两边都能用的命令。

## 导入文物数据

项目支持导入 `JSON`、`CSV`、`NDJSON` 格式的文物数据。

最推荐的方式是：一个博物馆准备一个导入任务文件。

示例文件在：

```text
imports/example-national-museum.json
```

### 执行示例导入

先保证你已经运行过：

```bash
npm install
```

然后在项目根目录运行：

```bash
npm run import:artifacts -- ./imports/example-national-museum.json
```

成功后，导入结果会保存到：

```text
data/imported-artifacts.json
```

只要这个文件里有数据，App 会优先展示这些导入的数据。

### 给数据同事的理解方式

导入任务文件的作用是告诉系统：

- 这批数据来自哪个博物馆
- 原始表格里的「名称」对应 App 里的哪个字段
- 原始表格里的「年代」对应 App 里的哪个字段
- 如果某些字段缺失，要不要自动填默认值
- 这次导入是追加，还是替换某个博物馆旧数据

如果你拿到的是 Excel，建议先另存为 CSV，再让技术同事帮你配置一次导入任务文件。

## 常用命令

这些命令都在项目根目录运行。

安装依赖：

```bash
npm install
```

启动本地 App：

```bash
npm run dev
```

检查能不能正式打包：

```bash
npm run build
```

导入示例文物数据：

```bash
npm run import:artifacts -- ./imports/example-national-museum.json
```

## 线上部署要知道的事

这一段主要给负责发布的同事看。

Cloudflare Pages 只能直接托管网页文件。它不会自动运行本项目里的后端服务。

所以 MuseLink 线上要正常登录、注册、收藏和读取接口，需要两部分：

1. 前端网页，部署到 Cloudflare Pages
2. 后端服务，部署到能运行 Node.js 的平台

后端可以放在：

- Render
- Railway
- Fly.io
- Google Cloud Run
- 自己的服务器

### 推荐部署方式

后端配置：

```text
JWT_SECRET=请换成一串只有团队知道的长密码
CORS_ORIGIN=https://你的-pages-网址.pages.dev
```

Cloudflare Pages 前端配置：

```text
VITE_API_BASE_URL=https://你的后端网址
```

这样前端就知道登录、注册、文物列表这些请求要发到哪里。

### 另一种方式：使用 Pages Functions 代理

项目里有这个文件：

```text
functions/api/[[path]].ts
```

它的作用是把 Cloudflare Pages 上的 `/api/...` 请求转发给真正的后端。

如果使用这种方式，需要在 Cloudflare Pages 里配置：

```text
BACKEND_API_BASE_URL=https://你的后端网址
```

注意：这个代理不是后端本身，它只是一个转发员。真正的后端仍然必须部署。

## 文件夹大概是干什么的

不需要会代码也可以先有个印象：

| 文件夹 | 用途 |
|------|------|
| `src` | 前端界面，用户看到的页面都在这里 |
| `backend` | 后端逻辑，登录、账号、数据保存等在这里 |
| `data` | 本地数据文件，比如用户、展陈、导入的文物 |
| `imports` | 文物导入示例和导入任务文件 |
| `functions` | Cloudflare Pages 的接口代理 |
| `scripts` | 一些辅助脚本 |

更多细节可以看各文件夹里的 `README.md`。
