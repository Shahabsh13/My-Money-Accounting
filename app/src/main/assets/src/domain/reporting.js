/*
 * لایه‌ی دامنه — موتور گزارش‌ها (مرحله ۷.۲)
 *
 * این ماژول روی «موتور تک‌گذر مانده‌ها» (ledger.js) و همان تفکیک سند (Cs) ساخته می‌شود و
 * گزارش‌های آماده‌ی نمایش را تولید می‌کند:
 *
 *   • summary          → دقیقاً همان خروجی gk (درآمد، هزینه، دارایی نقدی، طلب، بدهی، اقساط، ارزش خالص)
 *   • monthly          → سری ماهانه‌ی درآمد/هزینه/کارمزد/خالص روی تقویم جلالی (کلید «YYYY/MM»)
 *   • groupCashFlow    → گردش و مانده به تفکیک گروه حساب
 *   • statement        → صورت‌حساب یک حساب با مانده‌ی روان، قابل برش بازه
 *   • balances         → مانده‌ی همه‌ی حساب‌ها با یک گذر
 *
 * هیچ قاعده‌ی حسابداری تازه‌ای ساخته نمی‌شود: هر عدد از splitTransaction / همان قواعد Nr می‌آید.
 * اعداد صورت‌حساب هم با همان «گام سند» محاسبه می‌شوند، پس جمع نهایی‌اش ناگزیر با مانده یکی است.
 *
 * هیچ DOM/storage؛ در index.html بارگذاری نمی‌شود.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./ledger.js"), require("./reports.js"), require("./accounts.js"));
  } else {
    root.HesabnoDomain = root.HesabnoDomain || {};
    root.HesabnoDomain.reporting = factory(root.HesabnoDomain.ledger, root.HesabnoDomain.reports, root.HesabnoDomain.accounts);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (ledger, reportsDomain, accountsDomain) {
  "use strict";

  var splitTransaction = reportsDomain.splitTransaction;
  var nameKey = accountsDomain.nameKey;
  var CHECK_IN_PROGRESS = ["in_progress", "received", "issued", "in_bank"];

  function dateKey(date) {
    var text = String(date == null ? "" : date).trim();
    if (text.length >= 7) return text.slice(0, 7);
    return text || "نامشخص";
  }

  /*
   * خلاصه‌ی گزارش‌ها — همان قرارداد gk، اما مانده‌ها از نتیجه‌ی تک‌گذر گرفته می‌شوند
   * (به‌جای فراخوانی Nr برای هر حساب). جمع‌ها با همان ترتیب اسناد انجام می‌شود.
   */
  function summarize(accounts, transactions, installments, rows) {
    var accountList = accounts || [];
    var documents = transactions || [];
    var installmentList = installments || [];
    var balanceRows = rows || ledger.balancesForAll(accountList, documents);
    var byIndex = balanceRows;

    var totalIncome = 0;
    var totalExpense = 0;
    for (var index = 0; index < documents.length; index += 1) {
      var split = splitTransaction(documents[index], accountList);
      totalIncome += split.income;
      totalExpense += split.expense;
    }
    var netSavings = totalIncome - totalExpense;

    var totalLiquidAssets = 0;
    var liquidBalances = {};
    var totalReceivables = 0;
    var totalPayables = 0;
    var personBalances = {};

    for (var accountIndex = 0; accountIndex < accountList.length; accountIndex += 1) {
      var account = accountList[accountIndex];
      if (!account) continue;
      var row = byIndex[accountIndex];
      if (!row) continue;
      if (account.active && (account.group === "bank" || account.group === "cash")) {
        liquidBalances[account.name] = row.balance;
        totalLiquidAssets += row.balance;
      } else if (account.active && account.group === "person") {
        if (row.balance > 0) {
          totalReceivables += row.balance;
          personBalances[account.name] = { balance: row.balance, status: "debtor" };
        } else if (row.balance < 0) {
          totalPayables += Math.abs(row.balance);
          personBalances[account.name] = { balance: row.balance, status: "creditor" };
        } else {
          personBalances[account.name] = { balance: 0, status: "settled" };
        }
      }
    }

    /* چک‌های در جریان: دریافتنی به طلب، پرداختنی به بدهی (همان قاعده‌ی gk) */
    for (var documentIndex = 0; documentIndex < documents.length; documentIndex += 1) {
      var transaction = documents[documentIndex];
      var status = transaction && transaction.check && transaction.check.status;
      if (transaction && transaction.method === "check" && transaction.check && CHECK_IN_PROGRESS.indexOf(status) !== -1) {
        if (transaction.type === "income") totalReceivables += transaction.amount;
        else if (transaction.type === "expense") totalPayables += transaction.amount;
      }
    }

    var totalRemainingInstallments = 0;
    for (var installmentIndex = 0; installmentIndex < installmentList.length; installmentIndex += 1) {
      var installment = installmentList[installmentIndex];
      if (installment && (installment.status === "pending" || installment.status === "overdue")) {
        totalRemainingInstallments += installment.amount;
      }
    }

    var totalNetWorth = totalLiquidAssets + totalReceivables - (totalPayables + totalRemainingInstallments);

    return {
      totalIncome: totalIncome,
      totalExpense: totalExpense,
      netSavings: netSavings,
      totalLiquidAssets: totalLiquidAssets,
      liquidBalances: liquidBalances,
      totalReceivables: totalReceivables,
      totalPayables: totalPayables,
      personBalances: personBalances,
      totalRemainingInstallments: totalRemainingInstallments,
      totalNetWorth: totalNetWorth,
    };
  }

  /*
   * سری ماهانه. کلید ماه = هفت نویسه‌ی اول تاریخ («YYYY/MM» در تقویم جلالی).
   * جمع ماه‌ها باید دقیقاً برابر totalIncome/totalExpense خلاصه باشد؛ چون مبالغ ریالی صحیح‌اند
   * و جمع اعداد صحیح در محدوده‌ی ایمن دقیق است.
   */
  function monthly(accounts, transactions) {
    var documents = transactions || [];
    var accountList = accounts || [];
    var buckets = new Map();
    for (var index = 0; index < documents.length; index += 1) {
      var transaction = documents[index];
      var key = dateKey(transaction && transaction.date);
      var bucket = buckets.get(key);
      if (!bucket) {
        bucket = { month: key, income: 0, expense: 0, fee: 0, net: 0, count: 0 };
        buckets.set(key, bucket);
      }
      var split = splitTransaction(transaction, accountList);
      bucket.income += split.income;
      bucket.expense += split.expense;
      bucket.fee += split.fee;
      bucket.count += 1;
    }
    var series = [];
    buckets.forEach(function (bucket) {
      bucket.net = bucket.income - bucket.expense;
      series.push(bucket);
    });
    series.sort(function (first, second) { return first.month < second.month ? -1 : first.month > second.month ? 1 : 0; });
    return series;
  }

  /* گردش و مانده به تفکیک گروه حساب (همه‌ی حساب‌ها، فعال و غیرفعال؛ مصرف‌کننده می‌تواند فیلتر کند) */
  function groupCashFlow(accounts, rows) {
    var accountList = accounts || [];
    var balanceRows = rows || ledger.balancesForAll(accountList, []);
    var groups = {};
    for (var index = 0; index < accountList.length; index += 1) {
      var account = accountList[index];
      var row = balanceRows[index];
      if (!account || !row) continue;
      var group = account.group || "unknown";
      var entry = groups[group];
      if (!entry) {
        entry = { group: group, accounts: 0, active: 0, balance: 0, totalDebits: 0, totalCredits: 0, transactionCount: 0 };
        groups[group] = entry;
      }
      entry.accounts += 1;
      if (account.active) entry.active += 1;
      entry.balance += row.balance;
      entry.totalDebits += row.totalDebits;
      entry.totalCredits += row.totalCredits;
      entry.transactionCount += row.transactionCount;
    }
    return Object.keys(groups).sort().map(function (group) { return groups[group]; });
  }

  /*
   * صورت‌حساب یک حساب. مانده‌ی روان با همان گام سند ساخته می‌شود، سپس با بازه بریده می‌شود:
   * ردیف «مانده‌ی ابتدای بازه» جمع همه‌ی اسناد پیش از بازه است. جمع نهایی همیشه با مانده‌ی کل یکی است.
   */
  function statement(accountIdOrName, accounts, transactions, options) {
    var accountList = accounts || [];
    var documents = transactions || [];
    var opts = options || {};
    var targetIndex = -1;
    for (var index = 0; index < accountList.length; index += 1) {
      var candidate = accountList[index];
      if (!candidate) continue;
      if (candidate.id === accountIdOrName || nameKey(candidate.name) === nameKey(accountIdOrName)) { targetIndex = index; break; }
    }
    if (targetIndex === -1) return null;

    var contexts = ledger.buildContexts(accountList);
    var context = contexts[targetIndex];
    var state = { balance: context.initialBalance, debits: 0, credits: 0 };
    var entries = [];
    for (var documentIndex = 0; documentIndex < documents.length; documentIndex += 1) {
      var transaction = documents[documentIndex];
      var beforeBalance = state.balance;
      var beforeDebits = state.debits;
      var beforeCredits = state.credits;
      if (ledger.applyTransaction(state, context, transaction)) {
        entries.push({
          index: documentIndex,
          id: transaction.id,
          date: transaction.date,
          type: transaction.type,
          description: transaction.title || transaction.description || transaction.category || transaction.account || "",
          amount: transaction.amount,
          deltaBalance: state.balance - beforeBalance,
          debits: state.debits - beforeDebits,
          credits: state.credits - beforeCredits,
          balance: state.balance,
        });
      }
    }

    var from = opts.from ? String(opts.from) : null;
    var to = opts.to ? String(opts.to) : null;
    var visible = entries.filter(function (entry) {
      var date = String(entry.date || "");
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });

    /*
     * مانده‌ی بازه بر اساس «جمع تغییرها» محاسبه می‌شود، نه مانده‌ی روان آخرین ردیف؛ چون ترتیب
     * اسناد در برنامه لزوماً تاریخ‌محور نیست. این‌گونه اتحاد حسابداری همیشه برقرار می‌ماند:
     *   مانده پایانی = مانده ابتدای بازه + جمع تغییرهای بازه
     * مانده‌ی روان هر ردیف (`balance`) همان ترتیب ثبت اسناد را نشان می‌دهد.
     */
    var deltaBeforeFrom = 0;
    var deltaVisible = 0;
    for (var entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
      var entryDate = String(entries[entryIndex].date || "");
      if (from && entryDate < from) deltaBeforeFrom += entries[entryIndex].deltaBalance;
      else if ((!from || entryDate >= from) && (!to || entryDate <= to)) deltaVisible += entries[entryIndex].deltaBalance;
    }
    var openingBalance = context.initialBalance + deltaBeforeFrom;
    var closingBalance = openingBalance + deltaVisible;

    return {
      account: { id: context.account.id, name: context.account.name, group: context.account.group },
      openingBalance: openingBalance,
      entries: visible,
      closingBalance: closingBalance,
      /* بدون برش، این دو با مانده‌ی کل حساب برابرند */
      initialBalance: context.initialBalance,
      finalBalance: state.balance,
      totalDebits: state.debits,
      totalCredits: state.credits,
    };
  }

  /* گزارش کامل — یک بار ساخت داده، همه‌ی خروجی‌ها از همان نتیجه */
  function buildReport(input) {
    var data = input || {};
    var accounts = data.accounts || [];
    var transactions = data.transactions || [];
    var installments = data.installments || [];
    var rows = ledger.balancesForAll(accounts, transactions);
    return {
      version: 1,
      balances: rows,
      summary: summarize(accounts, transactions, installments, rows),
      monthly: monthly(accounts, transactions),
      groupCashFlow: groupCashFlow(accounts, rows),
    };
  }

  return {
    version: 1,
    dateKey: dateKey,
    summarize: summarize,
    monthly: monthly,
    groupCashFlow: groupCashFlow,
    statement: statement,
    buildReport: buildReport,
  };
});
