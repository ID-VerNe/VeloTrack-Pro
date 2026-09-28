export interface GeoPoint {
  time: number;
  lat?: number;
  lng?: number;
  altitude?: number;
  distance?: number;
  hr?: number;
  cadence?: number;
  speed?: number;
}

// 纯数学基础工具已抽离至 @velotrack/core,本文件仅做向后兼容的重导出,
// 避免下游成百处 import 路径迁移在本次重构中爆炸式改动。
// 心率区间/Haversine/降采样的单一事实源在 packages/core。
export {
  calculateHRZones,
  getHaversineDistanceMeters,
  computeDistanceMeters,
  haversineDistanceKm,
  downsamplePoints,
} from '@velotrack/core';
