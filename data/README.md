# data 文件夹说明

这个文件夹保存本地数据。

你可以把它理解成项目的「本地小数据库」。

## 这里有什么？

| 文件 | 保存什么 |
|------|------|
| `auth-users.json` | 用户账号 |
| `auth-user-seq.json` | 用户编号计数 |
| `user-data.json` | 收藏、关注等用户个人数据 |
| `exhibitions.json` | 展陈数据 |
| `imported-artifacts.json` | 导入的文物数据 |
| `imported-museums.json` | 根据文物数据生成的博物馆数据 |

## 可以直接改这些文件吗？

可以看，但不建议随便改。

这些文件格式要求比较严格，少一个逗号或多一个符号都可能导致项目启动失败。

如果要改，建议先复制一份备份。

## 文物导入后会写到哪里？

运行导入命令后，文物通常会写入：

```text
data/imported-artifacts.json
```

App 会优先展示这里的文物。

## 用户账号在哪里？

用户账号在：

```text
data/auth-users.json
```

注意：密码不会直接保存成明文，而是保存成加密后的字符串。

所以不要试图在这个文件里直接改密码。

## 管理员账号

项目启动时会确保默认管理员账号存在：

```text
账号：jiangzhong
密码：jiangzhong
```

## 给非技术同学的提醒

如果你只是体验 App，不需要打开这个文件夹。

如果你要核对导入数据，可以主要看：

```text
data/imported-artifacts.json
```

如果你要清空或批量修改数据，最好先找技术同事一起操作。
