#!/usr/bin/env node
/*
 * میزسنج موتور گزارش‌ها (مرحله ۷.۳) — ۱k / ۱۰k / ۵۰k / ۱۰۰k
 *
 * چه چیزی اندازه می‌گیرد؟ دو مسیر **روی همان داده و همان حساب‌ها**:
 *   A) مسیر امروز برنامه: accountBalance برای هر حساب (پیمایش کامل اسناد برای هر حساب)
 *      + summarizeReports (که خودش دوباره برای هر حساب فعال همان کار را می‌کند).
 *   B) موتور تک‌گذر: ledger.balancesForAll + reporting.summarize از همان نتیجه.
 *
 * پیش از هر اندازه‌گیری، **برابری کامل خروجی دو مسیر** بررسی می‌شود؛ اگر یکی نباشد، ابزار با
 * کد ۱ بیرون می‌آید. بنابراین عدد سریع‌تر هرگز به‌بهای عدد متفاوت گزارش نمی‌شود.
 *
 * خروجی JSON: { at, node, accounts, datasets: [{n, core:{balancesMs, summaryMs, totalMs},
 *   engine:{balancesMs, summaryMs, totalMs, buildReportMs}, equal, bytes}] }
 *
 * کاربرد:
 *   node tools/bench/report-bench.cjs                       # ۱k/۱۰k/۵۰k/۱۰۰k
 *   node tools/bench/report-bench.cjs --scales=1000,10000   # مقیاس دلخواه
 *   node tools/bench/report-bench.cjs --out docs/report-bench.json
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const ledger = require(path.join(ROOT, 'app/src/main/assets/src/domain/ledger.js'));
const reporting = require(path.join(ROOT, 'app/src/main/assets/src/domain/reporting.js'));
const reportsDomain = require(path.join(ROOT, 'app/src/main/assets/src/domain/reports.js'));
const accountsDomain = require(path.join(ROOT, 'app/src/main/assets/src/domain/accounts.js'));
const { expandAccounts, makeTransactions, makeInstallments } = require(path.join(ROOT, 'tests/helpers/reporting-corpus.cjs'));

const scalesArg = (process.argv.find((value) => value.startsWith('--scales=')) || '').split('=')[1];
const SCALES = scalesArg
  ? scalesArg.split(',').map((value) => Number(value.trim())).filter((value) => value > 0)
  : [1000, 10000, 50000, 100000];
const outIndex = process.argv.indexOf('--out');
const OUT = outIndex > -1 ? process.argv[outIndex + 1] : null;
const RUNS = 3;

/* ۷۵ حساب: سه نسخه از مجموعه‌ی آزمایشی با شناسه/نام یکتا (شبیه فهرست پیش‌فرض واقعی) */
const ACCOUNTS = expandAccounts(3);

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function timeOnce(callback) {
  const started = process.hrtime.bigint();
  const value = callback();
  return { value, ms: Number(process.hrtime.bigint() - started) / 1e6 };
}

function compareRows(coreRows, engineRows) {
  for (let index = 0; index < coreRows.length; index += 1) {
    for (const field of ["balance", "initialBalance", "totalDebits", "totalCredits", "transactionCount", "entriesCount"]) {
      if (coreRows[index][field] !== engineRows[index][field]) {
        return `account ${index} field ${field}: ${coreRows[index][field]} vs ${engineRows[index][field]}`;
      }
    }
  }
  return null;
}

const INSTALLMENTS = makeInstallments(7);
const datasets = [];

for (const scale of SCALES) {
  const transactions = makeTransactions(scale, 41);
  const bytes = Buffer.byteLength(JSON.stringify(transactions), "utf8");

  /* ---------- A) مسیر امروز ---------- */
  const coreBalancesRuns = [];
  const coreSummaryRuns = [];
  let coreRows = null;
  let coreSummary = null;
  for (let run = 0; run < RUNS; run += 1) {
    const balances = timeOnce(() => ACCOUNTS.map((account) => accountsDomain.accountBalance(account, ACCOUNTS, transactions)));
    coreRows = balances.value;
    coreBalancesRuns.push(balances.ms);
    const summary = timeOnce(() => reportsDomain.summarizeReports(transactions, ACCOUNTS, [], INSTALLMENTS));
    coreSummary = summary.value;
    coreSummaryRuns.push(summary.ms);
  }

  /* ---------- B) موتور تک‌گذر ---------- */
  const engineBalancesRuns = [];
  const engineSummaryRuns = [];
  const buildRuns = [];
  let engineRows = null;
  let engineSummary = null;
  for (let run = 0; run < RUNS; run += 1) {
    const balances = timeOnce(() => ledger.balancesForAll(ACCOUNTS, transactions));
    engineRows = balances.value;
    engineBalancesRuns.push(balances.ms);
    const summary = timeOnce(() => reporting.summarize(ACCOUNTS, transactions, INSTALLMENTS, engineRows));
    engineSummary = summary.value;
    engineSummaryRuns.push(summary.ms);
    const build = timeOnce(() => reporting.buildReport({ accounts: ACCOUNTS, transactions, installments: INSTALLMENTS }));
    buildRuns.push(build.ms);
  }

  /* ---------- گواه برابری ---------- */
  const rowDifference = compareRows(coreRows, engineRows);
  const summaryEqual = JSON.stringify(coreSummary) === JSON.stringify(engineSummary);
  const equal = rowDifference === null && summaryEqual;
  if (!equal) {
    process.stderr.write(`✗ واگرایی در مقیاس ${scale}: ${rowDifference || "خلاصه برابر نیست"}\n`);
    process.exit(1);
  }

  const coreTotal = median(coreBalancesRuns) + median(coreSummaryRuns);
  const engineTotal = median(engineBalancesRuns) + median(engineSummaryRuns);
  datasets.push({
    n: scale,
    accounts: ACCOUNTS.length,
    bytes,
    core: {
      balancesMs: +median(coreBalancesRuns).toFixed(1),
      summaryMs: +median(coreSummaryRuns).toFixed(1),
      totalMs: +coreTotal.toFixed(1),
    },
    engine: {
      balancesMs: +median(engineBalancesRuns).toFixed(1),
      summaryMs: +median(engineSummaryRuns).toFixed(1),
      totalMs: +engineTotal.toFixed(1),
      buildReportMs: +median(buildRuns).toFixed(1),
    },
    speedup: +(coreTotal / engineTotal).toFixed(2),
    equal: true,
  });
  process.stderr.write(
    `n=${scale} · مسیر فعلی ${coreTotal.toFixed(0)}ms · موتور ${engineTotal.toFixed(0)}ms` +
    ` · ×${(coreTotal / engineTotal).toFixed(1)} · برابر ✓\n`
  );
}

const result = {
  root: ROOT,
  at: new Date().toISOString(),
  node: process.version,
  accounts: ACCOUNTS.length,
  runsPerScale: RUNS,
  datasets,
};
const text = JSON.stringify(result, null, 2) + "\n";
if (OUT) fs.writeFileSync(OUT, text);
process.stdout.write(text);
