const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {parseCss} = require('../tools/bench/css-parser.cjs');
test('global placeholder rule uses a fixed 12px size without resizing actual values', () => {
 const css = fs.readFileSync('app/src/main/assets/src/styles/235-hesabno-text-root-and-display-stability.css', 'utf8');
 const rule = parseCss(css).rules.at(-1);
 assert.match(rule.selector, /html body input\[placeholder\]::placeholder/);
 assert.match(rule.selector, /html body textarea\[placeholder\]::placeholder/);
 assert.ok(rule.selector.split(',').every(selector => selector.trim().endsWith('::placeholder')));
 assert.match(rule.body, /font-size:\s*12px\s*!important/);
 assert.ok(css.lastIndexOf('font-size: 12px !important;') > css.lastIndexOf('[data-hesabno-transaction-search]::placeholder'));
});
