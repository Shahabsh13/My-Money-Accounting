/*
 * لایه‌ی کاربرد — سرویس گزارش (مرحله ۵، تصمیم R5)
 *
 * این لایه «ترکیب» می‌کند: داده‌ی خام (حساب‌ها، اسناد، اقساط) + تنظیمات نمایش → مدل آماده‌ی نمایش.
 * هیچ DOM، هیچ storage و هیچ وابستگی به باندل ندارد؛ فقط دامنه‌ی خالص.
 *
 * چرا جدا از دامنه؟ دامنه «حقیقت حسابداری» است (اعداد خام و قواعد)، کاربرد «نحوه‌ی ارائه» است
 * (قالب‌بندی، ساخت ردیف‌ها). این جداسازی اجازه می‌دهد در مرحله ۷ موتور گزارش‌ها روی همین مرز
 * ساخته شود و در مرحله ۶ لایه‌ی ذخیره‌سازی فقط داده‌ی خام بدهد.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../domain/reports.js"), require("../domain/accounts.js"),
      require("../domain/numbers.js"), require("../domain/reporting.js"));
  } else {
    root.HesabnoApplication = root.HesabnoApplication || {};
    root.HesabnoApplication.reportService = factory(root.HesabnoDomain.reports, root.HesabnoDomain.accounts,
      root.HesabnoDomain.numbers, root.HesabnoDomain.reporting);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (reportsDomain, accountsDomain, numbersDomain, reportingDomain) {
  "use strict";

  /*
   * ساخت عکس فوری گزارش.
   * input: { accounts, transactions, installments, settings: { currency, numberFormat } }
   * خروجی: اعداد خام (برای محاسبات بعدی) + ردیف‌های آماده‌ی نمایش (رشته‌های فارسی).
   */
  function buildReportSnapshot(input) {
    var accounts = (input && input.accounts) || [];
    var transactions = (input && input.transactions) || [];
    var installments = (input && input.installments) || [];
    var settings = (input && input.settings) || {};
    var currency = settings.currency === "rial" ? "rial" : "toman";
    var format = settings.numberFormat;

    var summary = reportsDomain.summarizeReports(transactions, accounts, [], installments);

    var personRows = Object.keys(summary.personBalances).map(function (name) {
      var entry = summary.personBalances[name];
      return {
        name: name,
        status: entry.status,
        balance: entry.balance,
        balanceText: numbersDomain.formatMoney(Math.abs(entry.balance), currency, format),
        signedText: (entry.balance < 0 ? "-" : "") + numbersDomain.formatMoney(Math.abs(entry.balance), currency, format),
      };
    });

    var accountRows = accounts.map(function (account) {
      var balance = accountsDomain.accountBalance(account, accounts, transactions);
      return {
        id: account.id,
        name: account.name,
        group: account.group,
        active: account.active !== false,
        balance: balance.balance,
        initialBalance: balance.initialBalance,
        totalDebits: balance.totalDebits,
        totalCredits: balance.totalCredits,
        transactionCount: balance.transactionCount,
        balanceText: numbersDomain.formatMoney(balance.balance, currency, format),
      };
    });

    return {
      summary: summary,
      accountRows: accountRows,
      personRows: personRows,
      totals: {
        netWorthText: numbersDomain.formatMoney(summary.totalNetWorth, currency, format),
        incomeText: numbersDomain.formatMoney(summary.totalIncome, currency, format),
        expenseText: numbersDomain.formatMoney(summary.totalExpense, currency, format),
        netSavingsText: numbersDomain.formatMoney(summary.netSavings, currency, format),
        liquidText: numbersDomain.formatMoney(summary.totalLiquidAssets, currency, format),
        receivablesText: numbersDomain.formatMoney(summary.totalReceivables, currency, format),
        payablesText: numbersDomain.formatMoney(summary.totalPayables, currency, format),
        installmentsText: numbersDomain.formatMoney(summary.totalRemainingInstallments, currency, format),
      },
    };
  }

  /*
   * گزارش کامل با موتور تک‌گذر (مرحله ۷).
   * ورودی همان ورودی buildReportSnapshot است تا خروجی عددی/متنی قابل مقایسه باشد؛ آزمون
   * tests/reporting-engine.test.cjs برابری کامل این دو را قفل می‌کند.
   */
  function buildEngineReport(input) {
    var data = input || {};
    var accounts = data.accounts || [];
    var transactions = data.transactions || [];
    var installments = data.installments || [];
    var settings = data.settings || {};
    var currency = settings.currency === "rial" ? "rial" : "toman";
    var format = settings.numberFormat;

    var report = reportingDomain.buildReport({
      accounts: accounts, transactions: transactions, installments: installments,
    });
    var summary = report.summary;

    var personRows = Object.keys(summary.personBalances).map(function (name) {
      var entry = summary.personBalances[name];
      return {
        name: name,
        status: entry.status,
        balance: entry.balance,
        balanceText: numbersDomain.formatMoney(Math.abs(entry.balance), currency, format),
        signedText: (entry.balance < 0 ? "-" : "") + numbersDomain.formatMoney(Math.abs(entry.balance), currency, format),
      };
    });

    var accountRows = accounts.map(function (account, index) {
      var balance = report.balances[index] || {
        balance: 0, initialBalance: 0, totalDebits: 0, totalCredits: 0, transactionCount: 0,
      };
      return {
        id: account.id,
        name: account.name,
        group: account.group,
        active: account.active !== false,
        balance: balance.balance,
        initialBalance: balance.initialBalance,
        totalDebits: balance.totalDebits,
        totalCredits: balance.totalCredits,
        transactionCount: balance.transactionCount,
        balanceText: numbersDomain.formatMoney(balance.balance, currency, format),
      };
    });

    return {
      summary: summary,
      accountRows: accountRows,
      personRows: personRows,
      monthlyRows: report.monthly.map(function (bucket) {
        return {
          month: bucket.month,
          income: bucket.income,
          expense: bucket.expense,
          fee: bucket.fee,
          net: bucket.net,
          count: bucket.count,
          incomeText: numbersDomain.formatMoney(bucket.income, currency, format),
          expenseText: numbersDomain.formatMoney(bucket.expense, currency, format),
          netText: numbersDomain.formatMoney(bucket.net, currency, format),
        };
      }),
      groupRows: report.groupCashFlow.map(function (group) {
        return {
          group: group.group,
          accounts: group.accounts,
          active: group.active,
          balance: group.balance,
          totalDebits: group.totalDebits,
          totalCredits: group.totalCredits,
          balanceText: numbersDomain.formatMoney(group.balance, currency, format),
        };
      }),
      totals: {
        netWorthText: numbersDomain.formatMoney(summary.totalNetWorth, currency, format),
        incomeText: numbersDomain.formatMoney(summary.totalIncome, currency, format),
        expenseText: numbersDomain.formatMoney(summary.totalExpense, currency, format),
        netSavingsText: numbersDomain.formatMoney(summary.netSavings, currency, format),
        liquidText: numbersDomain.formatMoney(summary.totalLiquidAssets, currency, format),
        receivablesText: numbersDomain.formatMoney(summary.totalReceivables, currency, format),
        payablesText: numbersDomain.formatMoney(summary.totalPayables, currency, format),
        installmentsText: numbersDomain.formatMoney(summary.totalRemainingInstallments, currency, format),
      },
    };
  }

  return {
    buildReportSnapshot: buildReportSnapshot,
    buildEngineReport: buildEngineReport,
  };
});
