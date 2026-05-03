import { test, expect } from '@playwright/test';

test.describe('Sentinel Dashboard E2E', () => {
  test('should toggle AI mode and show pending approvals', async ({ page }) => {
    // Note: This requires the dashboard and socket server to be running.
    // In a real CI environment, we would start them here.
    await page.goto('http://localhost:3005/dashboard/index.html');

    const aiToggle = page.locator('#ai-toggle');
    const aiStatus = page.locator('#ai-status-label');

    // Initial state
    await expect(aiStatus).toHaveText('ON');

    // Toggle OFF
    await aiToggle.click();
    await expect(aiStatus).toHaveText('OFF');

    // Pending section should be visible
    await expect(page.locator('#pending-approvals-section')).toBeVisible();

    // Toggle ON
    await aiToggle.click();
    await expect(aiStatus).toHaveText('ON');
    await expect(page.locator('#pending-approvals-section')).toBeHidden();
  });

  test('should switch tabs correctly', async ({ page }) => {
    await page.goto('http://localhost:3005/dashboard/index.html');

    const operationsTab = page.locator('#tab-operations');
    await operationsTab.click();

    await expect(page.locator('#view-operations')).toBeVisible();
    await expect(page.locator('#view-terminal')).toBeHidden();

    const auditTab = page.locator('#tab-audit');
    await auditTab.click();
    await expect(page.locator('#view-audit')).toBeVisible();
  });
});
