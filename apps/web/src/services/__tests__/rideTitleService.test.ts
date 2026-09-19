import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateFallbackRideTitle, suggestRideTitle } from '../rideTitleService';
import * as aiClient from '../aiClient';

describe('rideTitleService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateFallbackRideTitle', () => {
    it('generates morning ride with climbing challenge tag', () => {
      // 2026-05-20 07:30:00 (Local)
      const date = new Date(2026, 4, 20, 7, 30, 0);
      const title = generateFallbackRideTitle({
        start_time: date.getTime(),
        distance_km: 25,
        total_ascent_meters: 650,
        city: '深圳',
      });
      expect(title).toBe('深圳 · 5月20日 晨骑（爬坡挑战）');
    });

    it('generates night cruise ride without city prefix if city is omitted', () => {
      // 2026-08-15 20:00:00 (Local)
      const date = new Date(2026, 7, 15, 20, 0, 0);
      const title = generateFallbackRideTitle({
        start_time: date.getTime(),
        distance_km: 35,
        total_ascent_meters: 50,
      });
      expect(title).toBe('8月15日 夜骑（公路巡航）');
    });

    it('generates short trial ride title for short distances', () => {
      // 2026-03-10 13:00:00 (Local)
      const date = new Date(2026, 2, 10, 13, 0, 0);
      const title = generateFallbackRideTitle({
        start_time: date.getTime(),
        distance_km: 5,
        city: '广州',
      });
      expect(title).toBe('广州 · 3月10日 午间骑行（短途小试）');
    });
  });

  describe('suggestRideTitle', () => {
    it('throws error when start_time is invalid', async () => {
      await expect(
        suggestRideTitle({
          start_time: 0,
          distance_km: 20,
          avg_speed_kmh: 22,
          total_ascent_meters: 100,
        })
      ).rejects.toThrow('start_time 必须是有效时间戳');
    });

    it('returns fallback title when AI base_url is not configured', async () => {
      vi.spyOn(aiClient, 'getAIConfig').mockResolvedValue({
        base_url: '',
        api_key: '',
        model: '',
      } as any);

      const date = new Date(2026, 5, 1, 19, 0, 0);
      const res = await suggestRideTitle({
        start_time: date.getTime(),
        distance_km: 20,
        avg_speed_kmh: 23,
        total_ascent_meters: 50,
      });

      expect(res.isFallback).toBe(true);
      expect(res.title).toContain('夜骑');
    });

    it('cleans AI response and returns title when AI call succeeds', async () => {
      vi.spyOn(aiClient, 'getAIConfig').mockResolvedValue({
        base_url: 'https://api.openai.com/v1',
        api_key: 'test',
        model: 'gpt-4o',
      } as any);

      vi.spyOn(aiClient, 'callAICompletion').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '1. 「滨海晨光绿道骑行」' } }],
        }),
      } as any);

      const date = new Date(2026, 5, 1, 8, 0, 0);
      const res = await suggestRideTitle({
        start_time: date.getTime(),
        distance_km: 30,
        avg_speed_kmh: 25,
        total_ascent_meters: 80,
      });

      expect(res.title).toBe('滨海晨光绿道骑行');
      expect(res.isFallback).toBeUndefined();
    });
  });
});
