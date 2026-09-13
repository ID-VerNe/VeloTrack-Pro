/**
 * VeloTrack Pro - Design Tokens
 * 核心设计变量与色彩令牌唯一事实来源（Single Source of Truth）
 * 基于战队 Logo（logo-kigurumi.jpg / logo.jpg）底色 #395AA7 衍生
 */

export const BRAND_COLORS = {
  50: '#F0F4FC',
  100: '#E1E9F8',
  200: '#C6D6F4',
  300: '#9FBDF0',
  400: '#6E98E4',
  500: '#395AA7', // Logo 核心背景色
  600: '#2E4A8E', // 按钮悬浮 Hover
  700: '#243B72', // 激活/按压 Active
  800: '#1C2E59', // 深度底衬 / 卫星光晕
  900: '#162343', // 极限深底
} as const;

export const BRAND_TOKENS = {
  primary: BRAND_COLORS[500],
  hover: BRAND_COLORS[600],
  active: BRAND_COLORS[700],
  subtle: BRAND_COLORS[50],
  border: BRAND_COLORS[200],
  text: BRAND_COLORS[500],
  textDark: BRAND_COLORS[700],
} as const;

/**
 * 仪表盘与航迹地图渲染专属 Token
 */
export const MAP_ROUTE_TOKENS = {
  // 主页地图核心轨迹线颜色（对齐 Logo 底色）
  coreColor: BRAND_COLORS[500],
  // 卫星底图发光打底色
  satelliteGlow: BRAND_COLORS[800],
  // 卫星底图白边描边
  satelliteCasing: '#FFFFFF',
  // 悬停交互高亮色
  hoverCore: BRAND_COLORS[600],
  hoverGlow: 'rgba(57, 90, 167, 0.45)',
} as const;

/**
 * 遥测速度与心率光谱色彩 Token（保持运动学标准语义）
 */
export const TELEMETRY_COLORS = {
  stop: '#94A3B8',       // <2 km/h 停顿
  slow: '#F59E0B',       // 2-15 km/h 低速/爬坡
  transition: '#0EA5E9', // 15-22 km/h 节奏过渡
  cruising: '#10B981',   // 22-30 km/h 稳态巡航
  sprint: '#EF4444',     // ≥30 km/h 高速冲刺
} as const;

/**
 * ECharts 遥测折线图色彩 Token
 */
export const CHART_COLORS = {
  speed: BRAND_COLORS[500],      // 速度主曲线（对齐 Logo 底色）
  speedAreaTop: 'rgba(57, 90, 167, 0.28)',
  speedAreaBottom: 'rgba(57, 90, 167, 0.02)',
  altitude: '#D97706',           // 地形海拔曲线
  cruisingMarkline: '#10B981',   // 稳态巡航基准参考虚线
} as const;
