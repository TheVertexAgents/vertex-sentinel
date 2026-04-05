import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('http://localhost:3000/dashboard/index.html');
  await page.waitForTimeout(2000); // Wait for logs to load
  await page.screenshot({ path: 'audit_trail_screenshot.png', fullPage: true });
  await browser.close();
})();
