import type { CuratorTI } from '../../../types';

export type CuratorGuideOption = {
  id: string;
  label: string;
  value: string;
  dimension?: 'source' | 'expression' | 'audience' | 'collaboration';
  code?: string;
};

export type CuratorGuideQuestion = {
  id: string;
  title: string;
  prompt: string;
  options: CuratorGuideOption[];
};

export type CuratorGuideAnswers = Record<string, string>;

export const CURATOR_GUIDE_QUESTIONS: CuratorGuideQuestion[] = [
  {
    id: 'source',
    title: 'Q1',
    prompt: '你最想围绕什么来策划展览？',
    options: [
      { id: 'object', label: '一件具体的文物、非遗技艺或老物件', value: '围绕具体器物或技艺展开', dimension: 'source', code: 'O' },
      { id: 'place', label: '一个地方', value: '围绕地方记忆、旅行城市或向往之地展开', dimension: 'source', code: 'P' },
      { id: 'theme', label: '一个文化主题', value: '围绕茶、科举、山水画、节日等文化主题展开', dimension: 'source', code: 'T' },
      { id: 'person', label: '一个人物', value: '围绕历史名人、家族长辈或手艺人展开', dimension: 'source', code: 'H' },
    ],
  },
  {
    id: 'expression',
    title: 'Q2',
    prompt: '你希望展览传递什么感觉？',
    options: [
      { id: 'knowledge', label: '知识干货，有深度讲解', value: '知识干货，有深度讲解', dimension: 'expression', code: 'K' },
      { id: 'story', label: '故事性强，像在逛故事会', value: '故事性强，像在逛故事会', dimension: 'expression', code: 'S' },
      { id: 'visual', label: '视觉唯美，适合打卡分享', value: '视觉唯美，适合打卡分享', dimension: 'expression', code: 'V' },
      { id: 'fun', label: '轻松有趣，有梗有互动', value: '轻松有趣，有梗有互动', dimension: 'expression', code: 'F' },
    ],
  },
  {
    id: 'audience',
    title: 'Q3',
    prompt: '这个展览主要是给谁看的？',
    options: [
      { id: 'memory', label: '自己收藏，留作纪念', value: '主要给自己收藏留念', dimension: 'audience', code: 'M' },
      { id: 'friends', label: '分享给朋友或朋友圈', value: '适合分享给朋友或朋友圈', dimension: 'audience', code: 'C' },
      { id: 'square', label: '发布到展览广场，等大家来评', value: '准备发布到展览广场接受评价', dimension: 'audience', code: 'G' },
      { id: 'learning', label: '用作学习、教学或作业展示', value: '用于学习、教学或作业展示', dimension: 'audience', code: 'L' },
    ],
  },
  {
    id: 'collaboration',
    title: 'Q4',
    prompt: '你希望 AI 帮你完成哪部分工作？',
    options: [
      { id: 'auto', label: '帮我选展品、排顺序、写文案，我直接发布', value: '希望 AI 完成选品、排序和文案，可直接发布', dimension: 'collaboration', code: 'A' },
      { id: 'edit', label: '给我初稿，我来改故事线和细节', value: '希望 AI 给出初稿，自己再调整故事线和细节', dimension: 'collaboration', code: 'E' },
      { id: 'research', label: '只提供资料和灵感，我自己从头策划', value: '希望 AI 只提供资料和灵感，自己主导策划', dimension: 'collaboration', code: 'R' },
    ],
  },
  {
    id: 'navigation',
    title: 'Q5',
    prompt: '你想让观众以什么形式浏览？',
    options: [
      { id: 'timeline', label: '按时间顺序，像走进房间一样看', value: '浏览方式按时间顺序推进，像走进房间一样完整观看' },
      { id: 'theme', label: '按主题分类看', value: '浏览方式按主题分类组织' },
      { id: 'free', label: '自由探索', value: '浏览方式允许自由探索和跳转' },
    ],
  },
  {
    id: 'tone',
    title: 'Q6',
    prompt: '你希望展览的文字是什么风格？',
    options: [
      { id: 'warm', label: '温柔感性', value: '文字风格温柔感性' },
      { id: 'formal', label: '正式专业', value: '文字风格正式专业' },
      { id: 'humor', label: '轻松幽默', value: '文字风格轻松幽默' },
    ],
  },
  {
    id: 'length',
    title: 'Q7',
    prompt: '每件展品旁边需要多少说明？',
    options: [
      { id: 'short', label: '简短说明', value: '每件展品说明尽量简短' },
      { id: 'detailed', label: '详细介绍', value: '每件展品需要较详细介绍' },
      { id: 'adaptive', label: '视具体展品而定', value: '说明长短视具体展品而定' },
    ],
  },
  {
    id: 'publish',
    title: 'Q8',
    prompt: '这个展览准备怎么发布？',
    options: [
      { id: 'private', label: '只保存，不公开', value: '发布方式为只保存不公开' },
      { id: 'limited', label: '只发给指定的人看', value: '发布方式为只发给指定的人看' },
      { id: 'public', label: '公开发布', value: '发布方式为公开发布' },
    ],
  },
  {
    id: 'storyPreference',
    title: 'Q9',
    prompt: '你更被哪种故事打动？',
    options: [
      { id: 'complete', label: '有清晰开头、发展、高潮、结尾的完整叙事', value: '偏好完整叙事结构' },
      { id: 'fragment', label: '片段式的画面、几句对白或一种氛围，靠想象拼出属于自己的故事', value: '偏好片段式氛围和留白' },
    ],
  },
  {
    id: 'visitPath',
    title: 'Q10',
    prompt: '参观一个线上展厅，你希望怎么“走”？',
    options: [
      { id: 'guided', label: '沿着推荐路线，像有人引导一样完整逛完', value: '希望沿推荐路线完整参观' },
      { id: 'jump', label: '自己到处点、到处逛，随时跳转，不按常理出牌', value: '希望自由点击和随时跳转' },
    ],
  },
  {
    id: 'digitalImpression',
    title: 'Q11',
    prompt: '一个令你印象深刻的数字展览，最可能是因为？',
    options: [
      { id: 'emotion', label: '它传递了一段很真诚的情感或思考，让你久久回味', value: '重视真诚情感和思考余韵' },
      { id: 'interaction', label: '它的视觉、动效或交互方式太酷了，让你想截图分享', value: '重视视觉、动效和交互惊喜' },
    ],
  },
  {
    id: 'takeaway',
    title: 'Q12',
    prompt: '你希望观众离开你的线上展览时，带走什么？',
    options: [
      { id: 'understood', label: '一种被理解的感觉，或一个新的思考角度', value: '希望观众带走被理解的感觉或新思考' },
      { id: 'aesthetic', label: '一种强烈的审美愉悦，或“原来还能这样玩”的惊喜', value: '希望观众带走审美愉悦或玩法惊喜' },
    ],
  },
  {
    id: 'artifactCuriosity',
    title: 'Q13',
    prompt: '看到一件陌生的文物，你首先会好奇？',
    options: [
      { id: 'owner', label: '它曾经的主人是谁？有过怎样的故事？', value: '优先关注文物主人和背后的故事' },
      { id: 'context', label: '它的年代、材质、工艺和出土背景？', value: '优先关注年代、材质、工艺和出土背景' },
    ],
  },
  {
    id: 'titleStyle',
    title: 'Q14',
    prompt: '你更喜欢哪种展览标题？',
    options: [
      { id: 'academic', label: '唐代金银器：工艺与文化研究', value: '偏好清晰、正式、研究型标题' },
      { id: 'poetic', label: '流光溢彩：唐代贵族的奢华生活', value: '偏好有画面感、故事感的标题' },
    ],
  },
  {
    id: 'remixAttitude',
    title: 'Q15',
    prompt: '如果有人想改编或二次创作你的展览，你会觉得：',
    options: [
      { id: 'protect', label: '有点担心，怕偏离原本的表达', value: '重视原表达的准确性和完整性' },
      { id: 'cocreate', label: '很有趣，这才是文化共创的意义', value: '欢迎文化共创和二次创作' },
    ],
  },
  {
    id: 'experience',
    title: 'Q16',
    prompt: '你的策展经验属于哪个阶段？',
    options: [
      { id: 'beginner', label: '刚入门（只做过课程作业或脑海中的想法）', value: '策展经验刚入门' },
      { id: 'intermediate', label: '有一定经验（独立策划过 1-2 个小展览）', value: '已有一定策展经验' },
      { id: 'mature', label: '成熟策展人（策划过多个正式展览，有落地案例）', value: '成熟策展人，有正式落地经验' },
    ],
  },
  {
    id: 'painPoint',
    title: 'Q17',
    prompt: '当前最困扰你的策展环节是？',
    options: [
      { id: 'theme', label: '找不到独特主题，缺乏灵感', value: '困扰在主题灵感' },
      { id: 'selection', label: '不知道怎么挑选作品或艺术家', value: '困扰在作品或艺术家选择' },
      { id: 'space', label: '空间布局、动线、灯光等设计问题', value: '困扰在空间布局、动线和灯光' },
      { id: 'budget', label: '预算有限，不知道如何低成本完成', value: '困扰在预算和低成本实现' },
      { id: 'audience', label: '担心观众看不懂、不互动，传播效果差', value: '困扰在观众理解、互动和传播' },
    ],
  },
  {
    id: 'mustHave',
    title: 'Q18',
    prompt: '这个展览里有没有你一定想保留或一定不想出现的内容？',
    options: [
      { id: 'must', label: '必须出现的展品、人物、地点、关键词', value: '有必须保留的内容' },
      { id: 'avoid', label: '不想出现的表达、风格、敏感点或误区', value: '有需要避免的内容' },
    ],
  },
  {
    id: 'interactionDesign',
    title: 'Q19',
    prompt: '你希望观众在展览里怎么参与？',
    options: [
      { id: 'quiet', label: '安静阅读和欣赏，不需要太多打扰', value: '偏好安静阅读欣赏' },
      { id: 'choice', label: '通过选择、投票、评论或任务参与进来', value: '希望加入选择、投票、评论或任务' },
      { id: 'share', label: '能生成海报、路线或一句话感想用于分享', value: '希望支持分享型互动' },
    ],
  },
  {
    id: 'visualMood',
    title: 'Q20',
    prompt: '你想象中的展厅画面更接近哪种氛围？',
    options: [
      { id: 'quiet', label: '安静、留白、像博物馆夜游', value: '视觉氛围安静留白' },
      { id: 'warm', label: '温暖、生活化、像走进一段记忆', value: '视觉氛围温暖生活化' },
      { id: 'dramatic', label: '强烈、戏剧化、像舞台或电影场景', value: '视觉氛围强烈戏剧化' },
      { id: 'fresh', label: '轻盈、年轻、适合社交媒体传播', value: '视觉氛围轻盈年轻' },
    ],
  },
];

export const CONTENT_CURATION_QUESTIONS: CuratorGuideQuestion[] = [
  {
    id: 'contentFocus',
    title: 'Q1',
    prompt: '这次展览最想围绕什么内容展开？',
    options: [
      { id: 'artifact', label: '一件文物、非遗技艺或老物件', value: '围绕具体文物、非遗技艺或老物件展开' },
      { id: 'place', label: '一个地方、家乡、城市或旅行记忆', value: '围绕地方、家乡、城市或旅行记忆展开' },
      { id: 'theme', label: '一个文化主题，如茶、节日、山水、科举', value: '围绕文化主题展开' },
      { id: 'person', label: '一个人物、家族长辈、手艺人或历史名人', value: '围绕人物展开' },
    ],
  },
  {
    id: 'coreObject',
    title: 'Q2',
    prompt: '有没有一个最想放进展览的核心展品、技艺、地点或人物？',
    options: [
      { id: 'name', label: '名称或关键词', value: '有明确名称或关键词' },
      { id: 'memory', label: '和它有关的一段记忆', value: '有相关记忆' },
      { id: 'image', label: '脑海里的一幅画面', value: '有画面感线索' },
      { id: 'unknown', label: '还不确定，想让 AI 帮我找线索', value: '需要 AI 帮助寻找线索' },
    ],
  },
  {
    id: 'attractiveDetail',
    title: 'Q3',
    prompt: '这个内容最吸引你的细节是什么？',
    options: [
      { id: 'craft', label: '造型、材质、纹样、工艺', value: '关注造型材质纹样工艺' },
      { id: 'life', label: '使用痕迹、生活场景、人的手感', value: '关注生活痕迹和使用场景' },
      { id: 'journey', label: '流传经历、出土背景、收藏故事', value: '关注流传出土收藏故事' },
      { id: 'symbol', label: '象征意义、信仰、礼制或审美', value: '关注象征意义和文化秩序' },
    ],
  },
  {
    id: 'timePlace',
    title: 'Q4',
    prompt: '你希望展览发生在哪个时代、地域或文化场景里？',
    options: [
      { id: 'era', label: '某个朝代或历史阶段', value: '有明确时代范围' },
      { id: 'region', label: '某个地域、城市、乡土或路线', value: '有明确地域范围' },
      { id: 'daily', label: '日常生活、节庆、书房、庭院、集市等场景', value: '有具体生活场景' },
      { id: 'cross', label: '跨时代或跨地域的比较', value: '希望跨时代或跨地域比较' },
    ],
  },
  {
    id: 'centralQuestion',
    title: 'Q5',
    prompt: '你想让这个展览回答一个什么核心问题？',
    options: [
      { id: 'why', label: '为什么这种文化会形成？', value: '追问文化形成原因' },
      { id: 'how', label: '古人如何生活、制作、观看或使用？', value: '追问古人的生活制作观看使用方式' },
      { id: 'change', label: '它如何从过去走到今天？', value: '追问历史变化和当代延续' },
      { id: 'meaning', label: '它今天还能给我们什么启发？', value: '追问当代意义' },
    ],
  },
  {
    id: 'storyLine',
    title: 'Q6',
    prompt: '你希望展览的故事线围绕哪种关系展开？',
    options: [
      { id: 'humanObject', label: '人与物', value: '围绕人与物的关系展开' },
      { id: 'placeMemory', label: '地方与记忆', value: '围绕地方与记忆展开' },
      { id: 'craftAesthetic', label: '技术与审美', value: '围绕技术与审美展开' },
      { id: 'dailyRitual', label: '日常与礼制', value: '围绕日常与礼制展开' },
      { id: 'traditionNow', label: '传统与当代', value: '围绕传统与当代展开' },
    ],
  },
  {
    id: 'openingScene',
    title: 'Q7',
    prompt: '你想用什么画面或展品作为开场？',
    options: [
      { id: 'single', label: '一件最有冲击力的展品', value: '用关键展品开场' },
      { id: 'scene', label: '一个生活现场或历史瞬间', value: '用场景开场' },
      { id: 'question', label: '一个疑问或悬念', value: '用问题开场' },
      { id: 'emotion', label: '一种情绪或气味、声音、光线', value: '用感官氛围开场' },
    ],
  },
  {
    id: 'endingPoint',
    title: 'Q8',
    prompt: '你希望展览最后落到哪里？',
    options: [
      { id: 'reflection', label: '一个值得回味的问题', value: '结尾落到思考问题' },
      { id: 'today', label: '和今天生活的连接', value: '结尾连接当代生活' },
      { id: 'person', label: '回到某个人的命运或选择', value: '结尾回到人物命运' },
      { id: 'object', label: '重新看见开头那件展品', value: '结尾回扣核心展品' },
    ],
  },
  {
    id: 'mustInclude',
    title: 'Q9',
    prompt: '有哪些内容一定要出现？',
    options: [
      { id: 'artifacts', label: '指定文物、作品、技艺或资料', value: '必须包含指定展品资料' },
      { id: 'people', label: '指定人物、群体或家族故事', value: '必须包含人物群体故事' },
      { id: 'places', label: '指定地点、路线或空间', value: '必须包含地点路线空间' },
      { id: 'keywords', label: '指定关键词、意象或概念', value: '必须包含关键词意象概念' },
    ],
  },
  {
    id: 'avoidContent',
    title: 'Q10',
    prompt: '有哪些内容或表达你不希望出现？',
    options: [
      { id: 'fiction', label: '不要编造没有依据的故事', value: '避免无依据编造' },
      { id: 'stereotype', label: '避免刻板印象或过度猎奇', value: '避免刻板猎奇' },
      { id: 'dry', label: '不要只有资料堆砌', value: '避免资料堆砌' },
      { id: 'sensitive', label: '避开敏感人物、地点或表述', value: '避开敏感内容' },
    ],
  },
  {
    id: 'knowledgeFocus',
    title: 'Q11',
    prompt: '你最想让观众理解哪些知识或事实？',
    options: [
      { id: 'craft', label: '工艺、材质、结构、制作流程', value: '重点讲工艺材质结构制作' },
      { id: 'history', label: '年代、制度、历史背景', value: '重点讲历史制度背景' },
      { id: 'life', label: '生活方式、使用方法、社会关系', value: '重点讲生活方式和社会关系' },
      { id: 'symbol', label: '纹样、符号、信仰、审美观念', value: '重点讲符号信仰审美' },
    ],
  },
  {
    id: 'emotionFocus',
    title: 'Q12',
    prompt: '你希望这组内容带出什么情绪或思考？',
    options: [
      { id: 'warm', label: '亲近、温暖、被理解', value: '希望带出温暖亲近' },
      { id: 'wonder', label: '惊叹、好奇、想继续探索', value: '希望带出惊叹好奇' },
      { id: 'nostalgia', label: '怀旧、乡愁、时间流逝', value: '希望带出怀旧乡愁' },
      { id: 'critical', label: '反思、追问、重新理解传统', value: '希望带出反思追问' },
    ],
  },
  {
    id: 'contrast',
    title: 'Q13',
    prompt: '你想在展览里呈现哪些对比或转折？',
    options: [
      { id: 'oldNew', label: '古代与今天', value: '呈现古今对比' },
      { id: 'eliteDaily', label: '宫廷/精英与日常生活', value: '呈现精英与日常对比' },
      { id: 'localGlobal', label: '地方传统与外来影响', value: '呈现本土与外来对比' },
      { id: 'visibleHidden', label: '表面的美与背后的技术/权力/劳动', value: '呈现表层与深层对比' },
    ],
  },
  {
    id: 'artifactConnections',
    title: 'Q14',
    prompt: '你希望展品之间靠什么线索连接？',
    options: [
      { id: 'time', label: '时间演变', value: '按时间演变连接' },
      { id: 'material', label: '材质、工艺或造型', value: '按材质工艺造型连接' },
      { id: 'scene', label: '生活场景或使用方式', value: '按场景使用方式连接' },
      { id: 'symbol', label: '意象、纹样、主题隐喻', value: '按意象纹样隐喻连接' },
    ],
  },
  {
    id: 'personalMemory',
    title: 'Q15',
    prompt: '这次展览是否想加入你的个人记忆或现实经验？',
    options: [
      { id: 'family', label: '家族、长辈、童年或家乡记忆', value: '加入家族童年家乡记忆' },
      { id: 'travel', label: '旅行、城市漫游或看展经历', value: '加入旅行城市看展经历' },
      { id: 'study', label: '课程、阅读、研究或创作经历', value: '加入学习研究创作经历' },
      { id: 'none', label: '不加入个人经历，只讲文化内容', value: '不加入个人经历' },
    ],
  },
  {
    id: 'unknownAngle',
    title: 'Q16',
    prompt: '你想挖掘一个什么冷门角度或容易被忽略的细节？',
    options: [
      { id: 'minorPeople', label: '小人物、无名工匠、普通使用者', value: '关注小人物和无名工匠' },
      { id: 'backside', label: '背面、底部、残缺、修补痕迹', value: '关注背面残缺修补痕迹' },
      { id: 'process', label: '制作失败、运输、保存、修复过程', value: '关注制作运输保存修复过程' },
      { id: 'misread', label: '常见误读、被忽略的真实用途', value: '关注误读和真实用途' },
    ],
  },
  {
    id: 'keywords',
    title: 'Q17',
    prompt: '如果只能给这个展览留下 3-5 个关键词，你会写什么？',
    options: [
      { id: 'objects', label: '器物类关键词', value: '器物关键词' },
      { id: 'emotions', label: '情绪类关键词', value: '情绪关键词' },
      { id: 'places', label: '地方类关键词', value: '地方关键词' },
      { id: 'ideas', label: '观念类关键词', value: '观念关键词' },
    ],
  },
  {
    id: 'materialsReady',
    title: 'Q18',
    prompt: '你现在已经掌握了哪些可用内容线索？',
    options: [
      { id: 'names', label: '展品名称或图片', value: '已有展品名称图片' },
      { id: 'texts', label: '文字资料、笔记、网页、论文', value: '已有文字资料' },
      { id: 'memories', label: '口述故事、个人记忆、访谈线索', value: '已有口述记忆访谈' },
      { id: 'none', label: '暂时没有，需要 AI 从文物库里找', value: '暂无资料需要 AI 检索' },
    ],
  },
];

const dimensionOrder = ['source', 'expression', 'audience', 'collaboration'] as const;

const tiTitles: Record<string, string> = {
  O: '器物线索型',
  P: '地方记忆型',
  T: '主题研究型',
  H: '人物叙事型',
  K: '知识讲解派',
  S: '故事编织派',
  V: '视觉策场派',
  F: '趣味互动派',
  M: '私人收藏向',
  C: '社交分享向',
  G: '广场共评向',
  L: '学习展示向',
  A: 'AI 托管型',
  E: '共创编辑型',
  R: '自主研究型',
};

export function selectedGuideOptions(answers: CuratorGuideAnswers) {
  return CURATOR_GUIDE_QUESTIONS.flatMap((question) => {
    const option = question.options.find((item) => item.id === answers[question.id]);
    return option ? [{ question, option }] : [];
  });
}

export function buildGuidePrompt(keywords: string, answers: CuratorGuideAnswers) {
  const selections = selectedGuideOptions(answers);
  const base = keywords.trim();
  const preferenceText = selections
    .map(({ question, option }) => `${question.prompt}${option.value}`)
    .join('；');

  if (!preferenceText) return base;
  return [
    base || '请根据我的策展偏好生成一个展览',
    `用户策展偏好：${preferenceText}。`,
    '请将这些偏好体现在展览主题、展品排序、叙事结构、文字风格和发布建议中。',
  ].join('\n');
}

export function calculateCuratorTI(answers: CuratorGuideAnswers): CuratorTI | null {
  const selections = selectedGuideOptions(answers);
  if (selections.length === 0) return null;

  const code = dimensionOrder
    .map((dimension) => selections.find(({ option }) => option.dimension === dimension)?.option.code)
    .filter(Boolean)
    .join('');

  if (!code) return null;

  const title = code
    .split('')
    .map((letter) => tiTitles[letter] || letter)
    .join(' / ');

  const description = selections
    .slice(0, 4)
    .map(({ option }) => option.value)
    .join('；');

  return {
    code,
    title,
    description,
    answers,
    updatedAt: new Date().toISOString(),
  };
}
