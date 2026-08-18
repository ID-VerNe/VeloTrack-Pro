import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight,
  ArrowUpRight
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import RouteMapPreview from '../components/routes/RouteMapPreview';

interface RouteItem {
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

const CURATED_ROUTES: RouteItem[] = [
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

export default function RoutesExplorer() {
  const navigate = useNavigate();
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedRoute, setSelectedRoute] = useState<RouteItem>(CURATED_ROUTES[0]);

  const filteredRoutes = CURATED_ROUTES.filter((r) => {
    if (selectedCity === 'all') return true;
    return r.city === selectedCity;
  });

  const handleAskCoachAboutRoute = () => {
    const prompt = `我想去骑行【${selectedRoute.city}·${selectedRoute.name}】（距离 ${selectedRoute.distanceKm}km，爬升 ${selectedRoute.ascentM}m），请结合我的大行 P8 齿比配置与膝盖防护需求，给出战术配速节奏与补给建议。`;
    navigate('/ai-coach?prompt=' + encodeURIComponent(prompt));
  };

  return (
    <div className="h-screen w-screen bg-[#F8FAFC] font-sans flex text-slate-900 overflow-hidden select-none">
      <Sidebar />

      <main className="flex-1 h-full flex flex-col bg-white overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-16 px-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h1 className="text-base font-semibold text-slate-900 leading-tight">城市精选路线</h1>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">大湾区经典骑行路线 · 包含推荐齿比与膝盖保护提示</p>
          </div>

          <div className="flex items-center space-x-1 border border-slate-200 p-0.5 rounded font-mono text-xs">
            {['all', '深圳', '广州'].map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCity(c)}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  selectedCity === c ? 'bg-slate-900 text-white font-medium' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {c === 'all' ? '全部城市' : c}
              </button>
            ))}
          </div>
        </header>

        {/* 2-Column Split Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Route List (40%) */}
          <div className="w-full lg:w-[420px] border-r border-slate-100 p-6 overflow-y-auto space-y-3 shrink-0 [scrollbar-width:none]">
            <div className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest mb-3">
              路线列表 ({filteredRoutes.length})
            </div>

            {filteredRoutes.map((route) => {
              const isSelected = selectedRoute.id === route.id;
              return (
                <div
                  key={route.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`选择路线 ${route.name}，${route.distanceKm} 公里`}
                  onClick={() => setSelectedRoute(route)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedRoute(route);
                    }
                  }}
                  className={`p-4 rounded border transition-colors cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-slate-50 border-slate-900 border-l-2'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 bg-white">
                      {route.city} · {route.difficulty}
                    </span>
                    <span className="text-xs font-semibold tabular-nums font-mono text-slate-900">
                      {route.distanceKm} km
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-slate-900">{route.name}</h3>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                      {route.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-400">
                    <span>
                      爬升 {route.ascentM}m
                    </span>
                    <span className="font-medium text-slate-900 flex items-center group">
                      查看详情 <ChevronRight className="w-3 h-3 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Route Detailed Guide (60%) */}
          <div className="flex-1 p-8 overflow-y-auto space-y-6 [scrollbar-width:none]">
            {/* 1. Interactive Route Map Preview */}
            <RouteMapPreview
              coordinates={selectedRoute.coordinates}
              routeName={selectedRoute.name}
            />

            {/* 2. Route Title & Badges */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2 font-mono">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 text-white font-medium">
                    {selectedRoute.city}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-50 text-slate-700 font-medium border border-slate-200">
                    {selectedRoute.difficulty}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-slate-900 tracking-tight">{selectedRoute.name}</h2>
                <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                  {selectedRoute.description}
                </p>
              </div>

              {/* Telemetry Simulation Button */}
              <button
                onClick={handleAskCoachAboutRoute}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-mono transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0 self-start sm:self-auto"
                title="以此路线为目标推演齿比与踏频"
              >
                <span>推演此路线齿比与配速</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>

            {/* 3. Quick Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded border border-slate-200/80">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">单圈里程</div>
                <div className="text-2xl font-semibold font-mono text-slate-900 mt-1 tabular-nums">
                  {selectedRoute.distanceKm} <span className="text-xs font-normal text-slate-400 font-sans">km</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded border border-slate-200/80">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">累计爬升</div>
                <div className="text-2xl font-semibold font-mono text-slate-900 mt-1 tabular-nums">
                  {selectedRoute.ascentM} <span className="text-xs font-normal text-slate-400 font-sans">m</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded border border-slate-200/80">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">推荐适用车型</div>
                <div className="text-xs font-medium text-slate-900 mt-2 truncate">
                  {selectedRoute.suitableBike}
                </div>
              </div>
            </div>

            {/* 4. Highlights */}
            <div className="bg-white rounded border border-slate-200/80 p-5 space-y-3">
              <h3 className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">路线特征</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {selectedRoute.highlights.map((h, i) => (
                  <div key={i} className="bg-slate-50 p-3 rounded border border-slate-200/80 text-xs font-normal text-slate-700 flex items-center space-x-2">
                    <span className="w-1 h-1 rounded-full bg-slate-900 shrink-0" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Tactical Gear & Knee Safety Guidance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Gear Ratio Strategy */}
              <div className="bg-white rounded p-5 border border-slate-200/80 space-y-2">
                <div className="text-xs font-semibold text-slate-900">
                  <span>齿比与踏频建议</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-mono">
                  {selectedRoute.recommendedGear}
                </p>
              </div>

              {/* Knee Safety Advice */}
              <div className="bg-white rounded p-5 border border-slate-200/80 space-y-2">
                <div className="text-xs font-semibold text-slate-900">
                  <span>膝关节保护提示</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {selectedRoute.kneeSafetyAdvice}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
