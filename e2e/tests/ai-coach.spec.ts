import { test, expect } from '@playwright/test';

/**
 * AI 训练决策舱 E2E。
 * 用 Playwright route mock 拦截 chat 接口，不依赖真实 AI key：
 *   1) 页面加载展示欢迎语
 *   2) 输入训练诉求 → 发送 → 用户消息与 AI 回复均出现在消息流
 *   3) 会话列表可加载
 */

const MOCK_REPLY =
  '### E2E 推演结果\n\n按 46T 牙盘 + 11-28T 飞轮推算，平路 20km/h 巡航推荐挂 **第 4 档**，维持 90rpm 踏频，节奏稳定。';

test.describe('AI 训练决策舱', () => {
  test('发送训练诉求并收到 AI 回复', async ({ page }) => {
    // 拦截 AI chat 接口，返回固定回复
    await page.route('**/api/ai/coach/*/chat', (route) => {
      const req = route.request();
      const postData = req.postDataJSON ? req.postDataJSON() : {};
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reply: MOCK_REPLY,
          toolCalls: [],
        }),
      });
    });

    await page.goto('/ai-coach', { waitUntil: 'domcontentloaded' });

    // 欢迎语
    await expect(page.getByText('战术与生理诊断就绪')).toBeVisible({ timeout: 15000 });

    // 输入训练诉求
    const composer = page.locator('textarea[placeholder*="输入训练诉求"]');
    await expect(composer).toBeVisible();
    await composer.fill('今天平路骑了 20 公里，求推荐档位与踏频');

    // 等待 React 状态更新后发送按钮变为可用，再点击发送
    // 避免 fill 后直接 press('Enter') 读取到尚未刷新的 input 状态
    await expect(page.getByRole('button', { name: '推演执行' })).toBeEnabled({ timeout: 5000 });
    await page.getByRole('button', { name: '推演执行' }).click();

    // 用户消息出现
    await expect(page.getByText('今天平路骑了 20 公里，求推荐档位与踏频')).toBeVisible({
      timeout: 10000,
    });

    // AI mock 回复出现
    await expect(page.getByText('E2E 推演结果')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('第 4 档')).toBeVisible({ timeout: 10000 });
  });

  test('会话侧栏可展开并显示当前会话', async ({ page }) => {
    await page.goto('/ai-coach', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('战术与生理诊断就绪')).toBeVisible({ timeout: 15000 });

    // 侧栏标题「训练决策舱」与当前会话「主方案流」
    await expect(page.getByRole('heading', { name: '训练决策舱' })).toBeVisible();
    await expect(page.getByText('主方案流')).toBeVisible({ timeout: 10000 });
  });
});