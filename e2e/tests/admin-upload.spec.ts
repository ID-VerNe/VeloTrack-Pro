import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ADMIN_URL = 'http://localhost:3001';
const FIXTURE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/晨间测试骑行.tcx'
);

/**
 * Admin「骑行数据同步与脱敏中心」端到端上传流程。
 * 前提：API 在开放模式运行（未设 ADMIN_TOKEN），auth 中间件放行所有请求。
 * 覆盖：拖入 TCX → 批量脱敏同步 → 成功状态。
 */

test.describe('Admin 上传 TCX 流程', () => {
  test('拖入 TCX 文件并成功上传到云端', async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });

    // 等待隐私圈加载完成（开放模式：空列表）
    await expect(page.getByText('拖入 TCX 或 GPX 骑行文件至此处')).toBeVisible({
      timeout: 15000,
    });

    // 上传 TCX 文件
    await page.locator('input[aria-label="选取或拖入骑行数据文件"]').setInputFiles(FIXTURE);
    await expect(page.getByText('待上传文件清单')).toBeVisible();
    await expect(page.getByText('晨间测试骑行.tcx')).toBeVisible();

    // 点击"一键脱敏并同步到云端"
    await page.getByRole('button', { name: /一键脱敏并同步/ }).click();

    // 等待批量上传并脱敏成功
    await expect(page.getByText('批量上传并脱敏成功！')).toBeVisible({ timeout: 30000 });

    // 成功态 4 秒后回到 idle，文件保留在待传清单（内部 stagedFiles 不清空）
    await expect(page.getByText(/已暂存 1 个骑行文件/)).toBeVisible({ timeout: 15000 });
  });
});