/*
 * لایه‌ی دامنه — درخت حساب‌ها و مانده‌ی حساب (مرحله ۵، تصمیم R5)
 *
 * این ماژول پیاده‌سازی خالص و خوانای همان منطقی است که در باندل مینیفای‌شده (gl/tl/k0/ch/rN/Nr)
 * وجود دارد و **هیچ تغییری در باندل نمی‌دهد**. هم‌رفتاری با هسته با آزمون سایه‌ای اثبات می‌شود
 * (tests/domain-shadow.test.cjs): برای هر حساب و هر سند، خروجی دو پیاده‌سازی مو‌به‌مو مقایسه می‌شود.
 *
 * قواعد قفل‌شده که عمداً «همان‌طور» بازتولید شده‌اند (شامل رفتارهای عجیب هسته):
 *   • کلید تطبیق نام حساب = trim + toLowerCase؛ نام حساب والد شامل همه‌ی فرزندان است.
 *   • حساب‌های بدون نام در جست‌وجوی نام نیستند، ولی در جمع initialBalance با شناسه شرکت می‌کنند.
 *   • چک برگشتی/مسترد اصلِ سند را خنثی می‌کند ولی کارمزدش در تفکیک می‌ماند.
 *   • حساب‌های bank/cash/asset فقط سند «تسویه‌شده» (cleared) یا بدون چک را می‌بینند.
 *
 * وابستگی: هیچ.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else (root.HesabnoDomain = root.HesabnoDomain || {}).accounts = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CANCELED_TEXT = /برگشت|مسترد|returned|refund|bounc|dishonor/i;
  var CANCELED_STATUSES = ["bounced", "refunded", "returned", "returned_check", "dishonored"];
  var FEE_ACCOUNT_NAMES = ["هزینه کارمزد و بهره", "کارمزد و بهره", "کارمزد انتقال و خدمات بانکی", "کارمزد پوز و درگاه پرداخت", "کارمزد بانکی"];

  function nameKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isCanceledCheck(transaction) {
    var check = transaction && transaction.check;
    if (!check) return false;
    if (check.debtCanceled === true) return true;
    var status = String(check.status || "").trim().toLowerCase();
    return CANCELED_STATUSES.indexOf(status) !== -1 || CANCELED_TEXT.test(String(check.status || ""));
  }

  /*
   * ساخت درخت حساب‌ها. کش با WeakMap دقیقاً مثل هسته است: اگر آرایه‌ی حساب‌ها در جا تغییر کند،
   * نتیجه‌ی کش‌شده هم مثل هسته قدیمی می‌ماند (هم‌رفتاری، نه بهبودِ بی‌اجازه).
   */
  var cache = new WeakMap();

  function buildAccountTree(accounts) {
    if (!accounts || !Array.isArray(accounts)) {
      return { byId: new Map(), byNameLower: new Map(), descendantsByNameLower: new Map(), descendantsById: new Map() };
    }
    var cached = cache.get(accounts);
    if (cached) return cached;

    var byId = new Map();
    var byNameLower = new Map();
    var childrenByParentId = new Map();
    for (var index = 0; index < accounts.length; index += 1) {
      var account = accounts[index];
      if (!account || !account.name) continue;
      byId.set(account.id, account);
      byNameLower.set(nameKey(account.name), account);
      if (account.parentId !== null && account.parentId !== undefined) {
        var siblings = childrenByParentId.get(account.parentId) || [];
        siblings.push(account);
        childrenByParentId.set(account.parentId, siblings);
      }
    }

    var descendantsById = new Map();
    var descendantsByNameLower = new Map();
    var collect = function (account) {
      if (!account) return new Set();
      if (descendantsById.has(account.id)) return descendantsById.get(account.id);
      var names = new Set();
      var ownKey = nameKey(account.name);
      if (ownKey) names.add(ownKey);
      var children = childrenByParentId.get(account.id);
      if (children) {
        for (var childIndex = 0; childIndex < children.length; childIndex += 1) {
          var child = children[childIndex];
          if (!child) continue;
          var childNames = collect(child);
          childNames.forEach(function (name) { names.add(name); });
        }
      }
      descendantsById.set(account.id, names);
      if (ownKey) descendantsByNameLower.set(ownKey, names);
      return names;
    };
    for (var accountIndex = 0; accountIndex < accounts.length; accountIndex += 1) collect(accounts[accountIndex]);

    var tree = { byId: byId, byNameLower: byNameLower, descendantsByNameLower: descendantsByNameLower, descendantsById: descendantsById };
    cache.set(accounts, tree);
    return tree;
  }

  /* پیدا کردن حساب با نام (هم‌رفتار با tl: هر ترتیبی از آرگومان‌ها) */
  function findAccountByName(first, second) {
    var name = "";
    var accounts = [];
    if (typeof first === "string") { name = first; accounts = Array.isArray(second) ? second : []; }
    else if (Array.isArray(first)) { accounts = first; name = typeof second === "string" ? second : ""; }
    if (!name || !accounts.length) return undefined;
    return buildAccountTree(accounts).byNameLower.get(name.trim().toLowerCase());
  }

  function accountGroup(name, accounts) {
    var account = findAccountByName(name, accounts);
    return account == null ? undefined : account.group;
  }

  function isPersonAccount(name, accounts) {
    var account = findAccountByName(name, accounts);
    return (account == null ? undefined : account.group) === "person";
  }

  /* آیا حساب اول، خود یا فرزند حساب دوم است؟ (هم‌رفتار با rN) */
  function isDescendantAccount(name, parentName, accounts) {
    if (!name || !parentName) return false;
    if (name === parentName) return true;
    var names = buildAccountTree(accounts).descendantsByNameLower.get(String(parentName || "").trim().toLowerCase());
    return names ? names.has(String(name || "").trim().toLowerCase()) : false;
  }

  /*
   * مانده و گردش یک حساب، دقیقاً با همان قواعد هسته:
   *   balance     = initialBalance + اثر اسناد
   *   totalDebits / totalCredits بر اساس نوع سند و گروه حساب
   *   transactionCount = تعداد اسنادی که این حساب را لمس کرده‌اند
   */
  function accountBalance(account, accounts, transactions) {
    if (!account) return { balance: 0, initialBalance: 0, totalDebits: 0, totalCredits: 0, transactionCount: 0, entriesCount: 0 };

    var tree = buildAccountTree(accounts);
    var names = tree.descendantsById.get(account.id) || new Set([nameKey(account.name)]);
    var initialBalance = accounts
      .filter(function (item) { return item.id === account.id || names.has(nameKey(item.name)); })
      .reduce(function (sum, item) { return sum + (item.initialBalance || 0); }, 0);

    var balance = initialBalance;
    var debits = 0;
    var credits = 0;
    var count = 0;
    var group = account.group;
    var nameText = String(account.name || "");

    for (var index = 0; index < transactions.length; index += 1) {
      var transaction = transactions[index];
      if (!transaction) continue;
      var touched = false;

      if (transaction.isCompound) {
        var sources = transaction.compoundSources || [];
        for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
          var source = sources[sourceIndex];
          if (source == null || !source.account || !names.has(nameKey(source.account))) continue;
          touched = true;
          if (transaction.isReversal) debits += source.amount; else credits += source.amount;
          if (group === "bank" || group === "cash" || group === "asset" || group === "person") {
            balance += (transaction.isReversal ? 1 : -1) * source.amount;
          } else if (group === "income") {
            balance += (transaction.isReversal ? -1 : 1) * source.amount;
          }
          if (group === "expense" && transaction.isReversal) balance += source.amount;
        }

        var destinations = transaction.compoundDestinations || [];
        for (var destinationIndex = 0; destinationIndex < destinations.length; destinationIndex += 1) {
          var destination = destinations[destinationIndex];
          if (destination == null || !destination.account || !names.has(nameKey(destination.account))) continue;
          touched = true;
          if (transaction.isReversal) credits += destination.amount; else debits += destination.amount;
          if (group === "bank" || group === "cash" || group === "asset" || group === "person" || group === "expense"
            || (group === "income" && transaction.isReversal)) {
            balance += (transaction.isReversal ? -1 : 1) * destination.amount;
          }
        }

        if ((group === "bank" || group === "cash" || group === "asset") && transaction.feeAmount && transaction.feeAmount > 0) {
          var compoundFeeAccount = nameKey(transaction.feeAccount || transaction.account || "");
          if (names.has(compoundFeeAccount)) {
            balance -= (transaction.isReversal ? -1 : 1) * transaction.feeAmount;
            if (transaction.isReversal) debits += transaction.feeAmount; else credits += transaction.feeAmount;
            touched = true;
          }
        }

        if (touched) count += 1;
        continue;
      }

      var accountName = nameKey(transaction.account);
      var categoryName = nameKey(transaction.category);
      var destinationName = nameKey(transaction.destinationAccount);
      var feeAccountName = nameKey(transaction.feeAccount);
      var linkedBankName = nameKey(transaction.check && transaction.check.linkedBank);
      var canceled = isCanceledCheck(transaction);

      if (group === "bank" || group === "cash" || group === "asset") {
        var receivableDocuments = names.has("اسناد دریافتنی") || nameText.indexOf("اسناد دریافتنی") !== -1;
        if (receivableDocuments) {
          if (transaction.method === "check" && transaction.type === "income" && transaction.check) {
            if (!canceled) { balance += transaction.amount; debits += transaction.amount; touched = true; }
            if (!canceled && transaction.check.status === "cleared") { balance -= transaction.amount; credits += transaction.amount; touched = true; }
          }
        } else {
          if (transaction.type === "income") {
            if (names.has(accountName) && (!transaction.check || transaction.check.status === "cleared")) {
              balance += transaction.amount; debits += transaction.amount; touched = true;
            }
          } else if (transaction.type === "expense") {
            if (names.has(accountName) && (!transaction.check || transaction.check.status === "cleared")) {
              balance -= transaction.amount; credits += transaction.amount; touched = true;
            }
          } else if (transaction.type === "transfer") {
            if (names.has(accountName)) {
              balance += (transaction.isReversal ? 1 : -1) * transaction.amount;
              if (transaction.isReversal) debits += transaction.amount; else credits += transaction.amount;
              touched = true;
            }
            if (names.has(destinationName)) {
              balance += (transaction.isReversal ? -1 : 1) * transaction.amount;
              if (transaction.isReversal) credits += transaction.amount; else debits += transaction.amount;
              touched = true;
            }
          }
          if (transaction.check && transaction.check.status === "cleared" && linkedBankName && names.has(linkedBankName)) {
            if (transaction.type === "expense" && !names.has(accountName)) {
              balance -= transaction.amount; credits += transaction.amount; touched = true;
            } else if (transaction.type === "income" && !names.has(accountName)) {
              balance += transaction.amount; debits += transaction.amount; touched = true;
            }
          }
        }
        if (transaction.feeAmount && transaction.feeAmount > 0) {
          var feeApplies = transaction.isReversal
            ? names.has(feeAccountName)
            : (names.has(accountName) || (linkedBankName && names.has(linkedBankName)));
          if (feeApplies) {
            balance -= (transaction.isReversal ? -1 : 1) * transaction.feeAmount;
            if (transaction.isReversal) debits += transaction.feeAmount; else credits += transaction.feeAmount;
            touched = true;
          }
        }
      } else if (group === "person") {
        if (transaction.type === "expense" && !canceled && names.has(categoryName)) {
          balance += transaction.amount; debits += transaction.amount; touched = true;
        } else if (transaction.type === "income" && !canceled && names.has(categoryName)) {
          balance -= transaction.amount; credits += transaction.amount; touched = true;
        } else if (transaction.type === "transfer") {
          if (names.has(accountName)) { balance -= transaction.amount; credits += transaction.amount; touched = true; }
          if (names.has(destinationName)) { balance += transaction.amount; debits += transaction.amount; touched = true; }
        }
      } else if (group === "expense") {
        if (transaction.type === "expense" && !canceled && (names.has(categoryName) || names.has(accountName))) {
          balance += transaction.amount; debits += transaction.amount; touched = true;
        } else if (transaction.type === "income" && !canceled && (names.has(categoryName) || names.has(accountName))) {
          balance -= transaction.amount; credits += transaction.amount; touched = true;
        }
        var feeAccountTouched = (feeAccountName && names.has(feeAccountName))
          || FEE_ACCOUNT_NAMES.some(function (name) { return names.has(name); });
        if (transaction.feeAmount && transaction.feeAmount > 0 && feeAccountTouched) {
          balance += (transaction.isReversal ? -1 : 1) * transaction.feeAmount;
          if (transaction.isReversal) credits += transaction.feeAmount; else debits += transaction.feeAmount;
          touched = true;
        }
      } else if (group === "income") {
        if (transaction.type === "income" && !canceled && (names.has(categoryName) || names.has(accountName))) {
          balance += transaction.amount; credits += transaction.amount; touched = true;
        } else if (transaction.type === "expense" && !canceled && (names.has(categoryName) || names.has(accountName))) {
          balance -= transaction.amount; debits += transaction.amount; touched = true;
        }
      } else if (group === "liability") {
        var payableDocuments = names.has("اسناد پرداختنی") || names.has("چک ها و اسناد پرداختنی") || nameText.indexOf("اسناد پرداختنی") !== -1;
        if (payableDocuments && transaction.method === "check" && transaction.type === "expense" && transaction.check) {
          if (!canceled) { balance += transaction.amount; credits += transaction.amount; touched = true; }
          if (!canceled && transaction.check.status === "cleared") { balance -= transaction.amount; debits += transaction.amount; touched = true; }
        } else if (names.has(categoryName) || names.has(accountName) || names.has(destinationName)) {
          if (transaction.type === "expense") { balance -= transaction.amount; debits += transaction.amount; touched = true; }
          else if (transaction.type === "income") { balance += transaction.amount; credits += transaction.amount; touched = true; }
        }
      } else if (group === "equity") {
        if (names.has(categoryName) || names.has(accountName)) {
          if (transaction.type === "income") { balance += transaction.amount; credits += transaction.amount; touched = true; }
          else if (transaction.type === "expense") { balance -= transaction.amount; debits += transaction.amount; touched = true; }
        }
      }

      if (touched) count += 1;
    }

    return {
      balance: balance,
      initialBalance: initialBalance,
      totalDebits: debits,
      totalCredits: credits,
      transactionCount: count,
      entriesCount: count,
    };
  }

  return {
    nameKey: nameKey,
    isCanceledCheck: isCanceledCheck,
    buildAccountTree: buildAccountTree,
    findAccountByName: findAccountByName,
    accountGroup: accountGroup,
    isPersonAccount: isPersonAccount,
    isDescendantAccount: isDescendantAccount,
    accountBalance: accountBalance,
  };
});
