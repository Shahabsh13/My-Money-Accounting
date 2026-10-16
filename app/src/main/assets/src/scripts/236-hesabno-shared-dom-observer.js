/*
 * لایه‌ی مشترک MutationObserver (مرحله ۴)
 *
 * چرا؟ در برنامه ۱۰۵ اسکریپت جدا هر کدام observer خودشان را می‌ساختند، ولی ۵۷ موردشان
 * دقیقاً روی یک هدف با دقیقاً یک گزینه ثبت شده بود (document.body با childList+subtree).
 * نتیجه: برای هر جهش DOM، ۵۷ callback جداگانه صف می‌شد؛ ۸۷۸ شلیک فقط در زمان بوت.
 *
 * این لایه با یک قاعده‌ی ساده، «هم‌رفتاری» را تضمین می‌کند:
 *   • کلید رجیستری = (هدف + گزینه‌های دقیق). پس هر observer مشترک به‌قاعده‌ی، همان
 *     رخدادهایی را می‌گیرد که observerهای اصلی می‌گرفتند — نه بیشتر، نه کمتر.
 *   • ترتیب اجرا = ترتیب ثبت = همان ترتیب ساخت observerها در کد اصلی (اسکریپت‌ها به ترتیب
 *     بارگذاری می‌شوند و هر اسکریپت در همان لحظه ثبت می‌کند)، پس ترتیب اجرای callbackها حفظ می‌شود.
 *   • خطای یک callback بقیه را متوقف نمی‌کند (در حالت قبلی هر observer مستقل بود و خطای یکی
 *     روی دیگری اثر نداشت؛ اینجا با try/catch همان تضمین حفظ می‌شود).
 *   • هر ثبت‌کننده یک «نماینده» (facade) می‌گیرد که disconnect() آن فقط همان ثبت را برمی‌دارد
 *     و observer مشترک دیگران را قطع نمی‌کند.
 *
 * API:
 *   var stop = window.__hesabnoDom.watch(target, options, function (records) { … });
 *   stop.disconnect();                       // حذف همان ثبت (مثل disconnect اصلی)
 *   window.__hesabnoDom.stats();             // آمار برای آزمون‌ها و میزسنج
 */
(function () {
  var existing = window.__hesabnoDom;
  if (existing && existing.version >= 1 && typeof existing.watch === "function") return;

  var entries = Object.create(null);
  var counters = { observers: 0, active: 0, handlers: 0, batches: 0, records: 0, errors: 0 };

  var sortedOptions = function (options) {
    var source = options || {};
    var keys = Object.keys(source).sort();
    var out = {};
    keys.forEach(function (key) {
      var value = source[key];
      if (Object.prototype.toString.call(value) === "[object Array]") value = value.slice().sort();
      out[key] = value;
    });
    return JSON.stringify(out);
  };

  var describeTarget = function (target) {
    if (!target) return "null";
    if (target.nodeType === 9) return "#document";
    return String(target.tagName || "node") + (target.id ? "#" + target.id : "");
  };

  var keyOf = function (target, options) {
    return describeTarget(target) + "::" + sortedOptions(options);
  };

  var noop = { disconnect: function () {}, takeRecords: function () { return []; }, active: false };

  var makeObserver = function (target, options) {
    var entry = { handlers: [], observer: null };
    entry.observer = new MutationObserver(function (records) {
      counters.batches += 1;
      counters.records += records.length;
      /* عکس فوری از فهرست ثبت‌کننده‌ها: اگر یکی در همین دور خودش را حذف کند، حلقه خراب نشود */
      var list = entry.handlers.slice();
      for (var index = 0; index < list.length; index += 1) {
        try {
          list[index].handler(records, list[index].facade);
        } catch (error) {
          counters.errors += 1;
          try { console.error("[hesabno] خطای callback لایه‌ی مشترک:", error); } catch (ignored) {}
        }
      }
    });
    entry.observer.observe(target, options);
    counters.observers += 1;
    counters.active += 1;
    return entry;
  };

  var watch = function (target, options, handler) {
    if (typeof handler !== "function" || !target || typeof target.nodeType !== "number") return noop;
    var key = keyOf(target, options);
    var entry = entries[key];
    if (!entry) {
      entry = entries[key] = makeObserver(target, options || {});
    }
    var registration = { handler: handler, facade: null, key: key };
    registration.facade = {
      disconnect: function () {
        var index = entry.handlers.indexOf(registration);
        if (index > -1) { entry.handlers.splice(index, 1); counters.handlers -= 1; }
        registration.facade.active = false;
        /* وقتی آخرین ثبت‌کننده رفت، observer مشترک هم آزاد می‌شود (ثبت بعدی آن را از نو می‌سازد) */
        if (entry.handlers.length === 0) {
          try { entry.observer.disconnect(); } catch (error) {}
          delete entries[key];
          counters.active -= 1;
        }
      },
      takeRecords: function () { return entry.observer.takeRecords(); },
      active: true,
      target: describeTarget(target),
    };
    entry.handlers.push(registration);
    counters.handlers += 1;
    return registration.facade;
  };

  window.__hesabnoDom = {
    version: 1,
    watch: watch,
    stats: function () {
      return {
        observers: counters.observers,
        activeObservers: counters.active,
        handlers: counters.handlers,
        batches: counters.batches,
        records: counters.records,
        errors: counters.errors,
        keys: Object.keys(entries),
      };
    },
  };
})();
