import { test, expect, type Page } from '@playwright/test';

/**
 * Web 端仪表盘 + 骑行详情联动 E2E。
 * 前提：API 在开放模式运行（未设 ADMIN_TOKEN）。
 * 通过 API 直接写入一条唯一标题的测试骑行，再验证：
 *   1) 仪表盘列表展示该骑行与核心指标
 *   2) 点击卡片进入详情页，指标/地图/图表渲染
 *   3) 返回仪表盘
 *
 * 设计要点：
 * - describe 设为 serial 模式：全部用例在单个 worker 串行执行，beforeAll 只播种一次，
 *   避免 fullyParallel 下多 worker 用相同标题重复播种导致 getByText 命中多个元素。
 * - 标题带随机后缀 + 卡片用 a[href=/ride/:id] 定位，天然免疫历史残留数据。
 */

const UNIQUE_TITLE = `晨间测试骑行 e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
let rideId = '';

async function seedTestRide(): Promise<string> {
  const now = Date.now();
  const id = `e2e-${now}`;
  const body = {
    id,
    title: UNIQUE_TITLE,
    start_time: now - 600000,
    end_time: now,
    elapsed_time_seconds: 600,
    moving_time_seconds: 540,
    distance_meters: 2666.6,
    max_speed_kmh: 21.2,
    avg_speed_kmh: 16.0,
    total_ascent_meters: 7,
    total_descent_meters: 5,
    max_altitude_meters: 15,
    avg_heart_rate: 123,
    max_heart_rate: 133,
    avg_cadence: 87,
    max_cadence: 90,
    calories: 92,
    hr_z1_seconds: 0,
    hr_z2_seconds: 0,
    hr_z3_seconds: 360,
    hr_z4_seconds: 180,
    hr_z5_seconds: 0,
    start_lat: 30.283,
    start_lng: 120.161,
    summary_polyline: 'ir|wF`ffuMyx@h@}@u@c@`@',
    created_at: now,
  };

  const res = await fetch('http://localhost:8787/api/admin/rides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Seed ride failed (${res.status}): ${await res.text()}`);
  return id;
}

test.describe('Web 仪表盘 + 骑行详情联动', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    rideId = await seedTestRide();
  });

  // 按唯一 href 定位该骑行卡片，避免与历史残留的同标题数据冲突
  function rideCard(page: Page) {
    return page.locator(`a[href="/ride/${rideId}"]`);
  }

  test('仪表盘展示已上传的骑行记录与核心指标', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const card = rideCard(page);
    await expect(card).toBeVisible({ timeout: 20000 });

    // 卡片核心指标：2.7 公里 / 停表均速 17.8 / 总均速 16 / 爬升 7m
    await expect(card.getByText('2.7')).toBeVisible({ timeout: 10000 });
    await expect(card.getByText('17.8')).toBeVisible();
    await expect(card.getByText('总均速 16')).toBeVisible();
    await expect(card.getByText('7m')).toBeVisible();
  });

  test('点击卡片进入详情页，指标/地图/图表渲染', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const card = rideCard(page);
    await expect(card).toBeVisible({ timeout: 20000 });
    await card.click();

    // 进入详情页
    await page.waitForURL(new RegExp(`/ride/${rideId}`), { timeout: 15000 });
    await expect(page.getByText(UNIQUE_TITLE).first()).toBeVisible({ timeout: 15000 });

    // 指标卡：骑行总里程 2.67 公里 / 停表均速 17.8 km/h
    await expect(page.getByText('骑行总里程')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('2.67').first()).toBeVisible();
    await expect(page.getByText('停表均速')).toBeVisible();
    await expect(page.getByText('17.8').first()).toBeVisible();

    // 返回按钮存在
    await expect(page.getByRole('button', { name: '返回仪表盘' })).toBeVisible();

    // 地图容器渲染（maplibre）
    await expect(page.locator('.maplibregl-map')).toBeVisible({ timeout: 15000 });
    // 海拔/速度图表 canvas 渲染
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  });

  test('详情页返回仪表盘', async ({ page }) => {
    await page.goto(`/ride/${rideId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: '返回仪表盘' })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('button', { name: '返回仪表盘' }).click();
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
    await expect(rideCard(page)).toBeVisible({ timeout: 15000 });
  });
});
