/*
 * لایه‌ی دامنه — تفکیک سند و خلاصه‌ی گزارش‌ها (مرحله ۵، تصمیم R5)
 *
 * پیاده‌سازی خالص و خوانای منطق Cs و gk باندل 067. تغییرات حسابداری باید هم‌زمان در هسته و این
 * نسخه اعمال شوند؛ آزمون‌های سایه‌ای، برابری مسیر تولید و دامنه را تثبیت می‌کنند.
 *
 * رفتارهای حسابداری:
 *   • کارمزد در Cs هم به expense اضافه می‌شود و هم جداگانه در fee می‌آید؛ netSavings از gk
 *     همان income − expense است (بنابراین کارمزد یک‌بار در آن دیده می‌شود).
 *   • سند با چک برگشتی/مسترد: اصل سند حذف می‌شود، ولی کارمزد باقی می‌ماند.
 *   • رسید برگشت وجه، درآمد نقدی است اما در سود و زیان بر اساس گروه دسته‌ی سند اصلی معکوس می‌شود.
 *   • در gk فقط اقساط pending/overdue شمرده می‌شوند و چک‌های در جریان به طلب/بدهی اضافه می‌شوند.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./accounts.js"));
  } else {
    root.HesabnoDomain = root.HesabnoDomain || {};
    root.HesabnoDomain.reports = factory(root.HesabnoDomain.accounts);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (accountsDomain) {
  "use strict";

  var accountGroup = accountsDomain.accountGroup;
  var isPersonAccount = accountsDomain.isPersonAccount;
  var accountBalance = accountsDomain.accountBalance;
  var isCanceledCheck = accountsDomain.isCanceledCheck;

  var CHECK_IN_PROGRESS = ["in_progress", "received", "issued", "in_bank"];

  /* تفکیک یک سند به درآمد/هزینه/کارمزد (هم‌رفتار با Cs) */
  function splitTransaction(transaction, accounts, allTransactions) {
    var income = 0;
    var expense = 0;
    var feeAmount = Number(transaction.feeAmount) || 0;
    var sign = transaction.isReversal ? -1 : 1;
    if (feeAmount > 0) expense += feeAmount * sign;

    if (isCanceledCheck(transaction)) return { income: income, expense: expense, fee: feeAmount * sign };

    if (transaction.isCompound) {
      var sources = transaction.compoundSources || [];
      for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
        var source = sources[sourceIndex];
        if (!source || !source.account) continue;
        var sourceAmount = Number(source.amount) || 0;
        if (accountGroup(source.account, accounts) === "income") {
          income += (transaction.isReversal ? -1 : 1) * sourceAmount;
        }
      }
      var destinations = transaction.compoundDestinations || [];
      for (var destinationIndex = 0; destinationIndex < destinations.length; destinationIndex += 1) {
        var destination = destinations[destinationIndex];
        if (!destination || !destination.account) continue;
        var destinationAmount = Number(destination.amount) || 0;
        if (accountGroup(destination.account, accounts) === "expense") {
          expense += (transaction.isReversal ? -1 : 1) * destinationAmount;
        }
      }
      return { income: income, expense: expense, fee: feeAmount * sign };
    }

    // برگشت وجه از سند هزینه، درآمد نقدی است؛ طبقه‌بندی سود و زیان را از سند اصلی می‌گیرد.
    if (transaction.isRefundReceipt && transaction.type === "income") {
      var refundGroup = transaction.refundCategoryGroup;
      if (!refundGroup && Array.isArray(allTransactions) && transaction.reversalOfDocNumber != null) {
        var refundSource = allTransactions.find(function (candidate) {
          return candidate && !candidate.isReversal && candidate.type === "expense"
            && String(candidate.documentNumber != null ? candidate.documentNumber : candidate.id) === String(transaction.reversalOfDocNumber);
        });
        if (refundSource && refundSource.category) refundGroup = accountGroup(refundSource.category, accounts);
      }
      if (refundGroup === "expense" || !refundGroup) expense -= Number(transaction.amount) || 0;
      else if (refundGroup === "income") income += Number(transaction.amount) || 0;
      return { income: income, expense: expense, fee: feeAmount * sign };
    }

    if (transaction.type === "income") {
      var incomeGroup = transaction.category ? accountGroup(transaction.category, accounts) : undefined;
      var incomeAsIncome = incomeGroup === "income"
        || (!incomeGroup && !isPersonAccount(transaction.category || "", accounts) && !transaction.isReversal);
      if (incomeAsIncome) {
        if (!transaction.check || transaction.check.status !== "bounced") income += transaction.amount;
      } else if ((incomeGroup === "expense" || transaction.isReversal)
        && (!transaction.check || transaction.check.status !== "bounced")) {
        expense -= transaction.amount;
      }
    } else if (transaction.type === "expense") {
      var expenseGroup = transaction.category ? accountGroup(transaction.category, accounts) : undefined;
      var expenseAsExpense = expenseGroup === "expense"
        || (!expenseGroup && !isPersonAccount(transaction.category || "", accounts) && !transaction.isReversal);
      if (expenseAsExpense) {
        if (!transaction.check || transaction.check.status !== "bounced") expense += transaction.amount;
      } else if ((expenseGroup === "income" || transaction.isReversal)
        && (!transaction.check || transaction.check.status !== "bounced")) {
        income -= transaction.amount;
      }
    }

    return { income: income, expense: expense, fee: feeAmount * sign };
  }

  /*
   * خلاصه‌ی گزارش‌ها (هم‌رفتار با gk).
   * آرگومان سوم در قرارداد هسته بلااستفاده است؛ برای همان امضا نگه داشته شده.
   */
  function summarizeReports(transactions, accounts, _unused, installments) {
    var list = transactions || [];
    var accountList = accounts || [];
    var installmentList = installments || [];

    var totalIncome = 0;
    var totalExpense = 0;
    for (var index = 0; index < list.length; index += 1) {
      var split = splitTransaction(list[index], accountList, list);
      totalIncome += split.income;
      totalExpense += split.expense;
    }
    var netSavings = totalIncome - totalExpense;

    var liquidAccounts = accountList.filter(function (account) {
      return account.active && (account.group === "bank" || account.group === "cash");
    });
    var totalLiquidAssets = 0;
    var liquidBalances = {};
    for (var liquidIndex = 0; liquidIndex < liquidAccounts.length; liquidIndex += 1) {
      var liquid = liquidAccounts[liquidIndex];
      var liquidBalance = accountBalance(liquid, accountList, list).balance;
      liquidBalances[liquid.name] = liquidBalance;
      totalLiquidAssets += liquidBalance;
    }

    var people = accountList.filter(function (account) { return account.group === "person" && account.active; });
    var totalReceivables = 0;
    var totalPayables = 0;
    var personBalances = {};
    for (var personIndex = 0; personIndex < people.length; personIndex += 1) {
      var person = people[personIndex];
      var personBalance = accountBalance(person, accountList, list).balance;
      if (personBalance > 0) {
        totalReceivables += personBalance;
        personBalances[person.name] = { balance: personBalance, status: "debtor" };
      } else if (personBalance < 0) {
        totalPayables += Math.abs(personBalance);
        personBalances[person.name] = { balance: personBalance, status: "creditor" };
      } else {
        personBalances[person.name] = { balance: 0, status: "settled" };
      }
    }

    /* چک‌های در جریان: دریافتنی به طلب، پرداختنی به بدهی */
    var checkReceivables = 0;
    var checkPayables = 0;
    for (var checkIndex = 0; checkIndex < list.length; checkIndex += 1) {
      var transaction = list[checkIndex];
      var status = transaction && transaction.check && transaction.check.status;
      if (transaction && transaction.method === "check" && transaction.check && CHECK_IN_PROGRESS.indexOf(status) !== -1) {
        if (transaction.type === "income") checkReceivables += transaction.amount;
        else if (transaction.type === "expense") checkPayables += transaction.amount;
      }
    }
    totalReceivables += checkReceivables;
    totalPayables += checkPayables;

    var totalRemainingInstallments = installmentList
      .filter(function (installment) { return installment.status === "pending" || installment.status === "overdue"; })
      .reduce(function (sum, installment) { return sum + installment.amount; }, 0);

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

  return {
    splitTransaction: splitTransaction,
    summarizeReports: summarizeReports,
  };
});
