/*
 * قفل خروجی میزسنج گزارش‌ها (مرحله ۷.۳)
 *
 * میزسنج کامل (۱k تا ۱۰۰k) در CI اجرا نمی‌شود چون چند ثانیه طول می‌کشد؛ اما:
 *   ۱) یک اجرای کوچک واقعی (۱k و ۵k) در فرآیند جدا اجرا می‌شود و برابری خروجی و برتری سرعت را
 *      همان‌جا ثابت می‌کند.
 *   ۲) سند ثبت‌شده‌ی docs/report-bench.json بررسی می‌شود که همه‌ی مقیاس‌های خواسته‌شده را دارد و
 *      در همه‌ی آن‌ها `equal: true` است — یعنی عدد سریع‌تر هرگز با عدد متفاوت به‌دست نیامده.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const bench = path.join(root, 'tools/bench/report-bench.cjs');

test('the recorded benchmark covers 1k/10k/50k/100k and every scale is equal', () => {
  const recorded = JSON.parse(fs.readFileSync(path.join(root, 'docs/report-bench.json'), 'utf8'));
  const scales = recorded.datasets.map((dataset) => dataset.n);
  assert.deepEqual(scales, [1000, 10000, 50000, 100000]);
  assert.equal(recorded.accounts, 75);
  for (const dataset of recorded.datasets) {
    assert.equal(dataset.equal, true, `مقیاس ${dataset.n} باید برابر باشد`);
    assert.ok(dataset.speedup > 1.5, `مقیاس ${dataset.n}: موتور باید دست‌کم ۱.۵ برابر سریع‌تر باشد`);
    assert.equal(dataset.core.totalMs > dataset.engine.totalMs, true);
  }
});

test('a live small run proves equality and speed on the same code path', () => {
  const raw = execFileSync(process.execPath, [bench, '--scales=1000,5000'], {
    encoding: 'utf8', timeout: 180000, maxBuffer: 64 * 1024 * 1024,
  });
  const result = JSON.parse(raw.slice(raw.indexOf('{')));
  assert.deepEqual(result.datasets.map((dataset) => dataset.n), [1000, 5000]);
  for (const dataset of result.datasets) {
    assert.equal(dataset.equal, true, `اجرای زنده، مقیاس ${dataset.n}`);
    assert.ok(dataset.speedup > 1.5,
      `اجرای زنده، مقیاس ${dataset.n}: سرعت ${dataset.speedup}× کمتر از انتظار است`);
    assert.equal(dataset.engine.totalMs < dataset.core.totalMs, true);
  }
});
