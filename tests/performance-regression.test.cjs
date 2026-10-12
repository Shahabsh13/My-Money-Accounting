const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
const externalScripts = [...html.matchAll(/<script\b([^>]*)>/gi)]
  .map(match => ({ attributes: match[1], index: match.index }))
  .filter(script => /\bsrc\s*=/i.test(script.attributes));

function srcOf(script) {
  const match = script.attributes.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
  return match ? match[2] : '';
}

test('external application scripts do not block HTML parsing', () => {
  assert.ok(externalScripts.length >= 100, 'the application script inventory should be present');
  const blocking = externalScripts.filter(script =>
    !/\bdefer\b/i.test(script.attributes) && !/\basync\b/i.test(script.attributes)
  );
  assert.deepEqual(blocking.map(srcOf), [], 'external scripts in index.html must not block document parsing');
  assert.equal(externalScripts.filter(script => /\basync\b/i.test(script.attributes)).length, 0,
    'do not use async because scripts patch shared app behavior and require source order');
});

test('deferred scripts preserve the core and UI-fix execution order', () => {
  const sources = externalScripts.map(srcOf);
  const critical = [
    'src/scripts/000-default-accounts.js',
    'src/scripts/001-hesabno-perf-guard.js',
    'src/scripts/066-inline.js',
    'src/scripts/067-inline.js',
    'src/scripts/194-hesabno-loan-linked-transaction-actions.js',
    'src/scripts/214-hesabno-numeric-keyboard.js',
    'src/scripts/220-hesabno-stable-tab-geometry.js',
  ];
  const positions = critical.map(name => sources.findIndex(src => src.startsWith(name)));
  assert.ok(positions.every(index => index >= 0), 'all critical scripts should remain included');
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b),
    'defer must retain the existing script order relied on by patches and UI fixes');
});
