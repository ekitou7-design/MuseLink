export type SidebarFeatureId = "news" | "knowledge" | "help" | "copyright" | "about";

export type ExhibitionBrief = {
  id: string;
  title: string;
  venue: string;
  time: string;
  intro: string;
  tags: string[];
  highlights: string[];
};

export type KnowledgeEntry = {
  id: string;
  title: string;
  category: string;
  summary: string;
  detail: string;
  examples: string[];
};

export type DynastyNode = {
  name: string;
  range: string;
  note: string;
};

export type CurationTemplate = {
  id: string;
  title: string;
  description: string;
  sections: string[];
};

export type HelpBlock = {
  title: string;
  body: string;
  steps: string[];
};

export type FaqItem = {
  question: string;
  answer: string;
};

export const sidebarFeatureMeta: Record<SidebarFeatureId, { title: string; subtitle: string }> = {
  news: {
    title: "文博资讯与线下展览",
    subtitle: "近期展讯、馆方动态与可转化为策展灵感的主题线索",
  },
  knowledge: {
    title: "文博知识库",
    subtitle: "分类、术语、朝代与策展模板的随身参考",
  },
  help: {
    title: "使用帮助与反馈",
    subtitle: "快速了解 MuseLink 工作流，并把问题反馈给项目组",
  },
  copyright: {
    title: "来源公示与版权声明",
    subtitle: "数据、图片、授权边界与使用限制说明",
  },
  about: {
    title: "关于我们",
    subtitle: "项目目标、核心能力、技术栈与联系方式",
  },
};

export const exhibitionBriefs: ExhibitionBrief[] = [
  {
    id: "calligraphy-landscape",
    title: "山水之间：宋元书画中的观看方式",
    venue: "中国国家博物馆",
    time: "2026.04.18 - 2026.08.25",
    intro: "以山水画、题跋、印章和文人交游为线索，展示宋元书画如何从图像、诗文和收藏史共同构成一种可阅读的文化空间。",
    tags: ["书画", "宋元", "文人生活"],
    highlights: ["适合生成“文人雅集”主题展", "可关联山水、题跋、印章等文物标签"],
  },
  {
    id: "bronze-ritual",
    title: "礼器与王权：青铜器的制度记忆",
    venue: "陕西历史博物馆",
    time: "2026.05.01 - 2026.10.12",
    intro: "从鼎、簋、爵、尊等器类切入，梳理青铜器在礼仪、铭文、族属和权力表达中的多重含义。",
    tags: ["青铜器", "考古发现", "礼制"],
    highlights: ["适合生成“青铜时代”主题展", "可扩展为器型识别和铭文导览"],
  },
  {
    id: "digital-caves",
    title: "重返石窟：数字技术与丝路图像",
    venue: "敦煌研究院数字展厅",
    time: "2026.03.12 - 2026.12.31",
    intro: "通过高清采集、三维重建和沉浸式影像呈现壁画、彩塑与洞窟空间，让不可移动文物在数字环境中被重新观看。",
    tags: ["数字展览", "丝绸之路", "壁画"],
    highlights: ["适合生成“丝路图像”主题展", "可用于解释数字保护与虚拟展陈"],
  },
  {
    id: "jade-belief",
    title: "玉见礼仪：史前玉器与信仰世界",
    venue: "良渚博物院",
    time: "2026.06.08 - 2026.09.20",
    intro: "围绕玉琮、玉璧、玉钺等器物，讨论史前社会的身份秩序、祭祀观念与工艺技术。",
    tags: ["玉器", "史前文明", "考古发现"],
    highlights: ["适合生成“早期中国”主题展", "可连接良渚、红山等区域文化"],
  },
];

export const knowledgeEntries: KnowledgeEntry[] = [
  {
    id: "bronze",
    title: "青铜器",
    category: "文物分类知识",
    summary: "以铜、锡、铅等合金铸造的礼器、兵器、乐器和生活器具。",
    detail: "青铜器常见于商周礼制系统，也延续到秦汉及以后。理解青铜器时，可以从器型、纹饰、铭文、铸造工艺和出土语境入手。鼎、簋、爵、尊、卣等器类分别承担饮食、祭祀、宴飨和身份表达功能。",
    examples: ["后母戊鼎", "四羊方尊", "大盂鼎"],
  },
  {
    id: "ceramic",
    title: "陶瓷",
    category: "文物分类知识",
    summary: "陶器和瓷器的合称，是观察技术、贸易与日常生活的重要材料。",
    detail: "陶器多以黏土烧成，瓷器则强调瓷土、釉面和高温烧造。陶瓷知识可从胎、釉、器型、窑口、装饰技法和流通区域展开。青瓷、白瓷、青花、斗彩等都可作为策展主题。",
    examples: ["越窑青瓷", "定窑白瓷", "景德镇青花瓷"],
  },
  {
    id: "jade",
    title: "玉器",
    category: "文物分类知识",
    summary: "以玉材制成的礼仪、佩饰、陈设和信仰器物。",
    detail: "玉器在中国古代常与身份、德性、祭祀和审美相关。史前玉器重视形制与神人兽面纹，汉代以后礼仪与佩饰功能并行。解读玉器时需关注材质、沁色、磨制工艺和使用痕迹。",
    examples: ["玉琮", "玉璧", "金缕玉衣"],
  },
  {
    id: "calligraphy-painting",
    title: "书画",
    category: "文物分类知识",
    summary: "以笔墨、纸绢、题跋和收藏印构成的图像与文字系统。",
    detail: "书画不只看画面，也看装裱、题跋、钤印和递藏关系。山水、花鸟、人物、法书等门类可以呈现时代审美、文人社群和艺术史流变。",
    examples: ["清明上河图", "兰亭序摹本", "富春山居图"],
  },
  {
    id: "bamboo-slip",
    title: "简牍",
    category: "文物分类知识",
    summary: "写在竹片、木片上的古代文书，是制度史和日常行政的重要证据。",
    detail: "简牍常见内容包括律令、簿籍、书信、医方和日常记录。它们把宏大的历史落到具体的人、地点、日期和行政流程中，适合做“古代信息系统”类策展。",
    examples: ["里耶秦简", "居延汉简", "清华简"],
  },
  {
    id: "textile",
    title: "纺织品",
    category: "文物分类知识",
    summary: "包括丝织、棉麻、刺绣和服饰遗存，承载工艺、贸易与身体文化。",
    detail: "纺织品保存条件苛刻，出土材料尤其珍贵。可从织造结构、纹样、染色技术、服饰制度和丝绸之路交流角度理解。",
    examples: ["素纱襌衣", "织锦护臂", "刺绣经袱"],
  },
  {
    id: "provenance",
    title: "递藏",
    category: "基础术语解释",
    summary: "一件文物从制作、使用、收藏到入藏机构的流转历史。",
    detail: "递藏信息有助于判断文物真伪、理解收藏趣味和文化传播路径。书画作品的题跋、印章和著录往往是递藏研究的重要证据。",
    examples: ["收藏印", "著录文献", "入藏记录"],
  },
  {
    id: "excavated-context",
    title: "出土语境",
    category: "基础术语解释",
    summary: "文物被发现时的墓葬、遗址、地层和共伴关系。",
    detail: "出土语境能帮助解释器物年代、功能和社会关系。脱离语境的器物只能看到造型，回到语境才能看到制度与生活。",
    examples: ["地层关系", "墓葬组合", "遗址单位"],
  },
];

export const dynastyTimeline: DynastyNode[] = [
  { name: "夏商周", range: "约前2070 - 前256", note: "青铜礼制、甲骨文与早期国家形成。" },
  { name: "秦汉", range: "前221 - 220", note: "统一制度、简牍文书、画像石与丝路交流。" },
  { name: "魏晋南北朝", range: "220 - 589", note: "佛教艺术兴盛，书法风格与士人文化转型。" },
  { name: "隋唐五代", range: "581 - 960", note: "开放交流、金银器、唐三彩与壁画墓繁荣。" },
  { name: "宋元", range: "960 - 1368", note: "文人书画、城市生活、瓷业与海上贸易发展。" },
  { name: "明清", range: "1368 - 1912", note: "宫廷收藏、工艺体系成熟，地方文化与全球贸易交织。" },
];

export const curationTemplates: CurationTemplate[] = [
  {
    id: "material-to-meaning",
    title: "从材料到意义",
    description: "适合陶瓷、玉器、金属器等材料线索清晰的展览。",
    sections: ["材料来源", "工艺过程", "使用场景", "审美与象征"],
  },
  {
    id: "one-object-many-lives",
    title: "一件文物的多重生命",
    description: "适合从制作、使用、流转、入藏到数字化展示讲述单件精品。",
    sections: ["诞生", "使用", "流转", "今天的观看"],
  },
  {
    id: "city-and-memory",
    title: "城市与记忆",
    description: "适合把文物、地图、建筑与日常生活组织成地方文化展。",
    sections: ["城市空间", "人的生活", "贸易与交流", "当代回望"],
  },
];

export const helpBlocks: HelpBlock[] = [
  {
    title: "MuseLink 怎么用",
    body: "MuseLink 把文物浏览、收藏、个人展陈和 AI 策展放在同一个移动端体验里。你可以先浏览馆藏，再把喜欢的文物加入收藏，最后用收藏或关键词生成展览。",
    steps: ["在首页浏览推荐、博物馆和朝代分类", "使用顶部搜索查找文物或展览", "进入个人中心查看收藏与展陈"],
  },
  {
    title: "如何生成展览",
    body: "点击底部或页面中的 AI 策展入口，输入主题、旅行记忆或想看的文物类型，系统会从本地文物库中选择候选文物并生成展览结构。",
    steps: ["打开 AI 智能策展", "输入主题关键词", "回答引导问题", "生成后收藏到我的展陈"],
  },
  {
    title: "如何收藏文物",
    body: "文物卡片和详情页里的收藏按钮会把文物保存到你的账号或本地访客数据。登录后可以同步收藏。",
    steps: ["打开文物详情", "点击收藏按钮", "在个人中心的收藏页查看"],
  },
  {
    title: "如何查看文物详情",
    body: "点击文物卡片即可进入详情页，详情页会展示图片、年代、馆藏机构、简介和可用于策展的知识字段。",
    steps: ["进入馆藏全览或搜索结果", "点击任意文物卡片", "向下阅读详细说明和相关信息"],
  },
];

export const faqItems: FaqItem[] = [
  {
    question: "为什么有些图片显示为占位图？",
    answer: "部分文物数据暂未取得稳定图片地址，MuseLink 会使用安全占位图保证页面可用。可在通用设置里关闭或开启图片 fallback。",
  },
  {
    question: "AI 策展结果可以直接商用吗？",
    answer: "不可以。当前数据和生成内容仅用于学习、展示和 Demo，不代表馆方正式授权或学术定稿。",
  },
  {
    question: "收藏后换设备还能看到吗？",
    answer: "登录状态下的收藏会优先同步到后端；游客状态下会保存在当前浏览器的 localStorage。",
  },
];

export const copyrightStatements = [
  "MuseLink 当前文物数据来自公开目录、馆方公开页面、项目导入数据与团队整理的演示数据。",
  "图片来源以原始页面或公开资源说明为准；项目内展示仅用于学习、课程展示、产品原型和 AI 策展 Demo。",
  "未经权利方许可，禁止将 MuseLink 中的图片、文字整理结果或 AI 生成展览用于商业发布、售卖、广告或授权转售。",
  "若权利方认为项目内容涉及侵权，请联系项目组核实后删除或更正。",
];

export const sourceList = [
  "博物馆官网与公开馆藏页面",
  "国家文物局公开目录与禁止出境展览文物相关公开资料",
  "Wikimedia Commons 等公开版权资源",
  "团队导入、清洗和 AI-ready 处理后的本地演示数据",
];

export const aboutMuseLink = {
  what: "MuseLink 是一个基于 AI 的参与式数字文博平台原型，目标是让普通用户从“看文物”进一步走向“理解文物、组织文物、讲述展览”。",
  goal: "项目希望把分散的文物数据、个人兴趣和策展表达连接起来，降低数字展陈创作门槛，同时保留来源公示和版权边界意识。",
  features: ["馆藏全览与搜索", "文物详情与收藏", "AI 智能策展", "个人展陈管理", "文博知识与帮助中心"],
  team: ["产品与交互：MuseLink 项目组", "数据整理：知识库与导入脚本协作", "AI 策展：本地文物库检索与生成式文本组织"],
  techStack: ["React 19", "TypeScript", "Vite", "Tailwind CSS", "Express / Node.js", "localStorage + 本地 JSON 演示数据"],
  version: "1.2.4",
  contact: "muselink-demo@example.com",
};
