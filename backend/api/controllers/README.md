# backend/api/controllers 文件夹说明

这个文件夹放后端的「具体办事逻辑」。

路由负责把请求送到正确窗口，controller 负责真正处理这件事。

## 它管什么？

- 登录请求来了，要检查账号密码
- 文物列表请求来了，要整理文物数据
- 收藏请求来了，要保存收藏记录
- 展陈请求来了，要创建或读取展陈

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
