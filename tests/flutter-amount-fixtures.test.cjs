// Lock the Flutter examples to main's actual number-formatting implementation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const numbers = require('../app/src/main/assets/src/domain/numbers.js');

const fixtures = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../app_flutter/test/fixtures/main_amount_format.json'), 'utf8',
));

test('Flutter amount fixtures match main', () => {
  assert.ok(fixtures.length > 0);
  for (const { value, format, expected } of fixtures) {
    assert.equal(numbers.formatAmount(value, format), expected, `${value}, ${format}`);
  }
});
