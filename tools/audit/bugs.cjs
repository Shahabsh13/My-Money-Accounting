#!/usr/bin/env node
/*
 * بازرسی باگ — ابزار قابل‌تکرار
 *
 * هر یافته با توابع **واقعی** برنامه (برش از باندل ۰۶۷) بازتولید می‌شود، نه با مدل بازنویسی‌شده.
 * اجرا: node tools/audit/bugs.cjs
 *
 * خروجی: برای هر مورد، وضعیت (BUG/SANE) + اعداد دقیق.
 */
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..", "..");
const { loadAccountingKernel } = require(path.join(ROOT, "tests/helpers/production-slices.cjs"));

const kernel = loadAccountingKernel();
const bundleSource = fs.readFileSync(path.join(ROOT, "app/src/main/assets/src/scripts/067-inline.js"), "utf8");
const findings = [];
function record(id, severity, title, detail, fixed) {
  findings.push({ id, severity, title, detail, status: fixed ? "اصلاح‌شده" : "باز" });
}

/* ---------- ابزار کمکی ---------- */

const ACCOUNTS = [
  { id: "a-bank", name: "بانک", group: "bank", active: true, initialBalance: 10000000 },
  { id: "a-pay", name: "اسناد پرداختنی", group: "liability", active: true },
  { id: "a-recv", name: "اسناد دریافتنی", group: "asset", active: true },
  { id: "a-rent", name: "اجاره", group: "expense", active: true },
  { id: "a-sales", name: "فروش", group: "income", active: true },
  { id: "a-ali", name: "علی", group: "person", active: true },
];

function trialBalance(transactions, accounts = ACCOUNTS) {
  let debits = 0;
  let credits = 0;
  for (const account of accounts) {
    const row = kernel.accountBalance(account, accounts, transactions);
    debits += Number(row.totalDebits || 0);
    credits += Number(row.totalCredits || 0);
  }
  return { debits, credits, diff: debits - credits, balanced: debits === credits };
}

function summary(transactions, accounts = ACCOUNTS) {
  return kernel.reportSummary(transactions, accounts, [], []);
}

const checkDoc = (status, type) => ({
  id: "chk-" + status + "-" + type,
  date: "1405/06/10",
  type: type,
  account: type === "expense" ? "اسناد پرداختنی" : "اسناد دریافتنی",
  category: type === "expense" ? "اجاره" : "فروش",
  amount: 700000,
  method: "check",
  check: { status: status, number: "1", linkedBank: "بانک" },
});

/* ---------- یافته ۱: چک برگشتی/مسترد تراز را می‌شکند ---------- */

{
  const rows = {};
  for (const status of ["in_progress", "cleared", "bounced", "refunded"]) {
    const doc = [checkDoc(status, "expense")];
    const t = trialBalance(doc);
    const s = summary(doc);
    const pnl = kernel.reportTotals(doc[0], ACCOUNTS);
    rows[status] = {
      "جمع بدهکار": t.debits,
      "جمع بستانکار": t.credits,
      "اختلاف": t.diff,
      "ارزش خالص": s.totalNetWorth,
      "هزینه در صورت سود و زیان": pnl.expense,
      "بدهی (اسناد پرداختنی)": s.totalPayables,
    };
  }
  const b1Fixed = ["bounced", "refunded"].every((status) => {
    const doc = [checkDoc(status, "expense")];
    const t = trialBalance(doc);
    return t.diff === 0 && kernel.reportTotals(doc[0], ACCOUNTS).expense === 0
      && summary(doc).totalNetWorth === 10000000;
  });
  record(
    "B1",
    "بالا",
    "چک برگشتی/مسترد تراز دوطرفه را می‌شکند و بدهی را بی‌صدا حذف می‌کند",
    {
      "توضیح": "قاعده‌ی مستند برنامه «اصل سند حذف، کارمزد می‌ماند» است؛ Cs این را اعمال می‌کند " +
        "ولی Nr فقط پای بدهی/طلب را حذف می‌کند و پای هزینه/درآمد را نگه می‌دارد.",
      "نتیجه": rows,
      "اثر کاربر": "در گزارش «ترازنامه آزمایشی» وضعیت «نامتوازن» چاپ می‌شود؛ ارزش خالص به اندازه‌ی مبلغ چک می‌پرد.",
      "بازتولید": "یک سند هزینه با چک به مبلغ ۷۰۰٬۰۰۰ ✓ ثبت کنید و وضعیت را «برگشت‌خورده» کنید.",
    },
    b1Fixed
  );
}

/* ---------- یافته ۲: پاک‌کردن چک بدون بانک، ارزش خالص را می‌پراند ---------- */

{
  const accounts = [
    { id: "a-bank", name: "بانک", group: "bank", active: true, initialBalance: 5000 },
    { id: "a-pay", name: "اسناد پرداختنی", group: "liability", active: true },
    { id: "a-rent", name: "اجاره", group: "expense", active: true },
  ];
  const make = (check) => [{
    id: "c", type: "expense", account: "اسناد پرداختنی", category: "اجاره",
    amount: 700, method: "check", check, date: "1405/01/01",
  }];
  const pending = make({ status: "in_progress" });
  const clearedNoBank = make({ status: "cleared" });
  const clearedWithBank = make({ status: "cleared", linkedBank: "بانک" });
  const pick = (tx) => {
    const s = summary(tx, accounts);
    return {
      "موجودی بانک": kernel.accountBalance(accounts[0], accounts, tx).balance,
      "بدهی": s.totalPayables,
      "ارزش خالص": s.totalNetWorth,
      "تراز": trialBalance(tx, accounts),
    };
  };
  const b2Fixed = !/Le\|\|Se\.check\.linkedBank\|\|Se\.account;/.test(bundleSource)
    && /se==="cleared"&&!Le&&!Se\.check\.linkedBank&&Se\.account===Ue/.test(bundleSource);
  record(
    "B2",
    "متوسط",
    "چک «پاس‌شده» بدون بانک مرتبط: بدهی صفر می‌شود ولی پول از بانک کم نمی‌شود",
    {
      "درجریان": pick(pending),
      "پاس‌شده بدون linkedBank": pick(clearedNoBank),
      "پاس‌شده با linkedBank": pick(clearedWithBank),
      "اثر": "ارزش خالص ۷۰۰ واحد می‌پرد. از فرم جدید با انتخاب اجباری بانک رخ نمی‌دهد، " +
        "ولی داده‌ی واردشده/قدیمی بدون linkedBank این وضعیت را می‌سازد. در De (تغییر وضعیت) " +
        "یک عبارت بی‌اثر `Le||Se.check.linkedBank||Se.account;` هست که نتیجه‌اش دور ریخته می‌شود.",
    },
    b2Fixed
  );
}

/* ---------- یافته ۳: افزودن ماه در اسفند سال کبیسه یک روز کم می‌کند ---------- */

{
  const source = fs.readFileSync(path.join(ROOT, "app/src/main/assets/src/scripts/067-inline.js"), "utf8");
  const start = source.indexOf("te=t=>");
  const end = source.indexOf("x9=(t,s,n)=>{", start);
  const storage = new Map();
  const helpers = vm.runInNewContext(
    `${source.slice(start, end).replace(/,\s*$/, "")};\n({ lr, F0 });`,
    {
      console: { error() {}, warn() {} },
      __safeGet: (k) => (storage.has(k) ? storage.get(k) : null),
      __safeSet: (k, v) => { storage.set(k, String(v)); return true; },
      Intl, Date,
    },
    { timeout: 5000 }
  );
  const rows = {
    "1403/12/30 + 0 ماه": helpers.lr("1403/12/30", 0),
    "1403/11/30 + 1 ماه": helpers.lr("1403/11/30", 1),
    "1403/12/30 + 1 ماه": helpers.lr("1403/12/30", 1),
    "1404/12/30 + 0 ماه (سال عادی)": helpers.lr("1404/12/30", 0),
  };
  const b3Fixed = helpers.lr("1403/11/30", 1) === "1403/12/30" && helpers.lr("1403/12/30", 0) === "1403/12/30";
  record(
    "B3",
    "متوسط",
    "افزودن ماه: اسفند ۳۰ در سال کبیسه به ۲۹ تبدیل می‌شود (حتی با ۰ ماه)",
    {
      "نتیجه": rows,
      "چرا مهم": "سررسید اقساط و تراکنش‌های تکرارشونده با همین تابع ساخته می‌شوند " +
        "(lr(شروع، (n-1)*فاصله))؛ قسط اول همان lr(شروع, 0) است.",
      "مرجع": "1403 کبیسه است (1403 % 33 = 17 ∈ {1,5,9,13,17,22,26,30})، پس اسفند ۳۰ روز دارد.",
    },
    b3Fixed
  );
}

/* ---------- یافته ۴: نمایش «منفی صفر» ---------- */

{
  const source = fs.readFileSync(path.join(ROOT, "app/src/main/assets/src/scripts/067-inline.js"), "utf8");
  const start = source.indexOf("te=t=>");
  const end = source.indexOf("x9=(t,s,n)=>{", start);
  const storage = new Map();
  const helpers = vm.runInNewContext(
    `${source.slice(start, end).replace(/,\s*$/, "")};\n({ F0, St });`,
    {
      console: { error() {}, warn() {} },
      __safeGet: (k) => (storage.has(k) ? storage.get(k) : null),
      __safeSet: (k, v) => { storage.set(k, String(v)); return true; },
      Intl, Date,
    },
    { timeout: 5000 }
  );
  const b4Fixed = helpers.F0(-0.4) === "۰" && helpers.F0(-1234) === "-۱،۲۳۴";
  record(
    "B4",
    "پایین",
    "قالب پول برای منفی بین ۰ و ۰٫۵ «-۰» نشان می‌دهد",
    { "F0(-0.4)": helpers.F0(-0.4), "F0(-0.5)": helpers.F0(-0.5), "F0(-0.49)": helpers.F0(-0.49) },
    b4Fixed
  );
}

/* ---------- یافته ۵: گذاشتن شناسه با Date.now ---------- */

{
  const source = fs.readFileSync(path.join(ROOT, "app/src/main/assets/src/scripts/067-inline.js"), "utf8");
  const hits = (source.match(/id:\s*Date\.now\(\)/g) || []).length;
  const offsetHits = (source.match(/id:\s*Date\.now\(\)\s*\+\s*/g) || []).length;
  const idHelperPresent = bundleSource.includes("function __hesabnoNextId()")
    && (bundleSource.match(/id:Date\.now\(\)/g) || []).length === 0;
  record(
    "B5",
    "پایین",
    "شناسه‌ها با Date.now() ساخته می‌شوند (ریسک برخورد در یک میلی‌ثانیه)",
    {
      "تعداد زیاد": hits,
      "با آفست (سند مرکب)": offsetHits,
      "ریسک": "دو سند در یک میلی‌ثانیه یا داده‌ی واردشده با شناسه‌ی مساوی → id تکراری و " +
        "ویرایش/حذف اشتباه. احتمال پایین، اثر بالا.",
    },
    idHelperPresent
  );
}

/* ---------- مواردی که سالم یافت شد (برای کامل‌بودن گزارش) ---------- */

{
  let mismatches = 0;
  const accounts = [
    { id: 1, name: "بانک", group: "bank", active: true, initialBalance: 1000 },
    { id: 2, name: "صندوق", group: "cash", active: true, initialBalance: 200 },
    { id: 3, name: "علی", group: "person", active: true },
    { id: 4, name: "فروش", group: "income", active: true },
    { id: 5, name: "اجاره", group: "expense", active: true },
  ];
  let seed = 42;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let round = 0; round < 300; round += 1) {
    const model = { بانک: 1000, صندوق: 200 };
    const tx = [];
    const n = 1 + Math.floor(rand() * 8);
    for (let i = 0; i < n; i += 1) {
      const type = ["income", "expense", "transfer"][Math.floor(rand() * 3)];
      const amount = Math.floor(rand() * 10000);
      const account = rand() > 0.5 ? "بانک" : "صندوق";
      const item = { id: i + 1, type, amount, account, date: "1405/01/01" };
      if (type === "transfer") item.destinationAccount = account === "بانک" ? "صندوق" : "بانک";
      if (type === "income") item.category = "فروش";
      if (type === "expense") item.category = "اجاره";
      tx.push(item);
      if (type === "income") model[account] += amount;
      else if (type === "expense") model[account] -= amount;
      else { model[account] -= amount; model[item.destinationAccount] += amount; }
    }
    for (const name of ["بانک", "صندوق"]) {
      const acc = accounts.find((a) => a.name === name);
      const actual = kernel.accountBalance(acc, accounts, tx).balance;
      if (Math.abs(actual - model[name]) > 0.001) mismatches += 1;
    }
  }
  findings.push({
    id: "OK1",
    severity: "سالم",
    title: "موجودی حساب‌ها در ۳۰۰ مجموعه‌ی تصادفی با مدل مستقل یکی بود",
    detail: { "مقایسه‌ها": 600, "اختلاف": mismatches },
  });
}

const output = {
  root: ROOT,
  at: new Date().toISOString(),
  summary: {
    total: findings.length,
    bugs: findings.filter((f) => f.severity !== "سالم" && f.status !== "اصلاح‌شده").length,
    fixed: findings.filter((f) => f.status === "اصلاح‌شده").length,
    bySeverity: findings.reduce((acc, f) => ((acc[f.severity] = (acc[f.severity] || 0) + 1), acc), {}),
  },
  findings,
};

const text = JSON.stringify(output, null, 2) + "\n";
const outIndex = process.argv.indexOf("--out");
if (outIndex > -1) fs.writeFileSync(process.argv[outIndex + 1], text);
process.stdout.write(text);
