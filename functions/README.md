# functions 文件夹说明

这个文件夹是给 Cloudflare Pages 部署用的。

如果只是本地运行 App，可以先不用看这里。

## 它解决什么问题？

Cloudflare Pages 主要负责放网页。它不会自动运行本项目的后端。

但是 App 里有很多功能需要后端，比如：

- 登录
- 注册
- 收藏
- 读取文物列表
- 读取展陈

所以线上部署时必须有一个真正的后端网址。

`functions/api/[[path]].ts` 的作用很简单：

```text
用户访问 Cloudflare Pages 的 /api/xxx
        ↓
这个 functions 文件收到请求
        ↓
转发到真正的后端 /api/xxx
```

它像一个转发员，不负责真正处理登录和数据。

## 需要配置什么？

如果使用这个代理，需要在 Cloudflare Pages 的环境变量里设置：

```text
BACKEND_API_BASE_URL=https://你的后端网址
```

例如：

```text
BACKEND_API_BASE_URL=https://muselink-api.example.com
```

## 不用这个代理可以吗？

可以。

如果不用 `functions` 代理，就在 Cloudflare Pages 的前端环境变量里设置：

```text
VITE_API_BASE_URL=https://你的后端网址
```

两种方式选一种就好。

## 最重要的提醒

`functions` 不是完整后端。

它不能单独让登录和注册工作。真正的后端仍然要部署到 Render、Railway、Fly.io、Cloud Run 或自己的服务器上。
