/*
 * نگهبان مهاجرت‌های داده (مرحله ۶.۰)
 *
 * چرا؟ در مرحله ۲ پیدا شد که پنج مهاجرت برنامه (006/007/059/065/094) مستقیم روی داده‌ی واقعی
 * کاربر می‌نویسند و هیچ مسیر بازگشتی ندارند: اگر نوشتن وسط کار بشکند (سهمیه‌ی پر، storage
 * مسدود، خطای کد)، ممکن است داده نیمه‌نوشته بماند یا کلیدها ناهماهنگ شوند.
 *
 * این نگهبان همان پنج مهاجرت را «اتمی» می‌کند، بدون تغییر در فرمت داده و بدون اضافه‌کردن هیچ
 * کلید ماندگار:
 *   ۱) پیش از هر نوشتن، مقدار خام کلیدهای هدف در حافظه عکس‌برداری می‌شود.
 *   ۲) هر نوشتن با **خواندن دوباره** تأیید می‌شود (نوشتن بی‌صدا ردشده = شکست).
 *   ۳) اگر هر مرحله شکست بخورد یا خطا بدهد، همه‌ی کلیدهای عکس‌برداری‌شده به مقدار قبلی برمی‌گردند.
 *   ۴) عکس‌برداری فقط در طول اجرای همان مهاجرت است و بعد آزاد می‌شود (هیچ کلید تازه‌ای ذخیره نمی‌شود).
 *
 * محدودیت صریح: اگر صفحه بین نوشتن و تأیید کرش کند (فرآیند از بین برود)، عکس‌برداری درون‌حافظه‌ای
 * هم از بین می‌رود. برای پوشش آن حالت به یک نسخه‌ی پشتیبان ماندگار نیاز است که **کلید تازه** می‌سازد؛
 * چون تغییر/افزودن کلید از stop-condition های پروژه است، انجام نشد و اینجا مستند شده است.
 *
 * API:
 *   window.__hesabnoMigration.run(id, keys, function (db) { db.set(k, v); db.remove(k); });
 *   db.get(key) → مقدار خام (localStorage یا حافظه‌ی جایگزین)
 *   نتیجه: { ok: true, written: [...] } یا { ok: false, reason, error, restored: true }
 *   گزارش شکست‌ها (فقط در حافظه): window.__hesabnoMigration.failures
 */
(function () {
  var existing = window.__hesabnoMigration;
  if (existing && existing.version >= 1 && typeof existing.run === "function") return;

  var failures = [];

  var memoryStore = function () {
    window.__hesabnoMemoryStorage = window.__hesabnoMemoryStorage || {};
    return window.__hesabnoMemoryStorage;
  };

  var storageRef = function () {
    try { return window.localStorage || null; } catch (error) { return null; }
  };

  var readRaw = function (storage, memory, key) {
    try {
      if (storage) {
        var stored = storage.getItem(key);
        if (stored !== null && stored !== undefined) return stored;
      }
    } catch (error) {}
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  };

  var warn = function (message) {
    try { if (window.console && window.console.warn) window.console.warn("[hesabno] " + message); } catch (error) {}
  };

  /*
   * اجرای یک مهاجرت با عکس‌برداری، تأیید خواندن دوباره و بازگردانی خودکار.
   * body فقط از طریق db می‌نویسد تا هر نوشتن قابل تأیید و بازگردانی باشد.
   */
  var run = function (id, keys, body) {
    if (typeof body !== "function") return { ok: false, reason: "body" };
    var storage = storageRef();
    var memory = memoryStore();
    var snapshot = Object.create(null);   /* key → { present, value } */
    var written = [];

    var remember = function (key) {
      if (key in snapshot) return;
      var value = readRaw(storage, memory, key);
      snapshot[key] = { present: value !== null && value !== undefined, value: value };
    };

    /* هر کلید اعلام‌شده از قبل عکس‌برداری می‌شود؛ کلید خارج از اعلام هم تنبل عکس‌برداری می‌شود */
    (keys || []).forEach(remember);

    var db = {
      get: function (key) { return readRaw(storage, memory, key); },
      set: function (key, value) {
        remember(key);
        var text = String(value);
        var persisted = false;
        try {
          if (storage) {
            storage.setItem(key, text);
            /* تأیید خواندن دوباره: نوشتن بی‌صدا ردشده باید شکست شمرده شود */
            var readBack = storage.getItem(key);
            persisted = readBack === text;
          }
        } catch (error) {
          persisted = false;
        }
        if (!persisted) {
          memory[key] = text;   /* همان رفتار جایگزین قبلی مهاجرت‌ها (حافظه) */
          if (storage) {
            var fallback = null;
            try { fallback = storage.getItem(key); } catch (error) {}
            if (fallback !== text) throw new Error("نوشتن " + key + " تأیید نشد");
          }
        }
        written.push(key);
        return persisted;
      },
      remove: function (key) {
        remember(key);
        try { if (storage) storage.removeItem(key); } catch (error) {}
        delete memory[key];
        written.push(key);
      },
    };

    var matchesSnapshot = function (entry, current) {
      return entry.present ? current === entry.value : (current === null || current === undefined);
    };

    var restore = function () {
      var restoredAll = true;
      Object.keys(snapshot).forEach(function (key) {
        var entry = snapshot[key];
        /* اگر مقدار فعلی همان مقدار قبلی است (مثلاً نوشتن اصلاً انجام نشده)، کاری لازم نیست */
        if (matchesSnapshot(entry, readRaw(storage, memory, key))) return;
        try {
          if (entry.present) {
            if (storage) storage.setItem(key, entry.value);
            memory[key] = entry.value;
          } else {
            if (storage) { try { storage.removeItem(key); } catch (error) {} }
            delete memory[key];
          }
        } catch (error) {}
        /* تأیید نهایی: بازگردانی فقط وقتی موفق است که مقدار فعلی با عکس‌برداری یکی باشد */
        if (!matchesSnapshot(entry, readRaw(storage, memory, key))) {
          restoredAll = false;
          warn("بازگردانی کلید " + key + " ناموفق بود");
        }
      });
      return restoredAll;
    };

    try {
      body(db);
      return { ok: true, written: written.slice() };
    } catch (error) {
      var restored = restore();
      var failure = { id: id, reason: "write", message: String((error && error.message) || error), restored: restored, at: Date.now() };
      failures.push(failure);
      if (failures.length > 20) failures.shift();
      warn("مهاجرت " + id + " شکست خورد و " + (restored ? "بازگردانی شد" : "بازگردانی کامل نشد"));
      return { ok: false, reason: "write", error: error, restored: restored };
    }
  };

  window.__hesabnoMigration = {
    version: 1,
    run: run,
    failures: failures,
    /* برای آزمون‌ها: تعداد شکست‌های ثبت‌شده و پاک‌کردن آن‌ها */
    clearFailures: function () { failures.length = 0; },
  };
})();
