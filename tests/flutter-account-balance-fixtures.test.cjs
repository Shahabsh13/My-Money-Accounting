// Verify fixture results against the original domain before using them in Dart.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { accountBalance } = require('../app/src/main/assets/src/domain/accounts.js');
const scenarios = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../app_flutter/test/fixtures/main_account_balance.json'), 'utf8',
));

test('Flutter account balance examples match main', () => {
  assert.ok(scenarios.length >= 10);
  for (const scenario of scenarios) {
    scenario.accounts.forEach((account, index) => {
      assert.deepStrictEqual(accountBalance(account, scenario.accounts, scenario.transactions),
        scenario.expected[index], account.name);
    });
  }
});
