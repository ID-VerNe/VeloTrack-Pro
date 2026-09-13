import { getAdminToken } from '../utils/activity/adminApiClient';
import { getNaturalWeekRange } from '../utils/dateUtils';
export async function deleteRide(id: string): Promise<void> {
  const token = getAdminToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Admin-Token'] = token;
  }
  const res = await fetch(`/api/rides/${id}`, {
    method: 'DELETE',
    headers,
  });
  
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      throw new Error('鉴权未通过：管理令牌无效或已过期');
    } else {
      throw new Error(data.error || '删除失败，请稍后重试');
    }
  }
}

export async function updateRideTitle(id: string, newTitle: string): Promise<void> {
  const res = await fetch(`/api/rides/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: newTitle.trim() }),
  });
  if (!res.ok) {
    throw new Error('更新标题失败');
  }
}

export async function getWeeklyStats(): Promise<{ ridesCount: number; goalPct: number } | null> {
  try {
    const [ridesRes, goalsRes] = await Promise.all([
      fetch('/api/rides').then(r => r.json()),
      fetch('/api/ai/goals').then(r => r.json()).catch(() => ({ goals: null }))
    ]);

    const weeklyTarget = goalsRes?.goals?.weekly_distance_km || 50.0;

    if (ridesRes.rides) {
      const ridesCount = ridesRes.rides.length;

      const latestTime = Math.max(...ridesRes.rides.map((r: any) => r.start_time || 0));
      const weekRange = getNaturalWeekRange(latestTime > 0 ? latestTime : Date.now());

      const weekRides = ridesRes.rides.filter(
        (r: any) => r.start_time >= weekRange.start && r.start_time <= weekRange.end
      );
      const thisWeekKm = weekRides.reduce((acc: number, r: any) => acc + (r.distance_meters || 0), 0) / 1000;
      const goalPct = Math.min(100, Math.round((thisWeekKm / weeklyTarget) * 100));

      return { ridesCount, goalPct };
    }
    return null;
  } catch {
    return null;
  }
}
