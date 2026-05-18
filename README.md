# 博悟 MuseLink

这个项目现在已经带有一个可复用的“文物导入后端”，可以把不同博物馆导出的 `JSON / NDJSON / CSV` 数据，映射成你当前 App 使用的文物结构：

```ts
{
  id,
  name,
  museum,
  period, // 朝代 / 年代（与数据源字段一致）
  material,
  culture,
  origin,
  description,
  imageUrl,
  tags,
  favsCount,
  // 以下为可选扩展字段：有值且配置了展示标签时，才会在「文物详情」扩展信息区出现对应卡片
  category?,
  level?,
  dimensions?,
  remarks?,
}
```

导入完成后：

- 数据会先写入本地文件 `data/imported-artifacts.json`
- 前端会自动优先读取这些导入数据
- 如果本地还没有导入数据，前端会回退到原来的 mock 数据

## 1. 本地运行

前提：

- Node.js 20+

步骤：

1. 安装依赖
   ```bash
   npm install
   ```
2. （可选）在项目根目录创建 `.env.local`，配置例如 `JWT_SECRET`（登录鉴权用）。
3. 启动项目
   ```bash
   npm run dev
   ```
4. 浏览器打开
   ```text
   http://localhost:3000
   ```

如果 `3000` 端口被占用，可以这样启动：

```bash
PORT=3001 DISABLE_HMR=true npm run dev
```

然后打开：

```text
http://localhost:3001
```

## App 功能概览

MuseLink 可以理解成一个“文物浏览 + 个人策展 + 账号系统 + 后台管理”的文博应用。

当前你可以用它做这些事：

- 浏览文物
  在首页按 `推荐 / 博物馆 / 年代 / 馆藏全览` 查看文物内容
- 搜索内容
  搜索文物、展陈、博物馆等内容
- 注册和登录
  注册后系统会生成唯一的 `MuseLink ID`，后续用它登录
- 收藏文物
  未登录时可先保存在本地，登录后可同步到账号
- 智能策展（本地规则）
  根据关键词与文物元数据生成展陈草案（不依赖外部大模型 API）
- 管理我的展陈
  新建、编辑、删除自己的展陈，并管理展陈中的文物
- 浏览展陈广场
  查看公开展陈内容
- 查看个人中心
  查看自己的 MuseLink ID、账号角色、收藏和展陈
- 进入管理员后台
  管理员可以查看系统用户列表和统计数据
- 导入自己的文物数据
  支持通过 JSON / NDJSON / CSV 导入文物库
- 查看文物详情
  全屏详情页：顶栏返回与收藏、图片区（可点开放大）、名称 / 博物馆 / 朝代与接口返回一致（仅 `null` 或空字符串 `""` 时显示统一占位「未知」）、扩展信息区按固定标签展示有值的字段；收藏状态会在切回页面或焦点恢复时与服务端 / 本地存储对齐

说明：

- 有些页面里仍有少量“未开发”占位入口，但核心流程已经可以使用

## 新手使用指南

如果你是第一次接触这个 App，建议直接按下面顺序体验。

### 第一步：启动 App

在项目根目录运行：

```bash
npm install
npm run dev
```

打开浏览器访问：

```text
http://localhost:3000
```

### 第二步：先注册账号

打开注册页后：

1. 输入密码
2. 再输入一次确认密码
3. 点击“注册”

注册成功后，页面会显示一个 **MuseLink ID**。

这个 ID 很重要：

- 它不是手机号
- 它不是昵称
- 它是你之后登录时要用的账号号

系统现在支持：

- 大字高亮显示 MuseLink ID
- 一键复制 MuseLink ID
- 一键跳到登录页

### 第三步：登录

注册成功后，直接点击“去登录”即可。

登录页会自动帮你填入刚才注册得到的 MuseLink ID，你只需要：

1. 输入刚才设置的密码
2. 点击“登录”

如果你不是从注册页跳过来的，也可以手动输入：

- MuseLink ID（8 到 10 位数字）
- 密码

### 第四步：先认识首页怎么用

登录后你会进入首页。

底部主要有 3 个区域：

- `探索`
  看文物内容
- `展陈`
  看 AI 策展、我的展陈、展陈广场
- `我的`
  看个人资料、收藏、展陈和账号信息

#### 1. 探索

在“探索”里，你可以按这些方式看文物：

- `推荐`
  看热门或推荐文物
- `博物馆`
  按博物馆筛选
- `年代`
  按朝代筛选
- `馆藏全览`
  综合搜索、筛选和浏览全部馆藏

顶部还有搜索框，可以直接搜索关键词。

#### 2. 展陈

在“展陈”里有 3 类常用功能：

- `AI 智能策展`
  输入一个主题词，让 AI 帮你生成一个展陈方案
- `我的策展`
  登录后可以新建、查看和编辑自己的展陈
- `展陈广场`
  查看公开展陈内容

如果你想试试 AI 策展，可以输入这样的关键词：

- `青铜器与王权`
- `唐代女性生活`
- `丝绸之路上的器物交流`

#### 3. 我的

在“我的”页面里，你可以看到：

- 自己的 MuseLink ID
- 当前账号角色（`user` 或 `admin`）
- 收藏文物
- 我的展陈
- 收藏展陈

### 第五步：收藏和同步

这个 App 支持“先收藏，后登录同步”。

也就是说：

- 如果你还没登录，收藏内容会先存在当前浏览器本地
- 登录后，系统会尝试把这些收藏同步到你的账号

这对第一次试用很友好，不需要一开始就强制登录。

### 第六步：管理员怎么进入后台

默认管理员账号如下：

- MuseLink ID：`00000000`
- 密码：`admin123`

管理员登录后可以：

- 从首页点击“进入后台管理”
- 或直接访问 `#/admin`

后台目前可以查看：

- 全部用户列表
- 用户总数
- 管理员数量
- 已分配 MuseLink ID 的数量

普通用户不能访问后台。

### 推荐的新手体验顺序

如果你不知道先做什么，可以照这个顺序来：

1. 启动项目
2. 注册账号
3. 保存好 MuseLink ID
4. 登录
5. 在“探索”里看看文物
6. 收藏几个你喜欢的文物
7. 去“展陈”试一次 AI 策展
8. 去“我的”看收藏和展陈
9. 如果你是管理员，再进入后台看看用户和统计

## 2. 导入后端支持什么

后端已经新增这些能力：

- `GET /api/artifacts`
  用来读取当前文物库（响应为 `artifacts` 数组及 `source` / `total` 等元信息）
- `GET /api/museums`
  用来按博物馆汇总统计
- `GET /api/import/template`
  返回一个可直接参考的导入模板
- `POST /api/import/preview`
  只预览导入结果，不落库
- `POST /api/import/run`
  正式导入
- `npm run import:artifacts -- <任务文件>`
  在 VS Code 终端里直接导入，不需要手写 HTTP 请求

### 2.1 文物详情与界面数据一致性

前端对**业务字段**不做截断、替换、翻译或格式化；界面展示与接口返回的字符串一致。

- **空值规则**：仅当字段为 `null`、`undefined` 或完全空字符串 `""` 时，界面统一显示占位 **`未知`**。若数据库返回的是「未知」「暂无」等任意非空字符串，则原样显示。
- **固定标签**（非接口字段）：文物详情扩展区使用固定文案 **类别、等级、材质、尺寸、文化、出土地、备注**，与字段 `category` / `level` / `material` / `dimensions` / `culture` / `origin` / `remarks` 对应；仅当对应字段为非空字符串时渲染该卡片。
- **顶栏标题**：详情页顶栏弱标题固定为「文物详情」（非业务数据字段）。
- **实现位置**：空值占位由 `src/lib/dbDisplay.ts` 的 `displayDbString` / `isStrictDbEmpty` 统一处理；图片无 URL 或与加载失败时，`src/components/SafeImage.tsx` 对空链显示「未知」，对加载失败且 URL 非空时展示**原始 URL 字符串**以便与数据源逐字对应。
- **同义字段归并（不改写内容）**：库或导入 JSON 可能用不同键表示同一语义。展示与筛选按 `src/lib/dbDisplay.ts` 中定义的顺序取**第一个非空**值，例如朝代/时代/年代为 `朝代` → `dynasty` → `时代` → `period` → `era` → `年代`；图片、馆名、文物名、材质、文化、出土地、简介、等级、类别、尺寸、备注等均有对应键序（与导入器别名对齐）。

## 3. 最推荐的用法：在 VS Code 终端直接导入

这是最适合你现在的方式。

### 3.1 准备导入任务文件

你可以直接参考这个示例文件：

- `imports/example-national-museum.json`

它既是示例数据，也是一个可执行的导入任务。

一个任务文件通常长这样：

```json
{
  "sourceName": "中国国家博物馆示例导入",
  "sourceType": "inline",
  "mode": "replace-museum",
  "persistTo": ["file"],
  "defaults": {
    "museum": "中国国家博物馆",
    "culture": "馆藏文物",
    "favsCount": 0
  },
  "mapping": {
    "id": ["文物编号", "id"],
    "name": ["名称", "name", "title"],
    "museum": ["博物馆", "museum"],
    "period": ["年代", "period"],
    "material": ["材质", "material"],
    "culture": ["文化", "culture", "category"],
    "origin": ["出土地", "origin"],
    "description": ["简介", "description", "summary"],
    "imageUrl": ["图片", "imageUrl", "image"],
    "tags": ["标签", "tags"],
    "favsCount": ["热度", "favsCount"],
    "category": ["类别", "category"],
    "level": ["等级", "level"],
    "dimensions": ["尺寸", "dimensions", "size"],
    "remarks": ["备注", "remarks"]
  },
  "records": []
}
```

字段说明：

- `sourceName`
  这次导入任务的名字，方便识别
- `sourceType`
  `inline` 表示数据直接写在 `records` 里
- `mode`
  `replace-museum` 表示用这次导入的数据替换同博物馆旧数据
- `persistTo`
  `["file"]` 表示写入本地文物库
- `mapping`
  告诉系统“你拿到的原始字段”对应 App 里的哪个字段
- `defaults`
  原始数据没有某个字段时，自动补默认值
- `records`
  原始文物数组

可选扩展字段 `category` / `level` / `dimensions` / `remarks` 与导入器中的别名、标签推断规则一致；若数据源中存在对应列或文内标签，也会被自动识别（详见 `backend/artifact-importer.ts`）。

### 3.2 执行导入

在 VS Code 终端运行：

```bash
npm run import:artifacts -- ./imports/example-national-museum.json
```

成功后你会看到类似输出：

```text
导入完成
来源: 中国国家博物馆示例导入
原始记录: 2
有效文物: 2
跳过记录: 0
已写入本地库: 2
涉及博物馆: 中国国家博物馆
```

### 3.3 导入结果会写到哪里

本地文件：

```text
data/imported-artifacts.json
```

只要这个文件里有数据，前端就会优先展示这里的内容。

## 4. 如果你的数据是单独文件，而不是写在 records 里

你也可以用文件路径模式：

```json
{
  "sourceName": "故宫文物导入",
  "sourceType": "file",
  "inputPath": "./imports/gugong-artifacts.json",
  "format": "json",
  "listPath": "data.items",
  "mode": "replace-museum",
  "persistTo": ["file"],
  "defaults": {
    "museum": "故宫博物院",
    "culture": "宫廷文物",
    "favsCount": 0
  },
  "mapping": {
    "id": ["id", "编号"],
    "name": ["名称", "title"],
    "period": ["年代", "era"],
    "material": ["材质"],
    "origin": ["来源", "出土地"],
    "description": ["说明", "简介"],
    "imageUrl": ["图片", "cover"],
    "tags": ["标签", "keywords"],
    "category": ["类别"],
    "level": ["等级"],
    "dimensions": ["尺寸"],
    "remarks": ["备注"]
  }
}
```

说明：

- `inputPath` 是原始数据文件路径
- `format` 支持 `json`、`ndjson`、`csv`
- `listPath` 用来从复杂 JSON 里找到真正的数组，比如 `data.items`

## 5. 用 API 导入

如果你以后想做后台管理页面，或者希望别的系统调用，也可以直接走 HTTP API。

### 5.1 获取模板

```bash
curl -s http://localhost:3000/api/import/template
```

### 5.2 预览导入

```bash
curl -X POST http://localhost:3000/api/import/preview \
  -H "Content-Type: application/json" \
  -d @./imports/example-national-museum.json
```

### 5.3 正式导入

```bash
curl -X POST http://localhost:3000/api/import/run \
  -H "Content-Type: application/json" \
  -d @./imports/example-national-museum.json
```

### 5.4 查询导入后的文物

```bash
curl -s "http://localhost:3000/api/artifacts?source=imported"
```

响应 JSON 中含 `artifacts` 及 `source`、`total` 等字段。

### 5.5 查询博物馆统计

```bash
curl -s "http://localhost:3000/api/museums?source=imported"
```

## 6. 这套后端适合你怎么导“全国各个博物馆”的数据

建议你按“一个博物馆一个任务文件”的方式导入：

1. 先准备一个博物馆的原始 JSON 或 CSV
2. 新建一个对应的任务文件，比如：
   `imports/gugong-job.json`
3. 配好这个博物馆的字段映射
4. 跑：
   ```bash
   npm run import:artifacts -- ./imports/gugong-job.json
   ```
5. 再继续下一个博物馆

这样做的好处是：

- 每个馆的字段差异可以单独处理
- 后面更新某个馆的数据时，只重跑这个馆的任务即可
- `mode: "replace-museum"` 可以避免同馆数据重复

## 7. 数据保存在哪里

当前导入只写本地文件，文物数据保存在 `data/imported-artifacts.json`。这样最适合本地开发、展示和调试，不需要额外配置云服务。

## 8. 常用命令

```bash
npm run dev
npm run lint
npm run build
npm run import:artifacts -- ./imports/example-national-museum.json
```
