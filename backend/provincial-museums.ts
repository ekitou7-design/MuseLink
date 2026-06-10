import type { Museum } from "../src/types";

export type ProvincialMuseumSeed = {
  name: string;
  location: string;
  region: string;
};

export const PROVINCIAL_MUSEUMS: ProvincialMuseumSeed[] = [
  // 中央部门
  { name: "故宫博物院", location: "中央部门", region: "华北地区" },
  { name: "中国科学技术馆", location: "中央部门", region: "华北地区" },
  { name: "中国地质博物馆", location: "中央部门", region: "华北地区" },
  { name: "中国人民革命军事博物馆", location: "中央部门", region: "华北地区" },
  { name: "中国航空博物馆", location: "中央部门", region: "华北地区" },
  { name: "北京鲁迅博物馆", location: "中央部门", region: "华北地区" },

  // 北京市
  { name: "首都博物馆", location: "北京市", region: "华北地区" },
  { name: "北京自然博物馆", location: "北京市", region: "华北地区" },
  { name: "中国人民抗日战争纪念馆", location: "北京市", region: "华北地区" },
  { name: "北京天文馆", location: "北京市", region: "华北地区" },
  { name: "周口店猿人遗址博物馆", location: "北京市", region: "华北地区" },

  // 天津市
  { name: "天津博物馆", location: "天津市", region: "华北地区" },
  { name: "天津自然博物馆", location: "天津市", region: "华北地区" },
  { name: "周恩来邓颖超纪念馆", location: "天津市", region: "华北地区" },

  // 河北省
  { name: "河北省博物馆", location: "河北省", region: "华北地区" },
  { name: "西柏坡纪念馆", location: "河北省", region: "华北地区" },

  // 山西省
  { name: "山西博物院", location: "山西省", region: "华北地区" },
  { name: "中国煤炭博物馆", location: "山西省", region: "华北地区" },
  { name: "八路军太行纪念馆", location: "山西省", region: "华北地区" },

  // 内蒙古自治区
  { name: "内蒙古博物院", location: "内蒙古自治区", region: "华北地区" },

  // 辽宁省
  { name: "辽宁省博物馆", location: "辽宁省", region: "东北地区" },
  { name: "沈阳“九•一八”历史博物馆", location: "辽宁省", region: "东北地区" },
  { name: "抗美援朝纪念馆", location: "辽宁省", region: "东北地区" },
  { name: "旅顺博物馆", location: "辽宁省", region: "东北地区" },

  // 吉林省
  { name: "吉林省自然博物馆", location: "吉林省", region: "东北地区" },

  // 黑龙江省
  { name: "东北烈士纪念馆", location: "黑龙江省", region: "东北地区" },
  { name: "大庆铁人王进喜纪念馆", location: "黑龙江省", region: "东北地区" },
  { name: "爱辉历史陈列馆", location: "黑龙江省", region: "东北地区" },

  // 上海市
  { name: "上海博物馆", location: "上海市", region: "华东地区" },
  { name: "上海鲁迅纪念馆", location: "上海市", region: "华东地区" },
  { name: "中共一大会址纪念馆", location: "上海市", region: "华东地区" },

  // 江苏省
  { name: "南京博物院", location: "江苏省", region: "华东地区" },
  { name: "侵华日军南京大屠杀遇难同胞纪念馆", location: "江苏省", region: "华东地区" },
  { name: "南通博物苑", location: "江苏省", region: "华东地区" },
  { name: "苏州博物馆", location: "江苏省", region: "华东地区" },
  { name: "扬州博物馆", location: "江苏省", region: "华东地区" },

  // 浙江省
  { name: "浙江省博物馆", location: "浙江省", region: "华东地区" },

  // 安徽省
  { name: "安徽省博物馆", location: "安徽省", region: "华东地区" },

  // 福建省
  { name: "福建博物院", location: "福建省", region: "华东地区" },
  { name: "古田会议纪念馆", location: "福建省", region: "华东地区" },
  { name: "泉州海外交通史博物馆", location: "福建省", region: "华东地区" },
  { name: "厦门华侨博物院", location: "福建省", region: "华东地区" },
  { name: "中国闽台缘博物馆", location: "福建省", region: "华东地区" },

  // 江西省
  { name: "井冈山革命博物馆", location: "江西省", region: "华东地区" },
  { name: "江西省博物馆", location: "江西省", region: "华东地区" },
  { name: "瑞金中央革命根据地纪念馆", location: "江西省", region: "华东地区" },
  { name: "南昌八一起义纪念馆", location: "江西省", region: "华东地区" },

  // 山东省
  { name: "中国海军博物馆", location: "山东省", region: "华东地区" },
  { name: "青岛市博物馆", location: "山东省", region: "华东地区" },
  { name: "中国甲午战争博物馆", location: "山东省", region: "华东地区" },
  { name: "青州市博物馆", location: "山东省", region: "华东地区" },

  // 河南省
  { name: "河南博物院", location: "河南省", region: "华中地区" },
  { name: "郑州博物馆", location: "河南省", region: "华中地区" },
  { name: "洛阳博物馆", location: "河南省", region: "华中地区" },
  { name: "南阳汉画馆", location: "河南省", region: "华中地区" },

  // 湖北省
  { name: "湖北省博物馆", location: "湖北省", region: "华中地区" },
  { name: "荆州博物馆", location: "湖北省", region: "华中地区" },
  { name: "武汉市博物馆", location: "湖北省", region: "华中地区" },

  // 湖南省
  { name: "湖南省博物馆", location: "湖南省", region: "华中地区" },
  { name: "韶山毛泽东故居纪念馆", location: "湖南省", region: "华中地区" },
  { name: "刘少奇故居纪念馆", location: "湖南省", region: "华中地区" },

  // 广东省
  { name: "广东省博物馆", location: "广东省", region: "华南地区" },
  { name: "西汉南越王博物馆", location: "广东省", region: "华南地区" },
  { name: "孙中山故居纪念馆", location: "广东省", region: "华南地区" },

  // 广西壮族自治区
  { name: "广西壮族自治区博物馆", location: "广西壮族自治区", region: "华南地区" },

  // 重庆市
  { name: "重庆中国三峡博物馆", location: "重庆市", region: "西南地区" },

  // 四川省
  { name: "自贡恐龙博物馆", location: "四川省", region: "西南地区" },
  { name: "广汉三星堆博物馆", location: "四川省", region: "西南地区" },
  { name: "成都武侯祠博物馆", location: "四川省", region: "西南地区" },
  { name: "邓小平故居陈列馆", location: "四川省", region: "西南地区" },
  { name: "成都杜甫草堂博物馆", location: "四川省", region: "西南地区" },

  // 贵州省
  { name: "遵义会议纪念馆", location: "贵州省", region: "西南地区" },

  // 云南省
  { name: "云南省博物馆", location: "云南省", region: "西南地区" },
  { name: "云南民族博物馆", location: "云南省", region: "西南地区" },

  // 西藏自治区
  { name: "西藏博物馆", location: "西藏自治区", region: "西南地区" },

  // 陕西省
  { name: "陕西历史博物馆", location: "陕西省", region: "西北地区" },
  { name: "秦始皇兵马俑博物馆", location: "陕西省", region: "西北地区" },
  { name: "延安革命纪念馆", location: "陕西省", region: "西北地区" },
  { name: "汉阳陵博物馆", location: "陕西省", region: "西北地区" },
  { name: "西安碑林博物馆", location: "陕西省", region: "西北地区" },
  { name: "西安半坡博物馆", location: "陕西省", region: "西北地区" },

  // 宁夏回族自治区
  { name: "固原博物馆", location: "宁夏回族自治区", region: "西北地区" },

  // 新疆维吾尔自治区
  { name: "新疆维吾尔自治区博物馆", location: "新疆维吾尔自治区", region: "西北地区" },
];

export const DEFAULT_MUSEUM_IMAGE = "";

export function buildProvincialMuseumShells(slugify: (input: string) => string, updatedAt: string): Museum[] {
  return PROVINCIAL_MUSEUMS.map((museum) => ({
    id: slugify(museum.name),
    name: museum.name,
    description: `${museum.name}是对应${museum.location}的省级综合性博物馆。`,
    location: museum.location,
    imageUrl: DEFAULT_MUSEUM_IMAGE,
    artifactIds: [],
    artifactCount: 0,
    periods: [],
    materials: [],
    updatedAt,
  }));
}
