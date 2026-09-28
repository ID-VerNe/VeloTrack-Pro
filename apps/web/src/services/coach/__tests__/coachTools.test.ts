import { describe, it, expect, vi, afterEach } from 'vitest';
import { COACH_TOOLS, executeCoachTool } from '../coachTools';

// coachTools 内部调用 getRiderProfile 取传动与生理基准，stub fetch 返回结构化档案
const stubFetch = () =>
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/ai/rider/profile') {
      return new Response(JSON.stringify({
        profile: {
          name: 'VerNe', gender: 'male', weight_kg: 75, height_cm: 173, max_hr: 188, resting_hr: 55,
          ftp_watts: 165, current_bike: '大行 P8', chainring: 46,
          cogs: '[11,13,15,17,19,21,24,28]', wheel_spec: '20x2.0',
          bike_weight_kg: 11.5, custom_specs: '{}', primary_goal: '',
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }));

afterEach(() => vi.unstubAllGlobals());

describe('COACH_TOOLS', () => {
  it('包含 4 个核心工具声明', () => {
    expect(COACH_TOOLS).toHaveLength(4);
    const names = COACH_TOOLS.map((t) => t.function.name);
    expect(names).toContain('calculate_cycling_kinematics');
    expect(names).toContain('query_rides_summary');
    expect(names).toContain('set_training_goals');
    expect(names).toContain('update_rider_profile');
  });
});

describe('executeCoachTool', () => {
  it('执行运动学计算 - gear_cadence_speed', async () => {
    stubFetch();
    const res = await executeCoachTool('calculate_cycling_kinematics', {
      operation: 'gear_cadence_speed',
      chainring: 46,
      cogs: [15],
      wheel_spec: '20x2.0',
      cadence_rpm: 90,
    });
    expect(res).toBeDefined();
    expect(res.gear_table).toBeDefined();
    expect(res.gear_table[0].speed_at_cadence_kmh).toBeCloseTo(25.5, 0);
  });

  it('执行运动学计算 - climbing_power', async () => {
    stubFetch();
    const res = await executeCoachTool('calculate_cycling_kinematics', {
      operation: 'climbing_power',
      rider_weight_kg: 75,
      bike_weight_kg: 11.5,
      ascent_meters: 100,
      moving_time_seconds: 600,
      ftp_watts: 165,
    });
    expect(res).toBeDefined();
    expect(res.gravity_power_watts).toBeGreaterThan(0);
    expect(res.gravity_w_per_kg).toBeGreaterThan(0);
  });

  it('遇到未知工具返回错误对象', async () => {
    const res = await executeCoachTool('non_existent_tool', {});
    expect(res).toEqual({ error: 'Unknown tool' });
  });
});
