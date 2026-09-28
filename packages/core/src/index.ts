/**
 * @velotrack/core —— 跨端共享的纯数学基础工具(无运行时依赖)
 *
 * 抽离自 apps/web 与 apps/admin 原先复制粘贴的 geoCalculations / 心率区间逻辑,
 * 作为 web/admin/Android 三端共用的单一事实源。Android 端的 Kotlin 实现须与本包逐字对齐。
 *
 * 设计约束:
 * - 零运行时依赖,纯 ES module + TypeScript,可被 Vite bundler mode 直接解析
 * - 所有函数为纯函数,无副作用,可在浏览器与测试环境安全调用
 * - 不包含任何业务规则(隐私脱敏/解析/聚合),仅提供确定性数学基础
 */

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

export * from './geo';
export * from './hr';
