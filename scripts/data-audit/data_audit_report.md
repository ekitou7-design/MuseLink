# MuseLink 数据盘点报告

生成时间：2026-05-20T14:21:41.395Z

## 1. 数据源与数据库结构

本次脚本只读本地项目数据，不修改数据库、不删除数据、不创建表。

- PostgreSQL schema：`backend/api/db/schema.sql`
- 当前盘点文物数据：`data/imported-artifacts.json`
- 当前主应用博物馆数据：`data/imported-museums.json`
- 收藏数据：`data/user-data.json`
- 展览数据：`data/exhibitions.json`

### 1.1 Schema 表

| 表名 |主要字段 |
| --- | --- |
| users | id, user_number, password_hash, created_at |
| museums | id, name, description, location, image_url, created_at |
| artifacts | id, name, dynasty, museum_id, category, short_intro, description, image_url, source_url, tags, created_at, updated_at |
| artifact_attributes | id, artifact_id, attribute_group, attribute_name, attribute_value, sort_order, created_at, updated_at |
| exhibitions | id, user_id, title, theme, bgm_url, created_at |
| exhibition_items | exhibition_id, artifact_id, order_index, curator_note |
| likes | user_id, target_type, target_id, created_at |

### 1.2 结构说明

- 已存在 `museums` 表。
- 已存在 `artifacts` 文物表；未在 schema 中发现 `relics` 或 `collections` 表。
- `artifacts.museum_id` 外键关联 `museums.id`，是 PostgreSQL schema 中的正式关联方式。
- 当前 JSON 文物数据仍主要使用 `museum` / `所属博物馆` / 可兼容 `museumName`。
- 标签在 PostgreSQL 中是 `artifacts.tags text[]`，当前还不是独立标签表。
- 收藏在 PostgreSQL 中是 `likes(user_id, target_type, target_id)`；当前主应用 JSON 收藏在 `data/user-data.json.favoritesByUserId`。
- 展览与文物通过 `exhibition_items(exhibition_id, artifact_id)` 关联；JSON 展览中用 `artifactIds` 数组。
- 已有扩展属性表 `artifact_attributes`，可承载不同文物的灵活字段。

索引：`idx_artifacts_museum_id`, `idx_artifacts_dynasty`, `idx_artifact_attributes_artifact_id`, `idx_exhibitions_user_id`, `idx_exhibition_items_exhibition`

枚举类型：`target_type`

## 2. 数据统计

- `data/imported-museums.json` 博物馆记录数：83
- 有文物挂载的博物馆数：1
- 文物总数：92
- 仅有馆名/博物馆壳但没有文物的博物馆数：82
- 收藏用户记录数：4
- 收藏文物记录数：3
- 展览数：4
- 展览引用过的文物 ID 数：18
- 展览引用但当前文物库不存在的 ID 数：3
- 重复文物 ID 数：0

### 2.1 每个博物馆文物数量

完整 CSV 已生成：`scripts/data-audit/museum_artifact_count.csv`

| 博物馆 |文物数 |
| --- | --- |
| 辽宁省博物馆 | 92 |

### 2.2 文物数量最多的博物馆

1. 辽宁省博物馆: 92

### 2.3 只有馆名但没有文物的博物馆

共 82 个。前 30 个：

- 爱辉历史陈列馆
- 安徽省博物馆
- 八路军太行纪念馆
- 北京鲁迅博物馆
- 北京天文馆
- 北京自然博物馆
- 成都杜甫草堂博物馆
- 成都武侯祠博物馆
- 重庆中国三峡博物馆
- 大庆铁人王进喜纪念馆
- 邓小平故居陈列馆
- 东北烈士纪念馆
- 福建博物院
- 古田会议纪念馆
- 固原博物馆
- 故宫博物院
- 广东省博物馆
- 广汉三星堆博物馆
- 广西壮族自治区博物馆
- 汉阳陵博物馆
- 河北省博物馆
- 河南博物院
- 湖北省博物馆
- 湖南省博物馆
- 吉林省自然博物馆
- 江西省博物馆
- 荆州博物馆
- 井冈山革命博物馆
- 抗美援朝纪念馆
- 刘少奇故居纪念馆

### 2.4 没有图片的文物

共 0 条。

- 无

### 2.5 缺少详细介绍的文物

共 92 条。前 30 条：

- 辽-金灰陶罐形扑满
- 民国巴林石印
- 清浮雕瓜瓞天台石印
- 清雕钮天然木根印
- 清浮雕梅花天台石印
- 清豆瓣青田石印
- 清浮雕树石昌化长方石印
- 清螭钮寿山石印
- 清螭钮大田石椭圆印
- 清狮钮青玉印
- 民国浮雕造像巴林石印
- 清寿山石印
- 清内画山水花鸟鼻烟壶
- 清白地贴花鼻烟壶
- 清浮雕人物玛瑙鼻烟壶
- 清内画山水玻璃鼻烟壶
- 清玉鼻烟壶
- 清内画山水清供玻璃鼻烟壶
- 清浮雕盖耳青玉鼻烟壶
- 清白玉鼻烟壶
- 清浮雕猿猴黄玉鼻烟壶
- 现代牙雕鹌鹑黍穗盒
- 现代玉雕巧作子母鸡
- 清督催查验牙印
- 现代贝雕虾蟹掛幅
- 现代贝彫柳蝉掛幅
- 清朱墨
- 元-清地契
- 清按院颁契尾
- 西汉铁器残块

## 3. 字段完整度

完整 CSV 已生成：`scripts/data-audit/artifact_field_completeness.csv`

| 字段 |有值 |为空 |完整率 |
| --- | --- | --- | --- |
| 文物名称 | 92 | 0 | 100.0% |
| 所属博物馆 | 92 | 0 | 100.0% |
| 朝代 | 85 | 7 | 92.4% |
| 类别 | 86 | 6 | 93.5% |
| 等级 | 92 | 0 | 100.0% |
| 材质 | 83 | 9 | 90.2% |
| 尺寸 | 89 | 3 | 96.7% |
| 图片链接 | 92 | 0 | 100.0% |
| 备注 | 91 | 1 | 98.9% |
| 简介 | 0 | 92 | 0.0% |
| 详细介绍 | 0 | 92 | 0.0% |

### 3.1 缺失最严重字段

| 字段 |有值 |为空 |完整率 |
| --- | --- | --- | --- |
| 简介 | 0 | 92 | 0.0% |
| 详细介绍 | 0 | 92 | 0.0% |
| 材质 | 83 | 9 | 90.2% |
| 朝代 | 85 | 7 | 92.4% |
| 类别 | 86 | 6 | 93.5% |
| 尺寸 | 89 | 3 | 96.7% |
| 备注 | 91 | 1 | 98.9% |
| 等级 | 92 | 0 | 100.0% |

### 3.2 原始键层面的不统一信号

以下是“出现过但不是每条都有”的原始键，说明当前导入字段存在批次差异或命名不统一：

| 原始键 |有值 |为空 |完整率 |
| --- | --- | --- | --- |
| 材质 | 83 | 9 | 90.2% |
| material | 83 | 9 | 90.2% |
| 朝代 | 85 | 7 | 92.4% |
| period | 85 | 7 | 92.4% |
| 类别 | 86 | 6 | 93.5% |
| category | 86 | 6 | 93.5% |
| 尺寸 | 89 | 3 | 96.7% |
| dimensions | 89 | 3 | 96.7% |
| 备注 | 91 | 1 | 98.9% |
| remarks | 91 | 1 | 98.9% |

## 4. 当前数据结构问题

1. 当前真实文物集中度很高：有文物挂载的博物馆只有 1 个，而博物馆壳数据有 83 个，说明“博物馆目录”和“文物馆藏数据”尚未同步扩展。
2. 文物字段存在双轨命名：JSON 使用 `museum`、`period`、中文键、旧字段；SQL schema 使用 `museum_id`、`dynasty`、`image_url`。兼容层有效，但长期维护成本偏高。
3. 标签仍偏轻量：当前主要是数组标签，缺少标签类型、标签来源、标签置信度、同义词、层级关系。
4. 介绍类字段状态：仍有 92 条缺少详细介绍，短简介和详细介绍对精品文物、主题策展、推荐解释都很关键。
5. 展览里存在 3 个当前文物库不存在的引用 ID，需要后续做只读核对后再决定是否修复。
6. 当前扩展属性结构已经具备雏形，但历史 JSON 数据仍大量依赖 `material/dimensions/level/remarks` 等旧字段。

## 5. 是否适合长期扩展

- 全球博物馆扩展：基础 schema 可以起步，但还缺少国家/地区、经纬度、官网、数据来源、授权状态、多语言名称等字段。
- 精品文物体系：需要增加精选等级、推荐理由、策展权重、高清图状态、版权/来源字段。
- 主题策展：现有 `tags`、`dynasty`、`category`、`material` 可用于初步筛选，但介绍和结构化标签不足。
- 标签系统：建议从数组升级到独立标签表，支持 `tag_type`、同义词、层级、人工/导入来源。
- 文物关联推荐：当前可基于名称、博物馆、朝代、材质、类别、标签做轻量推荐；若要更稳定，需要补全描述、来源、主题标签和扩展属性。

## 6. 后续建议

优先级建议：

1. 先补数据：优先补 `description` / `shortIntro` / `sourceUrl` / 图片版权来源，收益最高。
2. 再固化数据结构：统一导入后的标准字段，逐步把旧字段同步到 `artifact_attributes`，减少中文键和驼峰/下划线混用。
3. 再做标签体系：建立标签类型和主题标签，支撑精品文物、主题策展和推荐。
4. 最后再改 UI 或做 AI 功能：当前最大瓶颈不是界面，而是数据完整度和结构化程度。

## 7. 本次输出文件

- `scripts/data-audit/data_audit_report.md`
- `scripts/data-audit/museum_artifact_count.csv`
- `scripts/data-audit/artifact_field_completeness.csv`
