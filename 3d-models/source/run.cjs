const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  p.on('console', m => console.log('console:', m.text())); p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto('http://127.0.0.1:8765/build.html');
  await p.waitForFunction(() => window.DONE === true, null, { timeout: 180000 });
  const o = await p.evaluate(() => window.OUT);
  for (const [k, v] of Object.entries(o)) { const f = path.join(out, k); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.from(v, 'base64')); console.log(k, fs.statSync(f).size); }
  await b.close();
})();
