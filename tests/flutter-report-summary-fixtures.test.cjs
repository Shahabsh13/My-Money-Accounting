// Lock Flutter's report summary examples to the existing main implementation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { summarizeReports } = require('../app/src/main/assets/src/domain/reports.js');
const fixtureDir = path.join(__dirname, '../app_flutter/test/fixtures');
const scenarios = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'main_account_balance.json'), 'utf8'));
const fixture = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'main_report_summary.json'), 'utf8'));

test('Flutter report summary examples match main', () => {
  for (const item of fixture.results) {
    const scenario = scenarios[item.scenarioIndex];
    assert.deepStrictEqual(summarizeReports(scenario.transactions, scenario.accounts, null, item.installments), item.expected);
  }
  for (const item of fixture.standalone) {
    assert.deepStrictEqual(summarizeReports(item.transactions, item.accounts, null, item.installments), item.expected);
  }
});
