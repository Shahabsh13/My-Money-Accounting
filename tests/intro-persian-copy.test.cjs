const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('intro descriptions use Persian ezafe instead of attaching yeh to final heh', () => {
 const source = fs.readFileSync('app/src/main/assets/src/scripts/217-hesabno-first-run-profile.js', 'utf8');
 assert.ok(source.includes('درآمد و هزینهٔ ماهانه'));
 assert.ok(source.includes('مقایسهٔ ماهانه، توزیع هزینه‌ها'));
 assert.doesNotMatch(source, /هزینهی|مقایسهی/);
});
