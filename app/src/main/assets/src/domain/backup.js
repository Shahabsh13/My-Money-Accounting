/*
 * لایه‌ی دامنه — پشتیبان، اعتبارسنجی و بازیابی (مرحله ۸)
 *
 * چرا این ماژول؟ مسیر پشتیبان/بازیابی برنامه در سه جای مختلف پیاده شده بود (۱۰۸ برای ریست،
 * ۰۶۷ برای دانلود/بازیابی JSON، ۲۰۳ برای نسخه‌ی رمزگذاری‌شده) و اعتبارسنجی هر کدام فقط بخشی از
 * فایل را می‌دید. این ماژول **قرارداد همان قالب موجود (نسخه 5.1)** را یک‌جا و خالص تعریف می‌کند:
 *
 *   capture        → برداشتن خام همه‌ی کلیدهای داده (همان فهرست پشتیبان) از یک Storage
 *   buildEnvelope  → ساخت همان فایل JSON نسخه‌ی 5.1 (بدون تاریخ‌سازی داخلی؛ زمان تزریق می‌شود)
 *   validateEnvelope → بررسی کامل فایل پیش از بازیابی، با خطا/هشدار قابل‌نمایش
 *   planRestore    → نقشه‌ی نوشتن/حذف بدون دست‌زدن به داده (dry-run)
 *   applyRestore   → اجرای نقشه با تأیید خواندن مجدد و بازگردانی کامل در صورت شکست
 *
 * قواعد سازگاری:
 *   • فایل‌های نسخه‌ی قبل ۲۳ کلید داشتند؛ هر دو مجموعه (۲۳ و ۲۴) پذیرفته می‌شود.
 *   • کلیدهای فایل قدیمی که در آن نیستند، هنگام بازیابی **دست‌نخورده** می‌مانند.
 *   • هیچ کلید تازه‌ای ساخته نمی‌شود و هیچ قالب داده‌ای عوض نمی‌شود.
 *
 * وابستگی: هیچ. فهرست کلیدها تزریق می‌شود (tests/helpers یا رجیستری مرحله ۶.۱).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else (root.HesabnoDomain = root.HesabnoDomain || {}).backup = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var FORMAT_VERSION = "5.1";
  var MODULE_VERSION = 1;
  /* سقف هشدار حجم: Web Storage حدود ۵ مگابایت است؛ فایل بزرگ‌تر تقریباً قطعاً بازیابی نمی‌شود */
  var WARN_BYTES = 4 * 1024 * 1024;

  var ARRAY_FIELDS = ["accounts", "transactions", "checks", "loans", "installments", "budgets",
    "fiscalYears", "shortcuts", "projects", "familyMembers"];
  var REQUIRED_ARRAYS = ["accounts", "transactions"];

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function byteLength(text) {
    var value = String(text == null ? "" : text);
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).length;
    return value.length;
  }

  function sameKeySet(keys, declared) {
    if (keys.length !== declared.length) return false;
    for (var index = 0; index < declared.length; index += 1) {
      if (keys.indexOf(declared[index]) === -1) return false;
    }
    return true;
  }

  /*
   * برداشتن خام کلیدهای پشتیبان. مقداری که وجود ندارد `null` می‌شود (قرارداد فعلی برنامه:
   * null یعنی «این کلید در فایل نبود» و هنگام بازیابی حذف می‌شود).
   */
  function capture(storage, keys) {
    var errors = [];
    var data = {};
    var declared = keys || [];
    for (var index = 0; index < declared.length; index += 1) {
      var key = declared[index];
      try {
        var raw = storage.getItem(key);
        data[key] = raw == null ? null : String(raw);
      } catch (error) {
        errors.push({ key: key, message: String((error && error.message) || error) });
        data[key] = null;
      }
    }
    return { ok: errors.length === 0, data: data, errors: errors };
  }

  /*
   * اعتبارسنجی بخش storageData.
   * options: { keys, legacyKeys }
   */
  function validateStorageData(data, options) {
    var opts = options || {};
    var keys = opts.keys || [];
    var legacyKeys = opts.legacyKeys || [];
    var errors = [];
    var warnings = [];

    if (!isPlainObject(data)) {
      return { ok: false, legacy: false, errors: [{ code: "storage-not-object", message: "بخش ذخیره‌سازی باید شیء باشد" }], warnings: [], keys: [] };
    }
    var present = Object.keys(data);
    var isCurrent = sameKeySet(present, keys);
    var isLegacy = !isCurrent && legacyKeys.length > 0 && sameKeySet(present, legacyKeys);
    if (!isCurrent && !isLegacy) {
      var unknown = present.filter(function (key) { return keys.indexOf(key) === -1 && legacyKeys.indexOf(key) === -1; });
      var missing = keys.filter(function (key) { return present.indexOf(key) === -1; });
      if (unknown.length) errors.push({ code: "storage-unknown-key", keys: unknown, message: "کلید ناشناخته در فایل پشتیبان" });
      if (missing.length) errors.push({ code: "storage-missing-key", keys: missing, message: "کلید داده‌ای در فایل پشتیبان نیست" });
      if (!errors.length) errors.push({ code: "storage-key-set", message: "مجموعه‌ی کلیدها با هیچ نسخه‌ای از پشتیبان نمی‌خواند" });
    }
    for (var index = 0; index < present.length; index += 1) {
      var value = data[present[index]];
      if (value !== null && typeof value !== "string") {
        errors.push({ code: "storage-value-type", key: present[index], message: "مقدار باید رشته یا null باشد" });
      }
    }
    if (isLegacy) {
      warnings.push({
        code: "storage-legacy-version",
        message: "این فایل پشتیبان نسخه‌ی قبل است (بدون تاریخ تسویه‌ی چک)؛ بازیابی می‌شود ولی آن کلید دست‌نخورده می‌ماند",
      });
    }
    return { ok: errors.length === 0, legacy: isLegacy, isCurrent: isCurrent, errors: errors, warnings: warnings, keys: present };
  }

  /*
   * ساخت همان فایل JSON نسخه‌ی 5.1. تاریخ/زمان تزریق می‌شوند تا ماژول خالص بماند.
   * input: { accounts, transactions, checks, loans, installments, budgets, fiscalYears,
   *          activeFiscalYearId, shortcuts, familyMembers, projects, storageData,
   *          currency, numberFormat, exportDate, shamsiDate, timestamp }
   */
  function buildEnvelope(input, options) {
    var data = input || {};
    var opts = options || {};
    var storageData = data.storageData || {};
    var validation = validateStorageData(storageData, opts);
    if (!validation.ok) return { ok: false, errors: validation.errors, envelope: null };

    var envelope = {
      version: FORMAT_VERSION,
      exportDate: data.exportDate || null,
      shamsiDate: data.shamsiDate || null,
      timestamp: typeof data.timestamp === "number" ? data.timestamp : null,
      currency: data.currency === "toman" ? "toman" : "rial",
      numberFormat: data.numberFormat || "slash",
      accounts: data.accounts || [],
      transactions: data.transactions || [],
      checks: data.checks || [],
      loans: data.loans || [],
      installments: data.installments || [],
      budgets: data.budgets || [],
      fiscalYears: data.fiscalYears || [],
      activeFiscalYearId: data.activeFiscalYearId == null ? null : String(data.activeFiscalYearId),
      shortcuts: data.shortcuts || [],
      familyMembers: data.familyMembers || [],
      projects: data.projects || [],
      storageData: storageData,
    };
    var envelopeValidation = validateEnvelope(envelope, opts);
    return { ok: envelopeValidation.ok, errors: envelopeValidation.errors, warnings: envelopeValidation.warnings, envelope: envelope };
  }

  /*
   * اعتبارسنجی کامل فایل پشتیبان (همان چیزی که کاربر انتخاب می‌کند).
   * خطا = بازیابی نباید انجام شود؛ هشدار = بازیابی ممکن است ولی چیزی ناقص است.
   */
  function validateEnvelope(envelope, options) {
    var opts = options || {};
    var errors = [];
    var warnings = [];
    var stats = { accounts: 0, transactions: 0, storageKeys: 0, bytes: 0, legacy: false };

    if (!isPlainObject(envelope)) {
      return { ok: false, errors: [{ code: "not-object", message: "فایل پشتیبان باید یک شیء JSON باشد" }], warnings: [], stats: stats };
    }
    var version = envelope.version;
    if (version !== FORMAT_VERSION && Number(version) !== 5.1) {
      errors.push({ code: "version", message: "نسخه‌ی فایل پشتیبان پشتیبانی نمی‌شود (انتظار: 5.1)" });
    }
    if (envelope.currency !== undefined && envelope.currency !== "rial" && envelope.currency !== "toman") {
      warnings.push({ code: "currency", message: "واحد پول فایل نامعتبر است؛ «ریال» فرض می‌شود" });
    }
    for (var index = 0; index < ARRAY_FIELDS.length; index += 1) {
      var field = ARRAY_FIELDS[index];
      var value = envelope[field];
      var required = REQUIRED_ARRAYS.indexOf(field) !== -1;
      if (value === undefined) {
        if (required) errors.push({ code: "missing-field", field: field, message: "بخش «" + field + "» در فایل نیست" });
        continue;
      }
      if (!Array.isArray(value)) {
        errors.push({ code: "field-type", field: field, message: "بخش «" + field + "» باید آرایه باشد" });
      }
    }
    if (Array.isArray(envelope.accounts)) stats.accounts = envelope.accounts.length;
    if (Array.isArray(envelope.transactions)) stats.transactions = envelope.transactions.length;

    /* بررسی سطحی هر سند: خطا فقط برای ساختار غیرشیئی؛ بقیه هشدار تا فایل‌های قدیمی رد نشوند */
    if (Array.isArray(envelope.transactions)) {
      var badDocuments = 0;
      var badAmounts = 0;
      for (var transactionIndex = 0; transactionIndex < envelope.transactions.length; transactionIndex += 1) {
        var transaction = envelope.transactions[transactionIndex];
        if (!isPlainObject(transaction)) { badDocuments += 1; continue; }
        var amount = transaction.amount;
        if (amount !== undefined && amount !== null && amount !== "" && !isFinite(Number(amount))) badAmounts += 1;
      }
      if (badDocuments) errors.push({ code: "transaction-shape", count: badDocuments, message: "سند نامعتبر (غیرشیء) در فایل هست" });
      if (badAmounts) warnings.push({ code: "transaction-amount", count: badAmounts, message: "مبلغ نامعتبر در بعضی اسناد" });
    }

    if (envelope.storageData === undefined || envelope.storageData === null) {
      warnings.push({
        code: "no-storage-data",
        message: "فایل بخش ذخیره‌سازی ندارد؛ فقط حساب‌ها و اسناد بازیابی می‌شوند و تنظیمات دست‌نخورده می‌ماند",
      });
    } else {
      var storageValidation = validateStorageData(envelope.storageData, opts);
      errors = errors.concat(storageValidation.errors);
      warnings = warnings.concat(storageValidation.warnings);
      stats.storageKeys = storageValidation.keys.length;
      stats.legacy = storageValidation.legacy;
    }

    try {
      stats.bytes = byteLength(JSON.stringify(envelope));
    } catch (error) {
      errors.push({ code: "serialize", message: "فایل قابل تبدیل به JSON نیست" });
    }
    if (stats.bytes > WARN_BYTES) {
      warnings.push({ code: "size", bytes: stats.bytes, message: "حجم داده از ۴ مگابایت بیشتر است؛ ممکن است در ذخیره‌سازی جا نشود" });
    }

    return { ok: errors.length === 0, errors: errors, warnings: warnings, stats: stats };
  }

  /* نقشه‌ی بازیابی — هیچ نوشتنی انجام نمی‌شود */
  function planRestore(storage, storageData, options) {
    var opts = options || {};
    var validation = validateStorageData(storageData, opts);
    if (!validation.ok) {
      return { ok: false, errors: validation.errors, legacy: validation.legacy, writes: [], deletes: [], untouched: [] };
    }
    var writes = [];
    var deletes = [];
    var untouched = [];
    var present = Object.keys(storageData);
    for (var index = 0; index < present.length; index += 1) {
      var key = present[index];
      var value = storageData[key];
      if (value === null) deletes.push(key);
      else writes.push({ key: key, value: value, bytes: byteLength(value) });
    }
    /* کلیدهایی که پشتیبان قدیمی ندارد و بنابراین باید دست‌نخورده بمانند */
    var declared = opts.keys || [];
    for (var declaredIndex = 0; declaredIndex < declared.length; declaredIndex += 1) {
      if (present.indexOf(declared[declaredIndex]) === -1) untouched.push(declared[declaredIndex]);
    }
    return { ok: true, errors: [], legacy: validation.legacy, writes: writes, deletes: deletes, untouched: untouched };
  }

  /*
   * اجرای نقشه با تأیید خواندن مجدد و بازگردانی کامل در صورت شکست.
   * storage: { getItem, setItem, removeItem }
   */
  function applyRestore(storage, plan, options) {
    var opts = options || {};
    if (!plan || !plan.ok) return { ok: false, applied: 0, rolledBack: true, error: "plan-invalid" };

    var previous = new Map();
    var applied = [];
    var keys = plan.writes.map(function (write) { return write.key; }).concat(plan.deletes);

    try {
      for (var index = 0; index < keys.length; index += 1) {
        previous.set(keys[index], storage.getItem(keys[index]));
      }
      for (var writeIndex = 0; writeIndex < plan.writes.length; writeIndex += 1) {
        var write = plan.writes[writeIndex];
        storage.setItem(write.key, write.value);
        applied.push(write.key);
        if (storage.getItem(write.key) !== write.value) throw new Error("verify failed: " + write.key);
      }
      for (var deleteIndex = 0; deleteIndex < plan.deletes.length; deleteIndex += 1) {
        var key = plan.deletes[deleteIndex];
        storage.removeItem(key);
        applied.push(key);
        if (storage.getItem(key) !== null) throw new Error("verify failed: " + key);
      }
      return { ok: true, applied: applied.length, rolledBack: false, error: null };
    } catch (error) {
      var rollbackOk = true;
      for (var rollbackIndex = applied.length - 1; rollbackIndex >= 0; rollbackIndex -= 1) {
        var rollbackKey = applied[rollbackIndex];
        var oldValue = previous.get(rollbackKey);
        try {
          if (oldValue === null || oldValue === undefined) storage.removeItem(rollbackKey);
          else storage.setItem(rollbackKey, oldValue);
        } catch (rollbackError) {
          rollbackOk = false;
        }
      }
      if (opts.onError) {
        try { opts.onError(error); } catch (ignored) {}
      }
      return {
        ok: false,
        applied: applied.length,
        rolledBack: rollbackOk,
        error: String((error && error.message) || error),
      };
    }
  }

  /* آمار خوانا برای نمایش پیش از تأیید بازیابی */
  function summarize(envelope) {
    var stats = { accounts: 0, transactions: 0, checks: 0, storageKeys: 0, legacy: false, createdAt: null };
    if (!isPlainObject(envelope)) return stats;
    if (Array.isArray(envelope.accounts)) stats.accounts = envelope.accounts.length;
    if (Array.isArray(envelope.transactions)) stats.transactions = envelope.transactions.length;
    if (Array.isArray(envelope.checks)) stats.checks = envelope.checks.length;
    if (isPlainObject(envelope.storageData)) {
      var keys = Object.keys(envelope.storageData);
      stats.storageKeys = keys.length;
      stats.legacy = keys.indexOf("hesabno:check_settlement_dates") === -1;
    }
    stats.createdAt = envelope.exportDate || null;
    return stats;
  }

  return {
    version: MODULE_VERSION,
    formatVersion: FORMAT_VERSION,
    arrays: ARRAY_FIELDS,
    capture: capture,
    validateStorageData: validateStorageData,
    buildEnvelope: buildEnvelope,
    validateEnvelope: validateEnvelope,
    planRestore: planRestore,
    applyRestore: applyRestore,
    summarize: summarize,
  };
});
