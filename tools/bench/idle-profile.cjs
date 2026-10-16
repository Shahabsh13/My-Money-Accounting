/* پروفایل «آشوب بیکاری»: چه کدی پس از راه‌اندازی، مدام فریم/نوشتن ذخیره‌سازی می‌سازد؟ */
const fs = require('fs'); const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ASSETS = process.argv[2] || path.join(path.resolve(__dirname, '..', '..'), 'app/src/main/assets');
(async () => {
  const vc = new VirtualConsole();
  const dom = await JSDOM.fromFile(path.join(ASSETS, 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    url: 'http://127.0.0.1:8080/index.html' });
  const w = dom.window;
  await new Promise(res => { const iv = setInterval(() => { const r = w.document.getElementById('root'); if (r && r.innerHTML.length > 2000) { clearInterval(iv); res(); } }, 25); });
  

  const rafCounts = new Map(), writeCounts = new Map();
  const realRaf = w.requestAnimationFrame.bind(w);
  w.requestAnimationFrame = cb => {
    const stack = new Error().stack || '';
    const frame = stack.split('\n').map(l => l.trim()).find(l => /index\.html:\d+:\d+|\.js/.test(l) && !/bench|jsdom|node:/.test(l)) || 'unknown';
    rafCounts.set(frame, (rafCounts.get(frame) || 0) + 1);
    return realRaf(cb);
  };
  const proto = w.Storage && w.Storage.prototype;
  if (proto) { const real = proto.setItem; proto.setItem = function (k, v) { writeCounts.set(String(k), (writeCounts.get(String(k)) || 0) + 1); return real.call(this, k, v); }; }
  const realTimeout = w.setTimeout.bind(w); let timeouts = 0;
  w.setTimeout = (cb, d) => { timeouts++; return realTimeout(cb, d); };

  await new Promise(r => setTimeout(r, 3000));   // ۳ ثانیه اول پس از آماده‌شدن رابط
  const top = (m, n = 8) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  console.log(JSON.stringify({
    rafPerSecond: +([...rafCounts.values()].reduce((a, b) => a + b, 0) / 3).toFixed(1),
    timeoutsPerSecond: +(timeouts / 3).toFixed(1),
    storageWritesPerSecond: +([...writeCounts.values()].reduce((a, b) => a + b, 0) / 3).toFixed(2),
    topRafCallers: top(rafCounts).map(([k, v]) => `${v}× ${k.slice(0, 150)}`),
    topStorageKeys: top(writeCounts).map(([k, v]) => `${v}× ${k}`),
  }, null, 2));
  process.exit(0);
})();
