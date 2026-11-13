// Ensure captured expected values continue to reflect main's implementation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { splitTransaction } = require('../app/src/main/assets/src/domain/reports.js');

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../app_flutter/test/fixtures/main_report_split.json'), 'utf8',
));

test('Flutter report split fixtures match main', () => {
  assert.ok(fixture.cases.length >= 300);
  for (const example of fixture.cases) {
    // JSON normalizes JavaScript -0 to 0 in the stored fixtures.
    const actual = JSON.parse(JSON.stringify(splitTransaction(
      example.transaction, fixture.accounts, example.allTransactions,
    )));
    assert.deepStrictEqual(actual, example.expected, example.name);
  }
});
