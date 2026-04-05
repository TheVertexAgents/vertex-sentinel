import { chromium } from 'playwright';
import fs from 'fs';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 1200 });

  const auditData = fs.readFileSync('logs/audit.json', 'utf8').trim().split('\n').map(line => JSON.parse(line));
  await page.goto('http://localhost:3000/dashboard/index.html');

  await page.evaluate((data) => {
    const logBody = document.getElementById('log-body');
    logBody.innerHTML = '';
    let signedCount = 0;
    data.reverse().forEach(entry => {
        if (!entry.message) return;
        const msg = entry.message;
        const date = new Date(parseInt(msg.timestamp) * 1000).toLocaleString();
        const amount = (parseFloat(msg.amountUsdScaled) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        const confidence = (parseInt(msg.confidenceScaled) / 10).toFixed(1) + '%';
        const row = document.createElement('tr');
        row.className = "border-b border-white/5 hover:bg-white/5 transition-colors";
        const actionClass = msg.action === 'BUY' ? 'text-green-400' : msg.action === 'SELL' ? 'text-red-400' : 'text-yellow-400';
        if (entry.signature) signedCount++;
        row.innerHTML = `
            <td class="px-6 py-4 text-xs font-mono text-gray-400">${date}</td>
            <td class="px-6 py-4 font-bold ${actionClass}">${msg.action}</td>
            <td class="px-6 py-4 font-mono">${msg.pair}</td>
            <td class="px-6 py-4">${amount}</td>
            <td class="px-6 py-4 font-mono">${confidence}</td>
            <td class="px-6 py-4">
                <span class="flex items-center gap-1 text-cyan text-xs">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
                    SIGNED
                </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-300 max-w-xs truncate" title="${entry.reasoning}">
                ${entry.reasoning}
            </td>
        `;
        logBody.appendChild(row);
    });
    document.getElementById('stat-total').textContent = data.filter(e => e.message).length;
    document.getElementById('stat-signed').textContent = signedCount;
  }, auditData);

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'audit_trail_live.png', fullPage: true });
  await browser.close();
  console.log('Screenshot saved to audit_trail_live.png');
})();
