import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import polyline from '@mapbox/polyline';
import { getRideInsight } from '../services/aiInsights';
import { getRiderProfile } from '../services/riderService';
import { analyzeSpeedDistribution } from '../utils/speedDistribution';
import { calculateCyclingCalories } from '../utils/cyclingCalculations';
import { getLocalRideDetail, saveLocalRideDetail, deleteLocalRide } from '../utils/storage/indexedDb';
import type { RideDetailPoint } from '../utils/telemetrySegments';

export interface UseRideDetailDataOptions {
  id?: string;
  onDeleteSuccess?: () => void;
}

export function useRideDetailData({ id, onDeleteSuccess }: UseRideDetailDataOptions = {}) {
  const [ride, setRide] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [detailPoints, setDetailPoints] = useState<RideDetailPoint[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [riderWeight, setRiderWeight] = useState<number>(75.0);

  // Performance Insight State
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);

  // Ride Deletion State
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasLocalDetailRef = useRef(false);

  // Fetch Rider Profile Weight
  useEffect(() => {
    getRiderProfile()
      .then((profile) => {
        if (profile.weight_kg) {
          setRiderWeight(profile.weight_kg);
        }
      })
      .catch((err) => console.error('Failed to load profile weight', err));
  }, []);

  const applyRideData = useCallback((data: { ride: any; detailPoints?: any[] | null }) => {
    if (data.ride) {
      setRide(data.ride);
      setDetailPoints(Array.isArray(data.detailPoints) ? data.detailPoints : null);
      if (data.ride.summary_polyline) {
        const rawCoords = polyline.decode(data.ride.summary_polyline);
        const formatted: [number, number][] = rawCoords.map((p) => [p[1], p[0]]);
        setRouteCoordinates(formatted);
      }
      setLoadError(null);
    }
  }, []);

  // Fetch Ride Details (Local-First 0ms 秒开 + 后台静默对齐)
  const loadData = useCallback(async () => {
    if (!id) return;
    setLoadError(null);

    // 1. 优先从 IndexedDB 读本地缓存（0ms 呈现）
    try {
      const cached = await getLocalRideDetail(id);
      if (cached && cached.ride) {
        hasLocalDetailRef.current = true;
        applyRideData(cached);
      }
    } catch {}

    // 2. 发起网络请求
    try {
      const res = await fetch(`/api/rides/${id}`);
      if (!res.ok) {
        if (!hasLocalDetailRef.current) {
          setLoadError(res.status === 404 ? '骑行记录不存在或已被删除' : `加载失败（HTTP ${res.status}）`);
        }
        return;
      }
      const data = await res.json();
      if (data.ride) {
        applyRideData(data);
        saveLocalRideDetail(id, data.ride, data.detailPoints).catch(() => {});
      } else if (!hasLocalDetailRef.current) {
        setLoadError('骑行数据格式异常');
      }
    } catch (err) {
      console.error('Failed to load ride detail', err);
      if (!hasLocalDetailRef.current) {
        setLoadError('网络异常，无法加载骑行详情');
      }
    }
  }, [id, applyRideData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch AI Insight
  const fetchInsight = useCallback(
    async (forceRegenerate = false) => {
      if (!id) return;
      setAiLoading(true);
      try {
        const result = await getRideInsight(id, forceRegenerate);
        if (result.insight) {
          setAiInsight(result.insight);
          setIsCached(result.cached);
        }
      } catch (err) {
        console.error('Failed to fetch AI insight', err);
      } finally {
        setAiLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    fetchInsight(false);
  }, [fetchInsight]);

  // Delete Ride Handler
  const handleDeleteRide = async () => {
    if (!id) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteLocalRide(id);
      const { deleteRide } = await import('../services/rideService');
      await deleteRide(id);
      onDeleteSuccess?.();
    } catch (err: any) {
      console.error('Failed to delete ride', err);
      setDeleteError(err.message || '网络错误，删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  const movingAvgSpeedKmh = useMemo(() => {
    if (!ride) return 0;
    const movingSec = ride.moving_time_seconds || ride.elapsed_time_seconds || 0;
    return movingSec > 0 ? Number(((ride.distance_meters / 1000) / (movingSec / 3600)).toFixed(1)) : 0;
  }, [ride]);

  const speedDist = useMemo(() => {
    if (!ride) return null;
    return analyzeSpeedDistribution(detailPoints, movingAvgSpeedKmh, 46, 15);
  }, [ride, detailPoints, movingAvgSpeedKmh]);

  const calories = useMemo(() => {
    if (!ride) return 0;
    const totalSeconds = ride.moving_time_seconds || ride.elapsed_time_seconds || 0;
    return calculateCyclingCalories(
      (ride.distance_meters || 0) / 1000,
      totalSeconds,
      ride.avg_speed_kmh || 0,
      ride.total_ascent_meters || 0,
      riderWeight
    );
  }, [ride, riderWeight]);

  return {
    ride,
    setRide,
    routeCoordinates,
    detailPoints,
    loadError,
    riderWeight,
    aiInsight,
    aiLoading,
    isCached,
    speedDist,
    calories,
    isDeleting,
    deleteError,
    loadData,
    fetchInsight,
    handleDeleteRide,
  };
}
