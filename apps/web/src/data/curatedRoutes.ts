// apps/web/src/data/curatedRoutes.ts
//
// 城市精选路线静态数据配置
// 遵循关注点分离（SRP）原则，解耦视图呈现与路线静态资产，支持未来由后端接口或 CMS 动态载入。

export interface RouteItem {
  id: string;
  name: string;
  city: string;
  distanceKm: number;
  ascentM: number;
  difficulty: '初级平路' | '进阶节奏' | '耐力爬坡';
  suitableBike: string;
  recommendedGear: string;
  kneeSafetyAdvice: string;
  description: string;
  highlights: string[];
  coordinates: [number, number][];
}

export const CURATED_ROUTES: RouteItem[] = [
  {
    id: 'sz-bay',
    name: '深圳湾滨海绿道巡航线',
    city: '深圳',
    distanceKm: 21.9,
    ascentM: 45,
    difficulty: '初级平路',
    suitableBike: '折叠车 / 公路车 / 平把公路',
    recommendedGear: '46T × 17T~19T (维持 85~95 rpm 高踏频)',
    kneeSafetyAdvice: '全程极少坡度，注意海风逆风段及时降档，避免大齿比重踏加重半月板受力。',
    description: '从红树林保护区一路沿海延伸至蛇口海上世界，视野开阔、路面平整，是深圳最经典的平路巡航与恢复骑路线。',
    highlights: ['全程平整沥青与专属骑行道', '沿海景观与红树林海风', '夜间照明充足安全'],
    coordinates: [
      [113.975, 22.528],
      [113.953, 22.518],
      [113.948, 22.508],
      [113.939, 22.492],
      [113.925, 22.485],
      [113.913, 22.481],
      [113.902, 22.478],
    ],
  },
  {
    id: 'gz-ershadao',
    name: '广州二沙岛·珠江夜骑环线',
    city: '广州',
    distanceKm: 15.4,
    ascentM: 32,
    difficulty: '初级平路',
    suitableBike: '折叠车 / 城市公路车',
    recommendedGear: '46T × 19T (巡航 18~20 km/h)',
    kneeSafetyAdvice: '过桥引桥路段请提前 20 米降档至 24T/28T，以高转速通过短缓坡。',
    description: '环绕二沙岛艺术公园与海心沙亚运公园，平整无大起伏，广州市区夜间刷圈训练与恢复骑首选。',
    highlights: ['广州塔与珠江新城璀璨夜景', '车道平整宽阔，红绿灯少', '适宜测试定速巡航稳定性'],
    coordinates: [
      [113.305, 23.109],
      [113.315, 23.112],
      [113.328, 23.111],
      [113.332, 23.108],
      [113.325, 23.105],
      [113.310, 23.104],
      [113.305, 23.109],
    ],
  },
  {
    id: 'sz-dasha-river',
    name: '深圳大沙河生态长廊绿道',
    city: '深圳',
    distanceKm: 13.7,
    ascentM: 58,
    difficulty: '初级平路',
    suitableBike: '大行 P8 / 各类小轮折叠车',
    recommendedGear: '46T × 19T~21T',
    kneeSafetyAdvice: '途经人行天桥与坡道转弯时提前减速并降档，起步切勿站姿摇车。',
    description: '贯穿南山区南北生态绿道，北起大学城，南至深圳湾出海口，两岸林荫繁茂、空气清新。',
    highlights: ['贯穿南北无红绿灯绿道', '绿树成荫，夏季遮阳极佳', '折叠车 20 寸轮径通过性极佳'],
    coordinates: [
      [113.962, 22.585],
      [113.958, 22.568],
      [113.954, 22.548],
      [113.949, 22.531],
      [113.948, 22.515],
    ],
  },
  {
    id: 'gz-hec-outer',
    name: '广州大学城外环起伏节奏线',
    city: '广州',
    distanceKm: 17.5,
    ascentM: 108,
    difficulty: '进阶节奏',
    suitableBike: '公路车 / 升级细胎折叠车',
    recommendedGear: '平路 46×15T~17T，缓坡 46×24T/28T',
    kneeSafetyAdvice: '遇起伏坡道时严格保持踏频大于 85rpm，利用惯性冲坡后及时换挡。',
    description: '环绕大学城外环一周 17.5 公里，路宽车少，带微起伏地形，是进阶节奏骑与间歇训练的圣地。',
    highlights: ['单圈 17.5km 标准闭环', '微起伏适宜练习平滑变速', '路况开阔视野极佳'],
    coordinates: [
      [113.376, 23.055],
      [113.400, 23.065],
      [113.415, 23.045],
      [113.398, 23.025],
      [113.370, 23.035],
      [113.376, 23.055],
    ],
  },
  {
    id: 'sz-guangming-forest',
    name: '深圳光明森林耐力进阶线',
    city: '深圳',
    distanceKm: 30.6,
    ascentM: 268,
    difficulty: '耐力爬坡',
    suitableBike: '公路车 / 46T-28T/32T 折叠车',
    recommendedGear: '连续爬坡必须挂至 28T/32T 最大飞轮',
    kneeSafetyAdvice: '总爬升较大，若右膝有任何微酸紧绷感，请立即在坡道顶端停车拉伸股四头肌 3 分钟。',
    description: '光明科学城森林公园周边丘陵起伏路线，环境幽静，适合备战 50km 长距离耐力与爬坡做功。',
    highlights: ['连续起伏丘陵挑战', '空气负氧离子极高', '综合锻炼心肺与耐力极限'],
    coordinates: [
      [113.935, 22.755],
      [113.948, 22.768],
      [113.965, 22.782],
      [113.978, 22.775],
      [113.962, 22.750],
      [113.945, 22.742],
    ],
  },
];
