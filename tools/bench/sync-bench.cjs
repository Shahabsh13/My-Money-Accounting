#!/usr/bin/env node
/*
 * میزسنج قرارداد همگام‌سازی (مرحله ۹)
 *
 * چه چیزی را اندازه می‌گیرد؟
 *   • bytesRaw   → حجم JSON داده‌ی خام (آرایه‌ها، همان چیزی که امروز ذخیره می‌شود)
 *   • bytesDoc   → حجم سند همگام‌سازی (متعارف + شماره‌ی نسخه)
 *   • overhead   → درصد افزونگی سند نسبت به داده‌ی خام
 *   • buildMs    → ساخت سند
 *   • mergeMs    → ادغام سه‌طرفه با تغییرهای یک‌طرفه‌ی متقارن
 *   • conflicts  → تعداد تعارض واقعی (باید صفر باشد: تغییرها جدا انتخاب می‌شوند)
 *   • equal      → برابری نتیجه با انتظار دقیق (تغییرها اعمال، بقیه دست‌نخورده)
 *
 * خروجی JSON. کاربرد:
 *   node tools/bench/sync-bench.cjs [--scales=1000,10000,50000] [--out docs/sync-bench.json]
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const sync = require(path.join(ROOT, "app/src/main/assets/src/domain/sync.js"));
const { makeAccounts, makeTransactions, makeInstallments } = require(path.join(ROOT, "tests/helpers/reporting-corpus.cjs"));

const scalesArg = (process.argv.find((value) => value.startsWith("--scales=")) || "").split("=")[1];
const SCALES = scalesArg ? scalesArg.split(",").map(Number).filter(Boolean) : [1000, 10000, 50000];
const outIndex = process.argv.indexOf("--out");
const OUT = outIndex > -1 ? process.argv[outIndex + 1] : null;
const RUNS = 3;

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function timeOnce(callback) {
  const started = process.hrtime.bigint();
  const value = callback();
  return { value, ms: Number(process.hrtime.bigint() - started) / 1e6 };
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

const accounts = makeAccounts();
const installments = makeInstallments(5);
const datasets = [];

for (const scale of SCALES) {
  const transactions = makeTransactions(scale, 77);
  const baseModel = { accounts, transactions, installments };
  const localModel = clone(baseModel);
  const remoteModel = clone(baseModel);

  const editCount = Math.min(50, Math.floor(scale / 100));
  for (let index = 0; index < editCount; index += 1) {
    localModel.transactions[index].amount += 1;
    remoteModel.transactions[scale - 1 - index].amount += 2;
  }
  /* یک افزوده‌ی مقابل تا مسیر «افزودن» هم در هر مقیاس آزموده شود */
  remoteModel.transactions.push({ id: "bench-new", date: "1405/10/01", type: "expense", amount: 4321 });

  const bytesRaw = Buffer.byteLength(JSON.stringify(baseModel), "utf8");

  const buildRuns = [];
  let base, local, remote;
  for (let run = 0; run < RUNS; run += 1) {
    const built = timeOnce(() => {
      base = sync.buildDocument(baseModel).document;
      local = sync.buildDocument(localModel).document;
      remote = sync.buildDocument(remoteModel).document;
      return { base, local, remote };
    });
    buildRuns.push(built.ms);
  }
  const bytesDoc = Buffer.byteLength(JSON.stringify(base), "utf8");

  const mergeRuns = [];
  let result = null;
  for (let run = 0; run < RUNS; run += 1) {
    const merged = timeOnce(() => sync.merge(base, local, remote));
    result = merged.value;
    mergeRuns.push(merged.ms);
  }

  /* گواه درستی: تغییرهای هر دو طرف اعمال شده، بقیه دست‌نخورده، هیچ تعارضی نیست */
  const mergedCollections = sync.toCollections(result.document);
  let equal = result.ok && result.conflicts.length === 0;
  if (equal) {
    equal = mergedCollections.transactions.length === scale + 1
      && mergedCollections.transactions[0].amount === localModel.transactions[0].amount
      && mergedCollections.transactions[scale - 1].amount === remoteModel.transactions[scale - 1].amount
      && mergedCollections.transactions[Math.floor(scale / 2)].amount === baseModel.transactions[Math.floor(scale / 2)].amount
      && mergedCollections.transactions[scale].id === "bench-new";
  }
  if (!equal) {
    process.stderr.write(`✗ ادغام مقیاس ${scale} درست نبود\n`);
    process.exit(1);
  }

  datasets.push({
    n: scale,
    accounts: accounts.length,
    bytesRaw,
    bytesDoc,
    overheadPercent: +(((bytesDoc - bytesRaw) / bytesRaw) * 100).toFixed(2),
    buildMs: +median(buildRuns).toFixed(1),
    mergeMs: +median(mergeRuns).toFixed(1),
    conflicts: result.conflicts.length,
    stats: result.stats,
    equal: true,
  });
  process.stderr.write(
    `n=${scale} · خام ${(bytesRaw / 1024).toFixed(0)}KB · سند ${(bytesDoc / 1024).toFixed(0)}KB` +
    ` (+${(((bytesDoc - bytesRaw) / bytesRaw) * 100).toFixed(1)}%) · ساخت ${median(buildRuns).toFixed(0)}ms` +
    ` · ادغام ${median(mergeRuns).toFixed(0)}ms · برابر ✓\n`
  );
}

const output = {
  root: ROOT,
  at: new Date().toISOString(),
  node: process.version,
  runsPerScale: RUNS,
  format: sync.format,
  version: sync.version,
  datasets,
};
const text = JSON.stringify(output, null, 2) + "\n";
if (OUT) fs.writeFileSync(OUT, text);
process.stdout.write(text);
