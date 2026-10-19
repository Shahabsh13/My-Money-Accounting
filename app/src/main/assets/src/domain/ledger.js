/*
 * لایه‌ی دامنه — موتور تک‌گذر مانده‌ها (مرحله ۷.۱)
 *
 * مسئله: `accountBalance` برای هر حساب، همه‌ی اسناد را دوباره طی می‌کند؛ در داشبورد و گزارش‌ها
 * این تابع برای هر حساب فعال صدا زده می‌شود ⇒ هزینه‌ی O(حساب‌ها × اسناد). با ۱۰۰٬۰۰۰ سند و ۲۰۰
 * حساب، هر به‌روزرسانی گزارش ده‌ها میلیون عملیات است.
 *
 * راه‌حل (بدون تغییر هیچ قاعده‌ای): همان «گام سند» هسته، اما به‌جای پیمایش همه‌ی اسناد برای هر
 * حساب، از هر سند فقط حساب‌هایی را پیدا می‌کنیم که ممکن است لمس شوند (نمایه‌ی نام → حساب‌ها) و
 * برای آن‌ها **دقیقاً همان گام** را اجرا می‌کنیم. جمع‌ها به همان ترتیب اسناد و همان ترتیب
 * عملگرها انجام می‌شود، پس خروجی باید بیت‌به‌بیت با `accountBalance` یکی باشد.
 *
 * چرا این‌جا «کپی منطق» مجاز است؟ باندل تولید (۰۶۷) قفل است و قابل بازآرایی نیست؛ این ماژول در
 * index.html بارگذاری نمی‌شود و تنها با آزمون تفاضلی (tests/ledger-differential.test.cjs) در برابر
 * هسته‌ی واقعی اعتبار می‌گیرد. هرگونه واگرایی، آزمون را می‌شکند.
 *
 * وابستگی: accounts.js (فقط توابع کمکی؛ هیچ تغییری در آن نمی‌دهد).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./accounts.js"));
  } else {
    root.HesabnoDomain = root.HesabnoDomain || {};
    root.HesabnoDomain.ledger = factory(root.HesabnoDomain.accounts);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (accountsDomain) {
  "use strict";

  var nameKey = accountsDomain.nameKey;
  var isCanceledCheck = accountsDomain.isCanceledCheck;
  var buildAccountTree = accountsDomain.buildAccountTree;

  /* نام‌هایی که در منطق هسته به‌صورت ثابت بررسی می‌شوند (برای پیدا کردن حساب‌های تحت‌تأثیر) */
  var SPECIAL_KEYS = [
    "اسناد دریافتنی",
    "اسناد پرداختنی",
    "چک ها و اسناد پرداختنی",
    "هزینه کارمزد و بهره",
    "کارمزد و بهره",
    "کارمزد انتقال و خدمات بانکی",
    "کارمزد پوز و درگاه پرداخت",
    "کارمزد بانکی",
  ].map(function (name) { return name.trim().toLowerCase(); });

  /*
   * ساخت «زمینه»ی هر حساب — همان چیزهایی که accountBalance یک‌بار برای هر حساب حساب می‌کند:
   * مجموعه‌ی نام‌های مؤثر، گروه، پرچم‌های ویژه و مانده‌ی اولیه.
   */
  function buildContexts(accounts) {
    var tree = buildAccountTree(accounts);
    var contexts = new Array(accounts.length);
    for (var index = 0; index < accounts.length; index += 1) {
      var account = accounts[index];
      if (!account) {
        contexts[index] = null;
        continue;
      }
      var names = tree.descendantsById.get(account.id) || new Set([nameKey(account.name)]);
      var initialBalance = 0;
      for (var itemIndex = 0; itemIndex < accounts.length; itemIndex += 1) {
        var item = accounts[itemIndex];
        if (!item) continue;
        if (item.id === account.id || names.has(nameKey(item.name))) initialBalance += (item.initialBalance || 0);
      }
      var group = account.group;
      var nameText = String(account.name || "");
      contexts[index] = {
        account: account,
        names: names,
        group: group,
        nameText: nameText,
        initialBalance: initialBalance,
        /* همان سه پرچم هسته، یک‌بار محاسبه‌شده */
        receivableDocuments: names.has("اسناد دریافتنی") || nameText.indexOf("اسناد دریافتنی") !== -1,
        payableDocuments: names.has("اسناد پرداختنی") || names.has("چک ها و اسناد پرداختنی")
          || nameText.indexOf("اسناد پرداختنی") !== -1,
        /* فقط نام‌های ثابت کارمزد؛ نام حساب کارمزدِ هر سند در لحظه بررسی می‌شود */
        feeAccountTouched: SPECIAL_KEYS.slice(3).some(function (name) { return names.has(name); }),
      };
    }
    return contexts;
  }

  /* نمایه‌ی «نام → حساب‌هایی که آن نام در مجموعه‌شان هست» */
  function buildAccountsByKey(contexts) {
    var byKey = new Map();
    for (var index = 0; index < contexts.length; index += 1) {
      var context = contexts[index];
      if (!context) continue;
      context.names.forEach(function (key) {
        var list = byKey.get(key);
        if (list) list.push(index);
        else byKey.set(key, [index]);
      });
    }
    return byKey;
  }

  /*
   * گام یک سند روی یک حساب — بازتولید خط‌به‌خط شاخه‌های accountBalance.
   * وضعیت در `state` انباشته می‌شود: balance / totalDebits / totalCredits.
   * خروجی: آیا این سند حساب را لمس کرد؟
   */
  function applyTransaction(state, context, transaction) {
    var touched = false;
    var names = context.names;
    var group = context.group;

    if (transaction.isCompound) {
      var sources = transaction.compoundSources || [];
      for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
        var source = sources[sourceIndex];
        if (source == null || !source.account || !names.has(nameKey(source.account))) continue;
        touched = true;
        if (transaction.isReversal) state.debits += source.amount; else state.credits += source.amount;
        if (group === "bank" || group === "cash" || group === "asset" || group === "person") {
          state.balance += (transaction.isReversal ? 1 : -1) * source.amount;
        } else if (group === "income") {
          state.balance += (transaction.isReversal ? -1 : 1) * source.amount;
        }
        if (group === "expense" && transaction.isReversal) state.balance += source.amount;
      }

      var destinations = transaction.compoundDestinations || [];
      for (var destinationIndex = 0; destinationIndex < destinations.length; destinationIndex += 1) {
        var destination = destinations[destinationIndex];
        if (destination == null || !destination.account || !names.has(nameKey(destination.account))) continue;
        touched = true;
        if (transaction.isReversal) state.credits += destination.amount; else state.debits += destination.amount;
        if (group === "bank" || group === "cash" || group === "asset" || group === "person" || group === "expense"
          || (group === "income" && transaction.isReversal)) {
          state.balance += (transaction.isReversal ? -1 : 1) * destination.amount;
        }
      }

      if ((group === "bank" || group === "cash" || group === "asset") && transaction.feeAmount && transaction.feeAmount > 0) {
        var compoundFeeAccount = nameKey(transaction.feeAccount || transaction.account || "");
        if (names.has(compoundFeeAccount)) {
          state.balance -= (transaction.isReversal ? -1 : 1) * transaction.feeAmount;
          if (transaction.isReversal) state.debits += transaction.feeAmount; else state.credits += transaction.feeAmount;
          touched = true;
        }
      }
      return touched;
    }

    var accountName = nameKey(transaction.account);
    var categoryName = nameKey(transaction.category);
    var destinationName = nameKey(transaction.destinationAccount);
    var feeAccountName = nameKey(transaction.feeAccount);
    var linkedBankName = nameKey(transaction.check && transaction.check.linkedBank);
    var canceled = isCanceledCheck(transaction);

    if (group === "bank" || group === "cash" || group === "asset") {
      if (context.receivableDocuments) {
        if (transaction.method === "check" && transaction.type === "income" && transaction.check) {
          if (!canceled) { state.balance += transaction.amount; state.debits += transaction.amount; touched = true; }
          if (!canceled && transaction.check.status === "cleared") {
            state.balance -= transaction.amount; state.credits += transaction.amount; touched = true;
          }
        }
      } else {
        if (transaction.type === "income") {
          if (names.has(accountName) && (!transaction.check || transaction.check.status === "cleared")) {
            state.balance += transaction.amount; state.debits += transaction.amount; touched = true;
          }
        } else if (transaction.type === "expense") {
          if (names.has(accountName) && (!transaction.check || transaction.check.status === "cleared")) {
            state.balance -= transaction.amount; state.credits += transaction.amount; touched = true;
          }
        } else if (transaction.type === "transfer") {
          if (names.has(accountName)) {
            state.balance += (transaction.isReversal ? 1 : -1) * transaction.amount;
            if (transaction.isReversal) state.debits += transaction.amount; else state.credits += transaction.amount;
            touched = true;
          }
          if (names.has(destinationName)) {
            state.balance += (transaction.isReversal ? -1 : 1) * transaction.amount;
            if (transaction.isReversal) state.credits += transaction.amount; else state.debits += transaction.amount;
            touched = true;
          }
        }
        if (transaction.check && transaction.check.status === "cleared" && linkedBankName && names.has(linkedBankName)) {
          if (transaction.type === "expense" && !names.has(accountName)) {
            state.balance -= transaction.amount; state.credits += transaction.amount; touched = true;
          } else if (transaction.type === "income" && !names.has(accountName)) {
            state.balance += transaction.amount; state.debits += transaction.amount; touched = true;
          }
        }
      }
      if (transaction.feeAmount && transaction.feeAmount > 0) {
        var feeApplies = transaction.isReversal
          ? names.has(feeAccountName)
          : (names.has(accountName) || (linkedBankName && names.has(linkedBankName)));
        if (feeApplies) {
          state.balance -= (transaction.isReversal ? -1 : 1) * transaction.feeAmount;
          if (transaction.isReversal) state.debits += transaction.feeAmount; else state.credits += transaction.feeAmount;
          touched = true;
        }
      }
    } else if (group === "person") {
      if (transaction.type === "expense" && !canceled && names.has(categoryName)) {
        state.balance += transaction.amount; state.debits += transaction.amount; touched = true;
      } else if (transaction.type === "income" && !canceled && names.has(categoryName)) {
        state.balance -= transaction.amount; state.credits += transaction.amount; touched = true;
      } else if (transaction.type === "transfer") {
        if (names.has(accountName)) { state.balance -= transaction.amount; state.credits += transaction.amount; touched = true; }
        if (names.has(destinationName)) { state.balance += transaction.amount; state.debits += transaction.amount; touched = true; }
      }
    } else if (group === "expense") {
      if (transaction.type === "expense" && !canceled && (names.has(categoryName) || names.has(accountName))) {
        state.balance += transaction.amount; state.debits += transaction.amount; touched = true;
      } else if (transaction.type === "income" && !canceled && (names.has(categoryName) || names.has(accountName))) {
        state.balance -= transaction.amount; state.credits += transaction.amount; touched = true;
      }
      /*
       * مثل هسته: پرچم کارمزد دو بخش دارد — نام حساب کارمزدِ همین سند، یا نام‌های ثابت کارمزد.
       * بخش اول «به‌ازای هر سند» است، پس نباید در زمینه‌ی حساب پیش‌محاسبه شود.
       */
      var feeAccountTouched = (feeAccountName && names.has(feeAccountName)) || context.feeAccountTouched;
      if (transaction.feeAmount && transaction.feeAmount > 0 && feeAccountTouched) {
        state.balance += (transaction.isReversal ? -1 : 1) * transaction.feeAmount;
        if (transaction.isReversal) state.credits += transaction.feeAmount; else state.debits += transaction.feeAmount;
        touched = true;
      }
    } else if (group === "income") {
      if (transaction.type === "income" && !canceled && (names.has(categoryName) || names.has(accountName))) {
        state.balance += transaction.amount; state.credits += transaction.amount; touched = true;
      } else if (transaction.type === "expense" && !canceled && (names.has(categoryName) || names.has(accountName))) {
        state.balance -= transaction.amount; state.debits += transaction.amount; touched = true;
      }
    } else if (group === "liability") {
      if (context.payableDocuments && transaction.method === "check" && transaction.type === "expense" && transaction.check) {
        if (!canceled) { state.balance += transaction.amount; state.credits += transaction.amount; touched = true; }
        if (!canceled && transaction.check.status === "cleared") {
          state.balance -= transaction.amount; state.debits += transaction.amount; touched = true;
        }
      } else if (names.has(categoryName) || names.has(accountName) || names.has(destinationName)) {
        if (transaction.type === "expense") { state.balance -= transaction.amount; state.debits += transaction.amount; touched = true; }
        else if (transaction.type === "income") { state.balance += transaction.amount; state.credits += transaction.amount; touched = true; }
      }
    } else if (group === "equity") {
      if (names.has(categoryName) || names.has(accountName)) {
        if (transaction.type === "income") { state.balance += transaction.amount; state.credits += transaction.amount; touched = true; }
        else if (transaction.type === "expense") { state.balance -= transaction.amount; state.debits += transaction.amount; touched = true; }
      }
    }

    return touched;
  }

  /*
   * مانده‌ی همه‌ی حساب‌ها با یک گذر روی اسناد.
   * خروجی: آرایه‌ای هم‌طول accounts با همان شکل accountBalance (به‌علاوه‌ی id/name/group).
   */
  function balancesForAll(accounts, transactions) {
    var list = accounts || [];
    var documents = transactions || [];
    var contexts = buildContexts(list);
    var byKey = buildAccountsByKey(contexts);

    var states = new Array(list.length);
    for (var index = 0; index < list.length; index += 1) {
      var context = contexts[index];
      states[index] = context
        ? { balance: context.initialBalance, debits: 0, credits: 0, count: 0 }
        : { balance: 0, debits: 0, credits: 0, count: 0 };
    }

    /*
     * حساب‌های ویژه‌ای که هسته بدون بررسی «نامِ سند» لمس می‌کند: هر حساب bank/cash/asset که نامش
     * «اسناد دریافتنی» را در خود داشته باشد، با هر سند چکیِ درآمد لمس می‌شود؛ و هر حساب liability
     * که نامش «اسناد پرداختنی» را دارد، با هر سند چکیِ هزینه. (این رفتار عجیب ولی قفل‌شده است.)
     */
    var receivableAccounts = [];
    var payableAccounts = [];
    for (var specialIndex = 0; specialIndex < contexts.length; specialIndex += 1) {
      var special = contexts[specialIndex];
      if (!special) continue;
      if ((special.group === "bank" || special.group === "cash" || special.group === "asset") && special.receivableDocuments) {
        receivableAccounts.push(specialIndex);
      } else if (special.group === "liability" && special.payableDocuments) {
        payableAccounts.push(specialIndex);
      }
    }

    var stamp = new Uint32Array(list.length);
    var touchedIndexes = [];
    var currentStamp = 0;

    for (var docIndex = 0; docIndex < documents.length; docIndex += 1) {
      var transaction = documents[docIndex];
      if (!transaction) continue;

      /* کلیدهای نامی که این سند ممکن است به آن‌ها اشاره کند */
      var keys = [];
      var pushKey = function (key) { if (key) keys.push(key); };
      pushKey(nameKey(transaction.account));
      pushKey(nameKey(transaction.category));
      pushKey(nameKey(transaction.destinationAccount));
      pushKey(nameKey(transaction.feeAccount));
      pushKey(nameKey(transaction.check && transaction.check.linkedBank));
      if (transaction.isCompound) {
        var sources = transaction.compoundSources || [];
        for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
          if (sources[sourceIndex]) pushKey(nameKey(sources[sourceIndex].account));
        }
        var destinations = transaction.compoundDestinations || [];
        for (var destinationIndex = 0; destinationIndex < destinations.length; destinationIndex += 1) {
          if (destinations[destinationIndex]) pushKey(nameKey(destinations[destinationIndex].account));
        }
      }

      currentStamp += 1;
      touchedIndexes.length = 0;
      for (var keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
        var candidates = byKey.get(keys[keyIndex]);
        if (!candidates) continue;
        for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
          var accountIndex = candidates[candidateIndex];
          if (stamp[accountIndex] === currentStamp) continue;
          stamp[accountIndex] = currentStamp;
          touchedIndexes.push(accountIndex);
        }
      }
      /* حساب‌های ویژه‌ای که فقط با نوع سند لمس می‌شوند (بدون تطبیق نام) */
      if (transaction.method === "check" && transaction.check) {
        var checked = transaction.type === "income" ? receivableAccounts
          : transaction.type === "expense" ? payableAccounts : [];
        for (var checkedIndex = 0; checkedIndex < checked.length; checkedIndex += 1) {
          var checkedAccount = checked[checkedIndex];
          if (stamp[checkedAccount] === currentStamp) continue;
          stamp[checkedAccount] = currentStamp;
          touchedIndexes.push(checkedAccount);
        }
      }

      /* حساب‌های ویژه‌ی «اسناد دریافتنی/پرداختنی/کارمزد» هم ممکن است بدون کلید بالا لمس شوند */
      if (transaction.method === "check" || (transaction.feeAmount && transaction.feeAmount > 0)) {
        for (var specialIndex = 0; specialIndex < SPECIAL_KEYS.length; specialIndex += 1) {
          var specialAccounts = byKey.get(SPECIAL_KEYS[specialIndex]);
          if (!specialAccounts) continue;
          for (var specialAccountIndex = 0; specialAccountIndex < specialAccounts.length; specialAccountIndex += 1) {
            var specialAccount = specialAccounts[specialAccountIndex];
            if (stamp[specialAccount] === currentStamp) continue;
            stamp[specialAccount] = currentStamp;
            touchedIndexes.push(specialAccount);
          }
        }
      }

      for (var touchedIndex = 0; touchedIndex < touchedIndexes.length; touchedIndex += 1) {
        var targetIndex = touchedIndexes[touchedIndex];
        var targetContext = contexts[targetIndex];
        if (!targetContext) continue;
        var targetState = states[targetIndex];
        if (applyTransaction(targetState, targetContext, transaction)) targetState.count += 1;
      }
    }

    var rows = new Array(list.length);
    for (var rowIndex = 0; rowIndex < list.length; rowIndex += 1) {
      var rowContext = contexts[rowIndex];
      var rowState = states[rowIndex];
      rows[rowIndex] = {
        id: rowContext ? rowContext.account.id : undefined,
        name: rowContext ? rowContext.account.name : undefined,
        group: rowContext ? rowContext.account.group : undefined,
        balance: rowState.balance,
        initialBalance: rowContext ? rowContext.initialBalance : 0,
        totalDebits: rowState.debits,
        totalCredits: rowState.credits,
        transactionCount: rowState.count,
        entriesCount: rowState.count,
      };
    }
    return rows;
  }

  /* مانده‌ی یک حساب از نتیجه‌ی گذر (بدون محاسبه‌ی دوباره) */
  function balanceOf(rows, accountOrId) {
    if (!rows) return null;
    var id = accountOrId && typeof accountOrId === "object" ? accountOrId.id : accountOrId;
    for (var index = 0; index < rows.length; index += 1) {
      if (rows[index] && rows[index].id === id) return rows[index];
    }
    return null;
  }

  return {
    version: 1,
    balancesForAll: balancesForAll,
    balanceOf: balanceOf,
    /* برای آزمون: گام خالص یک سند روی یک حساب */
    applyTransaction: applyTransaction,
    buildContexts: buildContexts,
  };
});
