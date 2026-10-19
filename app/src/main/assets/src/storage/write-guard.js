/*
 * نگهبان نوشتن در حافظه‌ی مرورگر (مرحله ۶.۲)
 *
 * چرا؟ پیش از این، هشدار «فضا پر شد» داخل ۰۰۴ و بعد از سه نوشتن بوت نصب می‌شد؛ یعنی اگر سهمیه
 * در همان نوشتن‌های اولیه (حساب‌ها/تراکنش‌ها) تمام می‌شد، کاربر هیچ هشداری نمی‌دید و تغییرش
 * بی‌صدا از دست می‌رفت. همچنین هیچ‌جا شمارش/گزارش شکست نوشتن وجود نداشت.
 *
 * این ماژول رفتار را عوض نمی‌کند: خطا را **دوباره پرتاب می‌کند** تا هر کدی که قبلاً خطا را
 * مدیریت می‌کرد، دقیقاً همان رفتار را داشته باشد. فقط مشاهده‌پذیری اضافه می‌کند:
 *   • دسته‌بندی خطا: quota | security | unknown
 *   • شمارنده و بافر حلقوی از شکست‌ها (فقط در حافظه — هیچ کلید ذخیره‌سازی تازه‌ای ساخته نمی‌شود)
 *   • رخداد پنجره «hesabno:storage-write-failed» با key/bytes/reason
 *   • همان alert فارسی قبلی، با محدودیت ۱۰ ثانیه‌ای (عیناً از ۰۰۴ منتقل شده است)
 *   • حذف نوشتن بی‌تغییر (۶.۳): اگر مقدار جدید با موجود یکی باشد، نوشتن فیزیکی انجام نمی‌شود
 *
 * داده‌ی خالص و UMD است؛ در Node آزمون‌پذیر و در مرورگر بدون وابستگی.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.HesabnoStorage = root.HesabnoStorage || {}).guard = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  "use strict";

  var VERSION = 1;
  var EVENT_NAME = "hesabno:storage-write-failed";
  var ALERT_TEXT = "فضای ذخیره‌سازی پر شده و آخرین تغییر ذخیره نشد.\n" +
    "لطفاً از اطلاعات پشتیبان بگیرید و داده‌های قدیمی را پاک کنید.";
  var RATE_LIMIT_MS = 10000;
  var MAX_FAILURES = 50;

  /* نام و کد خطاهای سهمیه در مرورگرهای مختلف (Safari کد ۲۲ با نام QUOTA_EXCEEDED_ERR، فایرفاکس ۱۰۱۴) */
  function classify(error) {
    if (!error) return "unknown";
    var name = String(error.name || "");
    var code = Number(error.code);
    var message = String(error.message || "");
    if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        code === 22 || code === 1014 || /quota/i.test(message) || /storage.*full/i.test(message)) {
      return "quota";
    }
    if (name === "SecurityError" || code === 18 || /denied|blocked|security/i.test(message)) return "security";
    return "unknown";
  }

  function install(options) {
    var opts = options || {};
    var proto = opts.proto || (typeof Storage !== "undefined" ? Storage.prototype : null);
    var win = opts.win || (typeof window !== "undefined" ? window : null);
    var now = opts.now || function () { return Date.now(); };
    var rateLimit = typeof opts.rateLimitMs === "number" ? opts.rateLimitMs : RATE_LIMIT_MS;
    var maxFailures = typeof opts.maxFailures === "number" ? opts.maxFailures : MAX_FAILURES;
    /*
     * حذف نوشتن بی‌تغییر (مرحله ۶.۳): اگر مقدارِ جدید با مقدار موجود برابر باشد، نوشتن انجام نمی‌شود.
     * نزدیک‌ترین رفتار به «بدون تغییر» است، چون خود Web Storage هم برای مقدار یکسان رخداد
     * `storage` نمی‌فرستد. برای سازگاری کامل، پیش‌فرض خاموش است و نصب‌کننده‌ی برنامه روشنش می‌کند.
     */
    var skipUnchanged = opts.skipUnchanged === true;
    var nativeGetItem = typeof proto.getItem === "function" ? proto.getItem : null;
    var alertFn = opts.alertFn || function (message) {
      if (!win || typeof win.alert !== "function") return;
      win.setTimeout ? win.setTimeout(function () { win.alert(message); }, 0) : win.alert(message);
    };

    if (!proto || typeof proto.setItem !== "function") return null;

    /* نصب دوباره‌ی همین نگهبان بی‌اثر است (مثلاً اگر اسکریپت دو بار اجرا شود) */
    if (proto.setItem.__hesabnoStorageWriteGuard === VERSION && proto.__hesabnoStorageWriteGuardApi) {
      return proto.__hesabnoStorageWriteGuardApi;
    }

    var nativeSetItem = proto.setItem;
    var state = {
      version: VERSION,
      installs: 1,
      writes: 0,
      failures: 0,
      alerts: 0,
      skipped: 0,
      skippedBytes: 0,
      lastFailure: null,
      recent: [],
      writeSubscribers: [],
      failureSubscribers: [],
    };

    /* یک خطای مشترک نباید نوشتن را بشکند */
    function notify(list, payload) {
      for (var index = 0; index < list.length; index += 1) {
        try { list[index](payload); } catch (ignored) {}
      }
    }

    function record(key, value, error, storageName) {
      var reason = classify(error);
      var failure = {
        key: String(key),
        storage: storageName,
        reason: reason,
        bytes: typeof value === "string" ? value.length : 0,
        at: now(),
        message: String((error && error.message) || error || "").slice(0, 200),
      };
      state.failures += 1;
      state.lastFailure = failure;
      state.recent.push(failure);
      if (state.recent.length > maxFailures) state.recent.shift();

      notify(state.failureSubscribers, failure);

      /* رویداد برای مصرف‌کننده‌های بعدی (مرحله ۸: هشدار پایدار و پیشنهاد پشتیبان) */
      if (win && typeof win.dispatchEvent === "function" && typeof win.CustomEvent === "function") {
        try {
          win.dispatchEvent(new win.CustomEvent(EVENT_NAME, { detail: failure }));
        } catch (ignored) {}
      }

      /* همان هشدار کاربر، حداکثر یک بار در هر بازه — رفتار قبلی ۰۰۴ */
      var lastAlert = state.__lastAlert || 0;
      if (reason === "quota" && failure.at - lastAlert > rateLimit) {
        state.__lastAlert = failure.at;
        state.alerts += 1;
        try { alertFn(ALERT_TEXT); } catch (ignored) {}
      }
      return failure;
    }

    function storageNameOf(target) {
      try {
        if (win && win.localStorage && target === win.localStorage) return "local";
        if (win && win.sessionStorage && target === win.sessionStorage) return "session";
      } catch (ignored) {}
      return "unknown";
    }

    var wrapped = function (key, value) {
      state.writes += 1;
      var result;
      if (skipUnchanged && nativeGetItem) {
        var existing = null;
        try { existing = nativeGetItem.call(this, key); } catch (ignored) { existing = null; }
        if (existing !== null && existing === String(value)) {
          state.skipped += 1;
          state.skippedBytes += String(value).length;
          /* همان اعلانی که نوشتن واقعی می‌داد، تا رفتار مصرف‌کننده‌ها عوض نشود */
          notify(state.writeSubscribers, {
            key: String(key), value: value, storage: storageNameOf(this), skipped: true,
          });
          return undefined;
        }
      }
      try {
        result = nativeSetItem.call(this, key, value);
      } catch (error) {
        /* نام دقیق حافظه: localStorage یا sessionStorage — برای تشخیص مسیر پشتیبان مهم است */
        record(key, value, error, storageNameOf(this));
        throw error; /* رفتار قبلی: خطا هرگز بلعیده نمی‌شود */
      }
      /* مشترک‌ها فقط پس از نوشتن موفق صدا زده می‌شوند (مثل وصله‌های قبلی ۱۴۵/۱۴۸/۱۵۴) */
      notify(state.writeSubscribers, {
        key: String(key), value: value, storage: storageNameOf(this), skipped: false,
      });
      return result;
    };
    wrapped.__hesabnoStorageWriteGuard = VERSION;

    proto.setItem = wrapped;

    var api = {
      version: VERSION,
      eventName: EVENT_NAME,
      alertText: ALERT_TEXT,
      nativeSetItem: nativeSetItem,
      stats: function () {
        return {
          version: VERSION,
          writes: state.writes,
          failures: state.failures,
          alerts: state.alerts,
          skipped: state.skipped,
          skippedBytes: state.skippedBytes,
          lastFailure: state.lastFailure,
          subscribers: { write: state.writeSubscribers.length, failure: state.failureSubscribers.length },
        };
      },
      failures: function () { return state.recent.slice(); },
      /*
       * جایگزین وصله‌های روی‌هم‌سوار: هر اسکریپت به‌جای `Storage.prototype.setItem = ...`
       * اینجا مشترک می‌شود. ترتیب اجرا = ترتیب ثبت.
       */
      onWrite: function (callback) {
        if (typeof callback !== "function") return function () {};
        state.writeSubscribers.push(callback);
        return function () {
          var index = state.writeSubscribers.indexOf(callback);
          if (index > -1) state.writeSubscribers.splice(index, 1);
        };
      },
      onWriteFail: function (callback) {
        if (typeof callback !== "function") return function () {};
        state.failureSubscribers.push(callback);
        return function () {
          var index = state.failureSubscribers.indexOf(callback);
          if (index > -1) state.failureSubscribers.splice(index, 1);
        };
      },
      subscriberCount: function () {
        return { write: state.writeSubscribers.length, failure: state.failureSubscribers.length };
      },
      classify: classify,
      /* فقط برای آزمون: جداسازی کامل و بازگرداندن تابع اصلی */
      uninstall: function () {
        if (proto.setItem === wrapped) proto.setItem = nativeSetItem;
        try { delete proto.__hesabnoStorageWriteGuardApi; } catch (ignored) {}
      },
    };
    try { proto.__hesabnoStorageWriteGuardApi = api; } catch (ignored) {}
    return api;
  }

  return {
    version: VERSION,
    eventName: EVENT_NAME,
    alertText: ALERT_TEXT,
    classify: classify,
    install: install,
  };
});
