export const PROVINCE_OPTIONS = [
  "北京",
  "上海",
  "天津",
  "重庆",
  "河北",
  "山西",
  "辽宁",
  "吉林",
  "黑龙江",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "江西",
  "山东",
  "河南",
  "湖北",
  "湖南",
  "广东",
  "海南",
  "四川",
  "贵州",
  "云南",
  "陕西",
  "甘肃",
  "青海",
  "台湾",
  "内蒙古",
  "广西",
  "西藏",
  "宁夏",
  "新疆",
  "香港",
  "澳门",
  "其他",
  "未填写",
] as const;

export const CITY_OPTIONS_BY_PROVINCE: Record<string, string[]> = {
  北京: ["北京"],
  上海: ["上海"],
  天津: ["天津"],
  重庆: ["重庆"],
  河北: ["石家庄", "唐山", "保定", "邯郸", "秦皇岛", "承德", "张家口", "廊坊", "沧州", "衡水", "邢台"],
  山西: ["太原", "大同", "临汾", "运城", "晋中", "长治", "晋城", "朔州", "忻州", "吕梁", "阳泉"],
  辽宁: ["沈阳", "大连", "鞍山", "抚顺", "锦州", "丹东", "本溪", "营口", "阜新", "辽阳", "盘锦", "铁岭", "朝阳", "葫芦岛"],
  吉林: ["长春", "吉林", "延边", "通化", "四平", "辽源", "白山", "松原", "白城"],
  黑龙江: ["哈尔滨", "齐齐哈尔", "牡丹江", "佳木斯", "大庆", "鸡西", "鹤岗", "双鸭山", "伊春", "七台河", "黑河", "绥化", "大兴安岭"],
  江苏: ["南京", "苏州", "无锡", "常州", "徐州", "扬州", "镇江", "南通", "盐城", "泰州", "淮安", "连云港", "宿迁"],
  浙江: ["杭州", "宁波", "温州", "绍兴", "嘉兴", "湖州", "金华", "台州", "衢州", "舟山", "丽水"],
  安徽: ["合肥", "芜湖", "蚌埠", "安庆", "黄山", "阜阳", "淮南", "马鞍山", "淮北", "铜陵", "滁州", "宿州", "六安", "亳州", "池州", "宣城"],
  福建: ["福州", "厦门", "泉州", "漳州", "莆田", "三明", "南平", "龙岩", "宁德"],
  江西: ["南昌", "九江", "景德镇", "赣州", "上饶", "萍乡", "新余", "鹰潭", "吉安", "宜春", "抚州"],
  山东: ["济南", "青岛", "淄博", "潍坊", "烟台", "曲阜", "临沂", "枣庄", "东营", "济宁", "泰安", "威海", "日照", "德州", "聊城", "滨州", "菏泽"],
  河南: ["郑州", "洛阳", "开封", "安阳", "南阳", "许昌", "平顶山", "鹤壁", "新乡", "焦作", "濮阳", "漯河", "三门峡", "商丘", "信阳", "周口", "驻马店"],
  湖北: ["武汉", "宜昌", "襄阳", "荆州", "十堰", "黄石", "鄂州", "荆门", "孝感", "黄冈", "咸宁", "随州", "恩施"],
  湖南: ["长沙", "株洲", "湘潭", "岳阳", "衡阳", "常德", "邵阳", "张家界", "益阳", "郴州", "永州", "怀化", "娄底", "湘西"],
  广东: ["广州", "深圳", "佛山", "东莞", "珠海", "汕头", "中山", "韶关", "河源", "梅州", "惠州", "汕尾", "江门", "阳江", "湛江", "茂名", "肇庆", "清远", "潮州", "揭阳", "云浮"],
  海南: ["海口", "三亚", "儋州", "三沙"],
  四川: ["成都", "绵阳", "德阳", "乐山", "自贡", "广汉", "攀枝花", "泸州", "遂宁", "内江", "南充", "眉山", "宜宾", "广安", "达州", "雅安", "巴中", "资阳", "阿坝", "甘孜", "凉山"],
  贵州: ["贵阳", "遵义", "安顺", "毕节", "六盘水", "铜仁", "黔西南", "黔东南", "黔南"],
  云南: ["昆明", "大理", "丽江", "曲靖", "玉溪", "保山", "昭通", "普洱", "临沧", "楚雄", "红河", "文山", "西双版纳", "德宏", "怒江", "迪庆"],
  陕西: ["西安", "宝鸡", "咸阳", "渭南", "汉中", "延安", "榆林", "安康", "商洛", "铜川"],
  甘肃: ["兰州", "敦煌", "天水", "武威", "张掖", "嘉峪关", "金昌", "白银", "平凉", "酒泉", "庆阳", "定西", "陇南", "临夏", "甘南"],
  青海: ["西宁", "海东", "海北", "黄南", "海南", "果洛", "玉树", "海西"],
  台湾: ["台北", "台中", "台南", "高雄", "新北", "桃园"],
  内蒙古: ["呼和浩特", "包头", "鄂尔多斯", "赤峰", "呼伦贝尔", "通辽", "乌海", "乌兰察布", "巴彦淖尔", "兴安盟", "锡林郭勒", "阿拉善"],
  广西: ["南宁", "桂林", "柳州", "北海", "梧州", "防城港", "钦州", "贵港", "玉林", "百色", "贺州", "河池", "来宾", "崇左"],
  西藏: ["拉萨", "日喀则", "昌都", "林芝", "山南", "那曲", "阿里"],
  宁夏: ["银川", "吴忠", "固原", "石嘴山", "中卫"],
  新疆: ["乌鲁木齐", "吐鲁番", "喀什", "伊犁", "克拉玛依", "哈密", "昌吉", "博尔塔拉", "巴音郭楞", "阿克苏", "克孜勒苏", "和田", "塔城", "阿勒泰"],
  香港: ["香港"],
  澳门: ["澳门"],
  其他: ["未知地区"],
  未填写: [],
};

export const MUSEUM_TYPE_OPTIONS = [
  "国家级博物馆",
  "省级博物馆",
  "市县级博物馆",
  "高校博物馆",
  "遗址博物馆",
  "专题博物馆",
  "纪念馆",
  "美术馆",
  "考古/文物机构",
  "宗教场馆",
  "其他",
] as const;

export const MUSEUM_GRADE_OPTIONS = ["一级", "二级", "三级", "未定级", "未知"] as const;

export const MUSEUM_LEVEL_OPTIONS = ["国家一级博物馆", "国家二级博物馆", "国家三级博物馆", "未定级", "未知"] as const;

export function normalizeMuseumProvince(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "未知地区") return "";
  return PROVINCE_OPTIONS.includes(text as (typeof PROVINCE_OPTIONS)[number]) ? text : "";
}

export function normalizeMuseumCity(province: unknown, city: unknown): string {
  const cleanProvince = normalizeMuseumProvince(province);
  const text = String(city ?? "").trim();
  if (!text || text === "自定义") return "";
  if (!cleanProvince || cleanProvince === "未填写") return text;
  if (cleanProvince === "其他") return text || "未知地区";
  return text;
}

export function normalizeMuseumType(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "其他";
  return MUSEUM_TYPE_OPTIONS.includes(text as (typeof MUSEUM_TYPE_OPTIONS)[number]) ? text : "其他";
}

export function normalizeMuseumGrade(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "未定级";
  return MUSEUM_GRADE_OPTIONS.includes(text as (typeof MUSEUM_GRADE_OPTIONS)[number]) ? text : "未知";
}

export function normalizeMuseumLevel(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "未定级";
  return MUSEUM_LEVEL_OPTIONS.includes(text as (typeof MUSEUM_LEVEL_OPTIONS)[number]) ? text : "未知";
}

export function inferMuseumTypeByName(name: unknown, fallback: unknown = "其他"): string {
  const text = String(name ?? "");
  if (text.includes("大学") || text.includes("高校")) return "高校博物馆";
  if (text.includes("遗址") || text.includes("法门寺")) return "遗址博物馆";
  if (text.includes("纪念馆")) return "纪念馆";
  if (text.includes("美术馆")) return "美术馆";
  if (text.includes("考古") || text.includes("文物管理") || text.includes("文物保护")) return "考古/文物机构";
  if (text.includes("寺") || text.includes("观") || text.includes("庙")) return "宗教场馆";
  return normalizeMuseumType(fallback);
}
