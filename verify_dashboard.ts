import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 }
  });
  const page = await context.newPage();

  console.log('Navigating to Sentinel Risk Terminal...');
  await page.goto('http://localhost:3005/dashboard/index.html', { waitUntil: 'networkidle' });

  // Wait for data to render
  await page.waitForTimeout(5000);

  console.log('Taking dashboard screenshot...');
  await page.screenshot({ path: 'dashboard_verification.png', fullPage: true });

  await browser.close();
  console.log('Done!');
})();
