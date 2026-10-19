/*
 * تولیدکننده‌ی داده‌ی آزمایشی گزارش‌ها (مرحله ۷)
 *
 * چرا تولید تصادفی «قابل تکرار»؟ چون هم‌رفتاری موتور تک‌گذر با هسته را باید روی همه‌ی شاخه‌ها
 * سنجید: سند ساده، انتقال، مرکب، چک در جریان/تسویه/برگشتی، کارمزد، برگشت سند، حساب‌های
 * دریافتنی/پرداختنی، والد و فرزند، نام تکراری و حساب بی‌نام. یک فهرست دستی هرگز همه‌ی
 * ترکیب‌ها را پوشش نمی‌دهد؛ PRNG با دانه‌ی ثابت هم تکرارپذیر است و هم گسترده.
 */
"use strict";

function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const CHECK_STATUSES = ["cleared", "in_progress", "received", "issued", "in_bank", "bounced", "returned", "dishonored"];

/* حساب‌ها: همه‌ی گروه‌ها + ساختار والد/فرزند + نام‌های ویژه‌ی هسته */
function makeAccounts() {
  return [
    { id: "bank-1", name: "بانک ملت", group: "bank", active: true, initialBalance: 5000000 },
    { id: "bank-2", name: "بانک صادرات", group: "bank", active: true, initialBalance: 1200000 },
    { id: "bank-off", name: "بانک غیرفعال", group: "bank", active: false, initialBalance: 900000 },
    { id: "cash-1", name: "صندوق", group: "cash", active: true, initialBalance: 250000 },
    { id: "asset-1", name: "دارایی ثابت", group: "asset", active: true, initialBalance: 0 },
    { id: "asset-child", name: "خودرو", group: "asset", active: true, initialBalance: 0, parentId: "asset-1" },
    { id: "recv-docs", name: "اسناد دریافتنی", group: "bank", active: true, initialBalance: 0 },
    { id: "recv-child", name: "چک دریافتنی", group: "bank", active: true, initialBalance: 0, parentId: "recv-docs" },
    { id: "pay-docs", name: "اسناد پرداختنی", group: "liability", active: true, initialBalance: 0 },
    { id: "pay-child", name: "چک پرداختنی", group: "liability", active: true, initialBalance: 0, parentId: "pay-docs" },
    { id: "person-1", name: "علی رضایی", group: "person", active: true },
    { id: "person-2", name: "مریم احمدی", group: "person", active: true },
    { id: "person-3", name: "حساب بی‌نام", group: "person", active: true },
    { id: "inc-1", name: "فروش محصول", group: "income", active: true },
    { id: "inc-2", name: "درآمد متفرقه", group: "income", active: true },
    { id: "exp-1", name: "اجاره محل", group: "expense", active: true },
    { id: "exp-2", name: "خرید روزانه", group: "expense", active: true },
    { id: "fee-1", name: "کارمزد بانکی", group: "expense", active: true },
    { id: "fee-2", name: "هزینه کارمزد و بهره", group: "expense", active: true },
    { id: "liab-1", name: "وام بانکی", group: "liability", active: true },
    { id: "eq-1", name: "سرمایه اولیه", group: "equity", active: true },
    { id: "dup-a", name: "حساب تکراری", group: "expense", active: true },
    { id: "dup-b", name: "حساب تکراری", group: "income", active: true },
    { id: "no-name", name: "", group: "expense", active: true, initialBalance: 111 },
    { id: "no-name-2", name: "", group: "bank", active: true, initialBalance: 222 },
  ];
}

const REFS = [
  "بانک ملت", "بانک صادرات", "صندوق", "دارایی ثابت", "خودرو", "علی رضایی", "مریم احمدی",
  "فروش محصول", "درآمد متفرقه", "اجاره محل", "خرید روزانه", "کارمزد بانکی", "وام بانکی",
  "سرمایه اولیه", "حساب تکراری", "حساب ناموجود", "", "اسناد دریافتنی", "چک پرداختنی",
];

function pick(random, list) { return list[Math.floor(random() * list.length)]; }

function makeTransactions(count, seed) {
  const random = mulberry32(seed);
  const transactions = [];
  const pad = (value) => String(value).padStart(2, "0");
  for (let index = 0; index < count; index += 1) {
    const month = 1 + Math.floor(random() * 12);
    const day = 1 + Math.floor(random() * 30);
    const kind = random();
    const amount = Math.floor(random() * 5000000) + 1000;
    const transaction = {
      id: "t-" + index,
      date: `1405/${pad(month)}/${pad(day)}`,
      amount,
      type: "expense",
      account: pick(random, REFS),
      category: pick(random, REFS),
    };
    if (kind < 0.2) {
      transaction.type = "income";
      transaction.account = pick(random, ["بانک ملت", "بانک صادرات", "صندوق"]);
      transaction.category = pick(random, ["فروش محصول", "درآمد متفرقه", "علی رضایی", "حساب ناموجود"]);
    } else if (kind < 0.32) {
      transaction.type = "transfer";
      transaction.account = pick(random, ["بانک ملت", "بانک صادرات", "صندوق"]);
      transaction.destinationAccount = pick(random, ["بانک ملت", "بانک صادرات", "صندوق", "علی رضایی", "درآمد متفرقه"]);
    } else if (kind < 0.42) {
      transaction.type = "expense";
      transaction.account = pick(random, ["بانک ملت", "صندوق", "بانک غیرفعال"]);
      transaction.category = pick(random, ["اجاره محل", "خرید روزانه", "کارمزد بانکی", "علی رضایی"]);
      transaction.isReversal = true;
    } else if (kind < 0.55) {
      transaction.type = random() < 0.5 ? "income" : "expense";
      transaction.method = "check";
      transaction.check = {
        status: pick(random, CHECK_STATUSES),
        linkedBank: pick(random, ["بانک ملت", "بانک صادرات", "بانک غیرفعال", null]),
      };
      transaction.account = pick(random, ["اسناد دریافتنی", "چک دریافتنی", "بانک ملت", "صندوق"]);
      transaction.category = pick(random, ["اسناد پرداختنی", "چک پرداختنی", "اجاره محل", "فروش محصول"]);
      if (transaction.check.status === "bounced" || transaction.check.status === "returned") {
        transaction.check.debtCanceled = random() < 0.5;
      }
    } else if (kind < 0.65) {
      transaction.isCompound = true;
      transaction.type = "expense";
      transaction.compoundSources = [
        { account: pick(random, ["بانک ملت", "صندوق"]), amount: Math.floor(amount / 2) },
        { account: pick(random, ["فروش محصول", "درآمد متفرقه"]), amount: Math.floor(amount / 3) },
      ];
      transaction.compoundDestinations = [
        { account: pick(random, ["اجاره محل", "خرید روزانه", "علی رضایی"]), amount },
        { account: pick(random, ["بانک ملت", "صندوق"]), amount: Math.floor(amount / 2) },
      ];
      transaction.isReversal = random() < 0.2;
    }

    if (random() < 0.35) {
      transaction.feeAmount = Math.floor(random() * 50000) + 100;
      transaction.feeAccount = pick(random, ["کارمزد بانکی", "هزینه کارمزد و بهره", "بانک ملت", "اجاره محل"]);
    }
    transactions.push(transaction);
  }
  return transactions;
}

function makeInstallments(seed) {
  const random = mulberry32(seed + 99);
  const list = [];
  for (let index = 0; index < 6; index += 1) {
    list.push({
      id: "i-" + index,
      status: pick(random, ["pending", "paid", "overdue"]),
      amount: Math.floor(random() * 900000) + 1000,
    });
  }
  return list;
}

/*
 * چند نسخه از مجموعه‌ی پایه با شناسه/نام یکتا — شبیه فهرست واقعی (۲۰۰+ حساب).
 * این حالت یک رفتار ظریف هسته را آشکار می‌کند: حسابی که نامش فقط «شامل» عبارت
 * «اسناد دریافتنی» است هم حساب دریافتنی شناخته می‌شود، ولی عضویتش در مجموعه‌ی نام‌های
 * حساب دیگری نیست. آزمون تفاضلی باید همین را هم پوشش دهد.
 */
function expandAccounts(copies) {
  const base = makeAccounts();
  const accounts = [];
  for (let copy = 0; copy < (copies || 3); copy += 1) {
    for (const account of base) {
      const next = {
        ...account,
        id: account.id + "-" + copy,
        name: account.name ? account.name + (copy ? " " + copy : "") : "",
      };
      if (account.parentId) next.parentId = account.parentId + "-" + copy;
      accounts.push(next);
    }
  }
  return accounts;
}

module.exports = { mulberry32, makeAccounts, makeTransactions, makeInstallments, expandAccounts };
