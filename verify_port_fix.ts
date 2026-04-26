import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 }
  });
  const page = await context.newPage();

  // Try the new port
  await page.goto('http://localhost:3005/index.html');
  await page.waitForTimeout(3000);

  console.log('Taking Risk Terminal screenshot from port 3005...');
  await page.screenshot({ path: 'pro_terminal_port_3005.png' });

  await browser.close();
})();
