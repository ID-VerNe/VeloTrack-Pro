/**
 * VeloTrack 骑行活动规范命名与 AI 标题推荐服务
 * 
 * 职责：
 * 1. 确定性规则兜底命名：根据时间段、里程、爬升与城市生成规范中文标题
 * 2. 基于 LLM 的个性化骑行标题推荐与清洗
 */

import { getAIConfig, callAICompletion, parseAIResponse } from './aiClient';

export interface FallbackTitleInput {
  start_time: number;
  distance_km?: number;
  avg_speed_kmh?: number;
  total_ascent_meters?: number;
  city?: string;
}

export interface SuggestTitleInput {
  start_time: number;
  distance_km: number;
  avg_speed_kmh: number;
  total_ascent_meters: number;
}

export interface SuggestTitleResult {
  title: string;
  isFallback?: boolean;
  warning?: string;
}

/**
 * 确定性规则兜底命名：AI 不可用或未配置时依据时间/里程/爬升生成规范中文标题
 */
export function generateFallbackRideTitle(data: FallbackTitleInput): string {
  const d = new Date(Number(data.start_time));
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const hour = d.getHours();

  let timeSlot = '骑行';
  if (hour >= 5 && hour < 9) timeSlot = '晨骑';
  else if (hour >= 9 && hour < 12) timeSlot = '上午骑行';
  else if (hour >= 12 && hour < 14) timeSlot = '午间骑行';
  else if (hour >= 14 && hour < 18) timeSlot = '下午骑行';
  else if (hour >= 18 && hour < 22) timeSlot = '夜骑';
  else timeSlot = '深夜骑行';

  const dist = Number(data.distance_km) || 0;
  const ascent = Number(data.total_ascent_meters) || 0;
  const city = typeof data.city === 'string' && data.city ? data.city : '';

  let subtype = '';
  if (ascent >= 500) subtype = '爬坡挑战';
  else if (dist >= 50) subtype = '长距离巡航';
  else if (dist >= 30) subtype = '公路巡航';
  else if (dist > 0 && dist < 10) subtype = '短途小试';

  const prefix = city ? `${city} · ` : '';
  const label = subtype ? `${month}月${date}日 ${timeSlot}（${subtype}）` : `${month}月${date}日 ${timeSlot}`;

  return `${prefix}${label}`.slice(0, 24);
}

/**
 * 结合活动遥测数据调用 AI 生成规范命名的简短标题
 */
export async function suggestRideTitle(input: SuggestTitleInput): Promise<SuggestTitleResult> {
  const { start_time, distance_km, avg_speed_kmh, total_ascent_meters } = input;

  if (!Number.isFinite(Number(start_time)) || Number(start_time) <= 0) {
    throw new Error('start_time 必须是有效时间戳');
  }

  const fallback = generateFallbackRideTitle({
    start_time: Number(start_time),
    distance_km,
    avg_speed_kmh,
    total_ascent_meters,
  });

  const config = await getAIConfig();
  if (!config.base_url) {
    return { title: fallback, isFallback: true, warning: 'AI 未配置，已使用规则规范命名' };
  }

  const dateStr = new Date(Number(start_time)).toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'long',
  });

  try {
    const res = await callAICompletion(config, [
      {
        role: 'system',
        content: '你是骑行活动的命名助手。根据骑行数据生成一个简洁的中文标题，不超过 16 个字，直接输出标题本身，不要引号、不要解释、不要 emoji、不要输出思维过程。',
      },
      {
        role: 'user',
        content: JSON.stringify({
          日期: dateStr,
          里程公里: distance_km,
          均速kmh: avg_speed_kmh,
          爬升米: total_ascent_meters,
        }),
      },
    ], { temperature: 0.7, max_tokens: 2000, retries: 1 });

    if (!res.ok) {
      return {
        title: fallback,
        isFallback: true,
        warning: `AI 服务暂时不可用 (HTTP ${res.status})，已启用智能兜底命名`,
      };
    }
    const { content } = await parseAIResponse(res);
    // 过滤掉前置步骤编号/解释或括号
    const cleaned = content
      .replace(/^[\s\d.\-、*]+/gm, '')
      .replace(/[（(].*?[)）]/g, '')
      .trim();
    const firstLine = cleaned.split(/\n|。|！|？/).map((s) => s.trim()).find((s) => s.length > 0 && s.length <= 30) || '';
    const rawTitle = (firstLine || content).trim().replace(/^["'“”「」]+|["'“”「」]+$/g, '').slice(0, 24);
    return { title: rawTitle || fallback };
  } catch (err) {
    console.error('[suggest-title] Exception, falling back:', err);
    return {
      title: fallback,
      isFallback: true,
      warning: 'AI 服务调用异常，已启用智能兜底命名',
    };
  }
}
