import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});

test('10-Minute Dark Cinematic Walkthrough', async ({ page }) => {
  await page.goto('http://localhost:3006/onboarding.html');

  // Inject visual cursor
  await page.addStyleTag({ content: `
    .playwright-mouse-pointer {
      position: absolute;
      width: 30px;
      height: 30px;
      background: rgba(0, 229, 255, 0.4);
      border: 3px solid cyan;
      border-radius: 50%;
      pointer-events: none;
      z-index: 10000000;
      transform: translate(-50%, -50%);
      transition: width 0.2s, height 0.2s, background 0.2s;
    }
    .playwright-mouse-pointer.clicking {
      width: 25px;
      height: 25px;
      background: rgba(255, 0, 0, 0.6);
      border-color: white;
    }
  ` });

  await page.evaluate(() => {
    const cursor = document.createElement("div");
    cursor.id = "fake-cursor";
    cursor.classList.add("playwright-mouse-pointer");
    document.body.appendChild(cursor);
    document.addEventListener("mousemove", (e) => {
      cursor.style.left = e.pageX + "px";
      cursor.style.top = e.pageY + "px";
    });
    document.addEventListener("mousedown", () => cursor.classList.add("clicking"));
    document.addEventListener("mouseup", () => cursor.classList.remove("clicking"));
  });

  await page.evaluate(() => {
    localStorage.setItem('DEMO_MODE', 'true');
    localStorage.setItem('THEME', 'dark');
    document.body.classList.add('dark-theme');
    localStorage.removeItem('USER_ADDRESS');
    localStorage.removeItem('AGENT_ID');
  });
  await page.reload();

  // Scene 1: The Vision - 45s
  console.log('Scene 1: Onboarding Start (Dark)');
  await page.mouse.move(960, 540);
  await page.waitForTimeout(30000);

  // Step 1: Connect Wallet
  console.log('Action: Connect Wallet');
  const connectBtn = page.locator('#btn-connect');
  await connectBtn.hover();
  await page.waitForTimeout(2000);
  await connectBtn.click();
  await page.waitForTimeout(15000);

  // Scene 2: Identity Minting - 60s
  console.log('Scene 2: Identity Minting');
  const nameInput = page.locator('#agent-name');
  await nameInput.click();
  await page.keyboard.type('Sentinel-Obsidian-Ultimate', { delay: 100 });
  await page.waitForTimeout(5000);
  const mintBtn = page.locator('#btn-mint');
  await mintBtn.hover();
  await page.waitForTimeout(2000);
  await mintBtn.click();
  await page.waitForTimeout(25000);

  // Step 3: Personality Archetypes - 60s
  console.log('Scene 3: Personality Selection');
  await page.locator('#p-scout').click();
  await page.waitForTimeout(5000);
  await page.locator('#p-predator').click();
  await page.waitForTimeout(10000);
  const personalityBtn = page.locator('#btn-personality');
  await personalityBtn.hover();
  await page.waitForTimeout(2000);
  await personalityBtn.click();
  await page.waitForTimeout(15000);

  // Step 4: Risk Parameters & Guardrails - 60s
  console.log('Scene 4: Guardrail Configuration');
  const maxPosSlider = page.locator('#max-pos');
  await maxPosSlider.hover();
  await page.waitForTimeout(2000);
  await maxPosSlider.evaluate((el: HTMLInputElement) => el.value = '9800');
  await maxPosSlider.dispatchEvent('input');
  await page.waitForTimeout(15000);

  const configBtn = page.locator('#btn-config');
  await configBtn.hover();
  await page.waitForTimeout(2000);
  await configBtn.click();
  await page.waitForTimeout(20000);

  // Scene 5: Terminal Entry
  console.log('Scene 5: Dark Terminal Entry');
  await page.goto('http://localhost:3006/index.html');
  await page.evaluate(() => {
    localStorage.setItem('THEME', 'dark');
    document.body.classList.add('dark-theme');
  });
  await page.reload();
  await page.waitForTimeout(30000);

  // Scene 6: Risk Terminal Exploration (Filled with data)
  console.log('Scene 6: Data Visualization');
  await page.locator('#metric-total-pnl').hover();
  await page.waitForTimeout(15000);
  await page.locator('#risk-radar').hover();
  await page.waitForTimeout(20000);
  await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
  await page.waitForTimeout(20000);

  // Scene 7: AI Transparency (Deep-Dive)
  console.log('Scene 7: AI Reasoning Deep-Dive');
  const deepDiveBtn = page.locator('button:has-text("Deep Dive")').first();
  if (await deepDiveBtn.isVisible()) {
    await deepDiveBtn.hover();
    await page.waitForTimeout(2000);
    await deepDiveBtn.click();
    await page.waitForTimeout(30000);
    await page.locator('#close-reasoning-modal').click();
    await page.waitForTimeout(10000);
  }

  // Scene 8: Strategic Calibration (Operations Tab)
  console.log('Scene 8: Operations');
  await page.locator('#side-operations').click();
  await page.waitForTimeout(20000);

  const sentWeight = page.locator('#slider-sent-weight');
  await sentWeight.hover();
  await page.waitForTimeout(2000);
  await sentWeight.evaluate((el: HTMLInputElement) => el.value = '0.92');
  await sentWeight.dispatchEvent('input');
  await page.waitForTimeout(15000);

  const liqFloor = page.locator('#slider-liq-floor');
  await liqFloor.hover();
  await page.waitForTimeout(2000);
  await liqFloor.evaluate((el: HTMLInputElement) => el.value = '45000');
  await liqFloor.dispatchEvent('input');
  await page.waitForTimeout(15000);

  await page.locator('#update-risk-btn').click();
  await page.waitForTimeout(15000);

  // Scene 9: Human-in-the-Loop (HITL) - The Approval
  console.log('Scene 9: HITL Approval Flow');
  await page.locator('#side-hitl').click();
  await page.waitForTimeout(25000);

  const approveBtn = page.getByRole('button', { name: /Approve/i }).first();
  if (await approveBtn.isVisible()) {
    await approveBtn.hover();
    await page.waitForTimeout(2000);
    await approveBtn.click();
    await page.waitForTimeout(20000);
  }

  // Scene 10: ESG Sentinel
  console.log('Scene 10: ESG Monitoring');
  await page.locator('#side-esg').click();
  await page.waitForTimeout(30000);
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
  await page.waitForTimeout(20000);

  // Scene 11: Fleet Scale
  console.log('Scene 11: Fleet Management');
  await page.locator('#side-fleet').click();
  await page.waitForTimeout(25000);
  const hireBtn = page.locator('#hire-agent-fleet-btn');
  await hireBtn.hover();
  await page.waitForTimeout(3000);
  await hireBtn.click();
  await page.waitForTimeout(20000);
  await page.locator('#close-modal').click();
  await page.waitForTimeout(10000);

  // Scene 12: Technical Audit
  console.log('Scene 12: Audit Proofs');
  await page.locator('#side-audit').click();
  await page.waitForTimeout(25000);
  await page.evaluate(() => {
    const table = document.querySelector('.overflow-x-auto');
    if (table) table.scrollBy({ top: 1200, behavior: 'smooth' });
  });
  await page.waitForTimeout(30000);

  // Scene 13: Session Report
  console.log('Scene 13: Final Report');
  await page.locator('#side-terminal').click();
  await page.waitForTimeout(15000);
  await page.locator('#session-report-btn').click();
  await page.waitForTimeout(40000);
  await page.locator('#close-pnl-modal').click();
  await page.waitForTimeout(15000);

  // Outro
  console.log('Scene 14: Dark Outro');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(40000);

  console.log('10-Minute Dark Walkthrough Complete.');
});
