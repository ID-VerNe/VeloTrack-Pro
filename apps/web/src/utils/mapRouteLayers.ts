// apps/web/src/utils/mapRouteLayers.ts
//
// 统一地图轨迹图层配置与生成工具
// 遵循单一职责（SRP）与 DRY 原则，统一全站地图（DashboardMap、RideDetailMap）关于发光底图、外包边、主轨迹线与交互拾取层的生成与绑定。

import type { LineLayerSpecification } from 'maplibre-gl';

export interface RouteGlowLayerOptions {
  id: string;
  source: string;
  color: string;
  width?: number;
  opacity?: number;
  blur?: number;
}

export interface RouteCasingLayerOptions {
  id: string;
  source: string;
  color: string;
  width?: number;
  opacity?: number;
}

export interface RouteCoreLayerOptions {
  id: string;
  source: string;
  color: any; // string or MapLibre style expression like ['get', 'color']
  width?: number;
  opacity?: number;
}

export interface RouteHitTargetLayerOptions {
  id: string;
  source: string;
  width?: number;
  opacity?: number;
  color?: string;
}

/**
 * 创建发光底层图层规格
 */
export function createRouteGlowLayer(options: RouteGlowLayerOptions): LineLayerSpecification {
  return {
    id: options.id,
    type: 'line',
    source: options.source,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': options.color,
      'line-width': options.width ?? 8,
      'line-opacity': options.opacity ?? 0.45,
      'line-blur': options.blur ?? 2.5,
    },
  };
}

/**
 * 创建高对比度外包边图层规格
 */
export function createRouteCasingLayer(options: RouteCasingLayerOptions): LineLayerSpecification {
  return {
    id: options.id,
    type: 'line',
    source: options.source,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': options.color,
      'line-width': options.width ?? 6.5,
      'line-opacity': options.opacity ?? 0.95,
    },
  };
}

/**
 * 创建核心主轨迹线图层规格
 */
export function createRouteCoreLayer(options: RouteCoreLayerOptions): LineLayerSpecification {
  return {
    id: options.id,
    type: 'line',
    source: options.source,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': options.color,
      'line-width': options.width ?? 3.5,
      'line-opacity': options.opacity ?? 0.95,
    },
  };
}

/**
 * 创建交互触控热区图层规格
 */
export function createRouteHitTargetLayer(options: RouteHitTargetLayerOptions): LineLayerSpecification {
  return {
    id: options.id,
    type: 'line',
    source: options.source,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-width': options.width ?? 22,
      'line-opacity': options.opacity ?? 0.001,
      'line-color': options.color ?? '#000000',
    },
  };
}
