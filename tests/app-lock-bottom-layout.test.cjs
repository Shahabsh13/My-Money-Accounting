const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync('app/src/main/assets/index.html', 'utf8');
const bundle = fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js', 'utf8');

test('app-lock PIN keypad is pushed to the safe-area bottom', () => {
  assert.ok(index.includes('src/scripts/067-inline.js?v=2026103008'), 'the updated lock layout must use a fresh cache key');
  const start = bundle.indexOf('id:"hesabno-app-lock-overlay"');
  const end = bundle.indexOf('),z&&e.jsx("div"', start);
  assert.ok(start >= 0 && end > start, 'the app-lock overlay markup is present');
  const lock = bundle.slice(start, end);

  assert.ok(lock.includes('justify-start overflow-y-auto no-scrollbar px-6'), 'lock content starts at the top of the viewport');
  assert.ok(lock.includes('paddingTop:"max(24px, env(safe-area-inset-top))"'));
  assert.ok(lock.includes('paddingBottom:"max(16px, env(safe-area-inset-bottom))"'), 'the lock respects the bottom safe area');
  assert.ok(lock.includes('style:{flex:"1 1 auto",minHeight:0,padding:0,background:"transparent"'), 'the content column fills the available screen without a tall card');
  assert.ok(lock.includes('style:{marginTop:"auto"}'), 'the PIN keypad is pushed down after the lock instructions');
  assert.ok(lock.indexOf('style:{marginTop:"auto"}') < lock.indexOf('data-hesabno-biometric-unlock'), 'biometric access remains below the keypad at the bottom');
});
