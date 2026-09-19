/**
 * VeloTrack 前端 riderService
 *
 * 从 packages/api/src/services/riderService.ts 平移。
 * 改 c.env.DB 为 fetch 后端端点。prompt 拼装逻辑（getRiderContextPrompt）保留，
 * 是 aiCoach / aiInsights / reports 的核心上下文来源。
 */

import { authFetch } from '../utils/activity/adminApiClient';

export interface RiderProfileData {
  id?: number;
  name: string;
  gender: string;
  weight_kg: number;
  height_cm: number;
  max_hr: number;
  resting_hr: number;
  ftp_watts: number;
  current_bike: string;
  gear_ratio?: string;
  tires?: string;
  bike_weight_kg?: number;
  bike_specs: string;
  custom_specs?: string | Record<string, any>;
  injuries_notes: string;
  primary_goal: string;
  updated_at?: number;
}

export interface TrainingGoalsData {
  weekly_distance_km: number;
  target_avg_speed_kmh: number;
  monthly_distance_km: number;
  annual_distance_km: number;
  coach_notes: string;
  updated_at?: number;
}

export interface GoalMilestone {
  id?: number;
  weekly_distance_km: number;
  target_avg_speed_kmh: number;
  monthly_distance_km?: number;
  primary_goal?: string;
  rationale: string;
  source: string;
  created_at?: number;
}

const DEFAULT_PROFILE: RiderProfileData = {
  name: 'VerNe Yuu',
  gender: 'male',
  weight_kg: 75.0,
  height_cm: 173.0,
  max_hr: 188,
  resting_hr: 55,
  ftp_watts: 165,
  current_bike: '大行 P8',
  gear_ratio: '46T牙盘 + 11-28T 7速飞轮',
  tires: '马牌 Contact Urban 2.0 轮胎 (75-80 psi)',
  bike_weight_kg: 11.5,
  bike_specs: '46T牙盘 + 11-28T 7速飞轮 | 马牌 Contact Urban 2.0 轮胎',
  custom_specs: '{"pedals": "平踏", "wheelset": "20寸406"}',
  injuries_notes: '右膝半月板轻微劳损史，需维持85-95rpm高踏频防护',
  primary_goal: 'W1-2稳扎16km/h均速门槛，建立高踏频肌肉记忆，向20km/h进发',
};

export async function getRiderProfile(): Promise<RiderProfileData> {
  const res = await fetch('/api/ai/rider/profile');
  if (!res.ok) return DEFAULT_PROFILE;
  const data = await res.json();
  const profile = data.profile;
  if (!profile) return DEFAULT_PROFILE;
  return {
    ...DEFAULT_PROFILE,
    ...profile,
    bike_weight_kg: Number(profile.bike_weight_kg) || 11.5,
    custom_specs: profile.custom_specs || '{"pedals": "平踏", "wheelset": "20寸406"}',
  };
}

export async function updateRiderProfile(data: Partial<RiderProfileData>): Promise<RiderProfileData> {
  const res = await authFetch('/api/ai/rider/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || '更新车手档案失败：HTTP ' + res.status);
  }
  const d = await res.json();
  return d.profile;
}

export async function getTrainingGoals(): Promise<TrainingGoalsData> {
  const res = await fetch('/api/ai/goals');
  if (!res.ok) {
    return {
      weekly_distance_km: 60.0,
      target_avg_speed_kmh: 18.0,
      monthly_distance_km: 180.0,
      annual_distance_km: 1000.0,
      coach_notes: '换档至46/17T（第3档），绿灯路段锁90rpm巡航23km/h，红灯停车挂轻档准备起步。',
    };
  }
  const data = await res.json();
  const g = data.goals || {};
  return {
    weekly_distance_km: Number(g.weekly_distance_km) || 60.0,
    target_avg_speed_kmh: Number(g.target_avg_speed_kmh) || 18.0,
    monthly_distance_km: Number(g.monthly_distance_km) || 180.0,
    annual_distance_km: Number(g.annual_distance_km) || 1000.0,
    coach_notes: g.coach_notes || '换档至46/17T（第3档），绿灯路段锁90rpm巡航23km/h，红灯停车挂轻档准备起步。',
    updated_at: g.updated_at,
  };
}

export async function updateTrainingGoals(data: Partial<TrainingGoalsData>): Promise<TrainingGoalsData> {
  const res = await authFetch('/api/ai/goals', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || '更新训练目标失败：HTTP ' + res.status);
  }
  const d = await res.json();
  return d.goals;
}

export async function getGoalMilestones(limit = 5): Promise<GoalMilestone[]> {
  const res = await fetch('/api/ai/goals');
  if (!res.ok) return [];
  const data = await res.json();
  return (data.milestones || []).slice(0, limit);
}

export async function addGoalMilestone(data: {
  weekly_distance_km: number;
  target_avg_speed_kmh: number;
  monthly_distance_km?: number;
  primary_goal?: string;
  rationale: string;
  source?: string;
}): Promise<void> {
  const res = await authFetch('/api/ai/goals/milestones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || '添加里程碑失败：HTTP ' + res.status);
  }
}

export interface RiderMemory {
  id?: number;
  category: string;
  memory_key: string;
  content: string;
  source?: string;
  importance?: number;
  is_active?: number;
  created_at?: number;
  updated_at?: number;
}

export async function getRiderMemories(activeOnly = false): Promise<RiderMemory[]> {
  const res = await fetch('/api/ai/rider/memories');
  if (!res.ok) return [];
  const data = await res.json();
  let mems = data.memories || [];
  if (activeOnly) mems = mems.filter((m: RiderMemory) => m.is_active === 1);
  return mems;
}

export async function upsertRiderMemory(
  category: string,
  key: string,
  content: string,
  source = 'manual',
  importance = 3
): Promise<number> {
  const res = await authFetch('/api/ai/rider/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, memory_key: key, content, source, importance }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || '保存记忆失败：HTTP ' + res.status);
  }
  const data = await res.json();
  return data.id;
}

export async function deleteRiderMemory(id: number): Promise<void> {
  const res = await authFetch(`/api/ai/rider/memories/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      throw new Error(data.error || '鉴权未通过：管理令牌无效或已过期，请检查管理令牌（ADMIN_TOKEN）');
    }
    throw new Error(data.error || `删除记忆失败 (${res.status})`);
  }
}

// 重新导出车手 Agentic Prompt 组装引擎，保持单一职责与向下兼容
export { getRiderContextPrompt } from './riderPromptEngine';
