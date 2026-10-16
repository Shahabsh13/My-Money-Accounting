/*
 * لایه‌ی مشترک MutationObserver (مرحله ۴) — نسخه ۲: یک observer به‌ازای هر هدف
 *
 * چرا؟ در برنامه ۱۰۵ اسکریپت جدا هر کدام observer خودشان را می‌ساختند (۵۷ مورد دقیقاً روی
 * یک هدف با گزینه‌ی یکسان). نتیجه: برای هر جهش DOM ده‌ها callback جداگانه صف می‌شد؛ ۸۷۱ شلیک
 * فقط در زمان بوت. نسخه‌ی ۱ «یک observer به‌ازای هر هدف + گزینه‌ی دقیق» بود (۱۰۷ → ۲۰ observer
 * ایستا). نسخه‌ی ۲ یک قدم جلوتر می‌رود: «یک observer به‌ازای هر هدف» با اجتماع گزینه‌ها و
 * **فیلترکردن رخداد برای هر ثبت‌کننده** تا هر callback دقیقاً همان رخدادهایی را بگیرد که
 * observer مستقل خودش می‌گرفت.
 *
 * قاعده‌ی هم‌رفتاری (هر مورد آزمون دارد — tests/dom-observer-registry.test.cjs و
 * tests/dom-observer-widening.test.cjs که هر دو مسیر را کنار هم روی یک جریان جهش مقایسه می‌کند):
 *   • نوع رخداد: childList / attributes / characterData فقط اگر در گزینه‌های خودِ ثبت‌کننده باشد
 *   • attributeFilter: فقط ویژگی‌های درخواستی خودش (اگر فیلتر دارد)
 *   • subtree: اگر ثبت‌کننده subtree نداشته باشد، فقط رخدادهایی که هدفشان خودِ عنصر هدف است
 *   • oldValue: اگر ثبت‌کننده attributeOldValue/characterDataOldValue نخواسته باشد، مقدار
 *     رخداد برای او null می‌شود (دقیقاً مثل observer مستقل)
 *   • callback‌ای که بعد از فیلتر هیچ رخدادی ندارد، فراخوانی نمی‌شود (observer مستقل هم در آن
 *     حالت هیچ‌وقت صدا زده نمی‌شد)
 *   • ترتیب اجرا = ترتیب ثبت = ترتیب ساخت observerها در کد اصلی
 *   • خطای یک callback بقیه را متوقف نمی‌کند
 *
 * محدودیت مستند: `takeRecords()` روی نماینده، صف رخدادهای observer مشترک را برمی‌گرداند
 * (فیلترنشده) و رخدادها بین callbackها به‌اشتراک گذاشته می‌شوند (باید فقط خوانده شوند).
 * در کد فعلی برنامه هیچ اسکریپتی takeRecords صدا نمی‌زند و هیچ‌کدام رخداد را تغییر نمی‌دهند.
 *
 * API:
 *   var stop = window.__hesabnoDom.watch(target, options, function (records) { … });
 *   stop.disconnect();                       // حذف همان ثبت (مثل disconnect اصلی)
 *   window.__hesabnoDom.stats();             // آمار برای آزمون‌ها و میزسنج
 */
(function () {
  var existing = window.__hesabnoDom;
  if (existing && existing.version >= 2 && typeof existing.watch === "function") return;

  var entries = Object.create(null);
  var counters = {
    observers: 0, active: 0, handlers: 0, batches: 0, records: 0,
    delivered: 0, skippedEmpty: 0, widened: 0, errors: 0,
  };

  var describeTarget = function (target) {
    if (!target) return "null";
    if (target.nodeType === 9) return "#document";
    return String(target.tagName || "node") + (target.id ? "#" + target.id : "");
  };

  var matcherOf = function (options) {
    var source = options || {};
    return {
      childList: source.childList === true,
      attributes: source.attributes === true,
      characterData: source.characterData === true,
      subtree: source.subtree === true,
      attributeOldValue: source.attributeOldValue === true,
      characterDataOldValue: source.characterDataOldValue === true,
      filter: Object.prototype.toString.call(source.attributeFilter) === "[object Array]"
        ? source.attributeFilter.map(String) : null,
    };
  };

  /* اجتماع گزینه‌ها: observer مشترک باید بتواند همه‌ی رخدادهایی را ببیند که ثبت‌کننده‌ها می‌خواهند */
  var unionOf = function (handlers) {
    var union = { childList: false, attributes: false, characterData: false, subtree: false, attributeOldValue: false, characterDataOldValue: false, filter: [], allAttributes: false };
    handlers.forEach(function (registration) {
      var matcher = registration.matcher;
      if (matcher.childList) union.childList = true;
      if (matcher.subtree) union.subtree = true;
      if (matcher.characterData) union.characterData = true;
      if (matcher.characterDataOldValue) union.characterDataOldValue = true;
      if (matcher.attributes) {
        union.attributes = true;
        if (matcher.attributeOldValue) union.attributeOldValue = true;
        if (matcher.filter === null) union.allAttributes = true;
        else matcher.filter.forEach(function (name) { if (union.filter.indexOf(name) === -1) union.filter.push(name); });
      }
    });
    return union;
  };

  var optionsOf = function (union) {
    var options = {};
    if (union.childList) options.childList = true;
    if (union.subtree) options.subtree = true;
    if (union.characterData) options.characterData = true;
    if (union.characterDataOldValue) options.characterDataOldValue = true;
    if (union.attributes) {
      options.attributes = true;
      if (union.attributeOldValue) options.attributeOldValue = true;
      if (!union.allAttributes) options.attributeFilter = union.filter.slice().sort();
    }
    return options;
  };

  var matches = function (matcher, record, target) {
    var type = record.type;
    if (type === "childList") {
      if (!matcher.childList) return false;
    } else if (type === "attributes") {
      if (!matcher.attributes) return false;
      if (matcher.filter && matcher.filter.indexOf(String(record.attributeName)) === -1) return false;
    } else if (type === "characterData") {
      if (!matcher.characterData) return false;
    } else {
      return false;
    }
    /* بدون subtree، observer مستقل فقط رخدادهای خودِ هدف را می‌گرفت */
    if (!matcher.subtree && record.target !== target) return false;
    return true;
  };

  var wantsOldValue = function (matcher, type) {
    if (type === "attributes") return matcher.attributeOldValue;
    if (type === "characterData") return matcher.characterDataOldValue;
    return true;
  };

  /* فقط وقتی observer مشترک oldValue را گرفته ولی این ثبت‌کننده نخواسته بود: پاکش می‌کنیم.
     توجه: ویژگی‌های MutationRecord روی prototype هستند، پس clone با Object.create کار نمی‌کند؛
     یک شیء ساده با همان شکل استاندارد می‌سازیم (handlerها فقط همین فیلدها را می‌خوانند). */
  var withoutOldValue = function (record) {
    return {
      type: record.type,
      target: record.target,
      addedNodes: record.addedNodes,
      removedNodes: record.removedNodes,
      previousSibling: record.previousSibling,
      nextSibling: record.nextSibling,
      attributeName: record.attributeName,
      attributeNamespace: record.attributeNamespace,
      oldValue: null,
    };
  };

  var noop = { disconnect: function () {}, takeRecords: function () { return []; }, active: false };

  var deliver = function (entry, records) {
    counters.batches += 1;
    counters.records += records.length;
    /* عکس فوری: اگر یکی در همین دور خودش را حذف کند، حلقه خراب نشود */
    var list = entry.handlers.slice();
    for (var index = 0; index < list.length; index += 1) {
      var candidate = list[index];
      if (candidate.facade.active !== true) continue;
      var filtered = [];
      for (var position = 0; position < records.length; position += 1) {
        var record = records[position];
        if (!matches(candidate.matcher, record, entry.target)) continue;
        filtered.push(record.oldValue !== null && !wantsOldValue(candidate.matcher, record.type) ? withoutOldValue(record) : record);
      }
      /* مثل observer مستقل: بدون رخداد مرتبط، callback صدا زده نمی‌شود */
      if (!filtered.length) { counters.skippedEmpty += 1; continue; }
      counters.delivered += 1;
      try {
        candidate.handler(filtered, candidate.facade);
      } catch (error) {
        counters.errors += 1;
        try { console.error("[hesabno] خطای callback لایه‌ی مشترک:", error); } catch (ignored) {}
      }
    }
  };

  var widenIfNeeded = function (entry) {
    var union = unionOf(entry.handlers);
    var options = optionsOf(union);
    var signature = JSON.stringify(options);
    if (entry.signature === signature) return;
    entry.signature = signature;
    entry.options = options;
    entry.observer.observe(entry.target, options);
    if (entry.widenedOnce) counters.widened += 1;
    entry.widenedOnce = true;
  };

  var entryFor = function (target) {
    var key = describeTarget(target) + "::" + (target && target.nodeType);
    var entry = entries[key];
    if (entry) return entry;
    entry = entries[key] = { key: key, target: target, handlers: [], observer: null, signature: null, widenedOnce: false };
    entry.observer = new MutationObserver(function (records) { deliver(entry, records); });
    counters.observers += 1;
    counters.active += 1;
    return entry;
  };

  var watch = function (target, options, handler) {
    if (typeof handler !== "function" || !target || typeof target.nodeType !== "number") return noop;
    var entry = entryFor(target);
    var registration = { handler: handler, matcher: matcherOf(options), facade: null };
    registration.facade = {
      disconnect: function () {
        var index = entry.handlers.indexOf(registration);
        if (index > -1) {
          entry.handlers.splice(index, 1);
          counters.handlers -= 1;
          /* با رفتن یک ثبت، گزینه‌ها باریک نمی‌شوند (observe دوباره برای باریک‌کردن امن نیست) */
        }
        registration.facade.active = false;
        if (entry.handlers.length === 0) {
          try { entry.observer.disconnect(); } catch (error) {}
          delete entries[entry.key];
          counters.active -= 1;
        }
      },
      takeRecords: function () { return entry.observer.takeRecords(); },
      active: true,
      target: describeTarget(target),
    };
    entry.handlers.push(registration);
    counters.handlers += 1;
    widenIfNeeded(entry);
    return registration.facade;
  };

  window.__hesabnoDom = {
    version: 2,
    watch: watch,
    stats: function () {
      return {
        observers: counters.observers,
        activeObservers: counters.active,
        handlers: counters.handlers,
        batches: counters.batches,
        records: counters.records,
        delivered: counters.delivered,
        skippedEmpty: counters.skippedEmpty,
        widened: counters.widened,
        errors: counters.errors,
        keys: Object.keys(entries),
      };
    },
  };
})();
