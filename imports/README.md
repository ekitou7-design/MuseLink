# imports 文件夹说明

这个文件夹放文物导入用的示例和任务文件。

如果团队要把某个博物馆的数据导进 MuseLink，通常会从这里开始。

## 最重要的示例文件

```text
imports/example-national-museum.json
```

它可以作为模板参考。

## 导入数据的大概流程

1. 准备原始数据，比如 CSV 或 JSON
2. 准备一个导入任务文件，说明字段怎么对应
3. 运行导入命令
4. 检查 App 里有没有正确显示

## 推荐给数据同事的做法

如果你拿到的是 Excel：

1. 先另存为 CSV
2. 把 CSV 放到 `imports` 文件夹
3. 找技术同事帮你配置一次导入任务文件
4. 后续同类型数据可以复用这个配置

## 示例导入命令

在项目根目录运行：

```bash
npm run import:artifacts -- ./imports/example-national-museum.json
```

导入成功后，数据会写到：

```text
data/imported-artifacts.json
```

## 常见问题

| 问题 | 说明 |
|------|------|
| 导入失败 | 可能是文件格式不对，或字段名没有对应上 |
| 中文乱码 | 通常是 CSV 编码问题，建议保存为 UTF-8 |
| 导入后看不到数据 | 先确认 `data/imported-artifacts.json` 是否有内容，再重启 App |
| 数据重复 | 导入模式可能选成了追加，需要改成替换某个博物馆 |

## 给非技术同学的理解

`imports` 不是最终数据仓库。

它更像「导入准备区」。真正被 App 读取的数据通常在 `data/imported-artifacts.json`。
