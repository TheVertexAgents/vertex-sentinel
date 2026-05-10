import { test, expect } from '@playwright/test';

test('Sentinel Dashboard Walkthrough', async ({ page }) => {
  // 1. Load Dashboard
  await page.goto('http://localhost:3005/dashboard/index.html');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'docs/demo/01-risk-terminal.png' });

  // 2. Open Session Report
  await page.click('#session-report-btn');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'docs/demo/02-session-report.png' });
  await page.click('#close-pnl-modal');

  // 3. Switch to HITL Tab
  await page.click('#tab-hitl');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/demo/03-hitl-tab.png' });

  // 4. Switch to Operations Tab
  await page.click('#tab-operations');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/demo/04-agent-operations.png' });

  // 5. Switch to Audit Tab
  await page.click('#tab-audit');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'docs/demo/05-technical-audit.png' });

  console.log('Walkthrough screenshots saved to docs/demo/');
});
