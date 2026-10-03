const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const err = []; p.on('pageerror', e => err.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') err.push('CONSOLE ' + m.text().slice(0, 300)); });
  await p.goto('file://' + path.join(__dirname, 'harness/index.html'));
  await p.waitForTimeout(3000);
  await p.screenshot({ path: process.argv[2] || '/tmp/smoke.png' });
  console.log(await p.evaluate(() => document.querySelector('#app').innerText.slice(0, 500)));
  console.log(err.join('\n'));
  await b.close();
})();
