/* سرفصل‌های سیستمی «اسناد دریافتنی» و «اسناد پرداختنی» را پیش از بارگذاری برنامه می‌سازد.
 * قبلاً این کار در 094 انجام می‌شد و چون برنامه از قبل حساب‌ها را خوانده بود، صفحه دوبار ریلود می‌شد.
 * اینجا پیش از React اجرا می‌شود، پس نیازی به ریلود نیست. 094 فقط به‌عنوان پشتیبان باقی مانده است. */
(function () {
  var KEY = "hesabno:accounts_v5";
  var DONE = "hesabno:check-system-accounts-v1";
  var NAMES = ["اسناد دریافتنی", "اسناد پرداختنی"];
  try {
    var raw = window.localStorage.getItem(KEY);
    var accounts = JSON.parse(raw || "null");
    if (!Array.isArray(accounts)) accounts = [];
    var ready = NAMES.every(function (name) {
      return accounts.some(function (a) { return a && a.name === name && a.system === true; });
    });
    if (window.localStorage.getItem(DONE) === "done" && ready) { /* حساب‌ها آماده است؛ ادامه برای ویجت‌ها */ } else {
    var nextId = accounts.reduce(function (m, a) { return Math.max(m, Number(a && a.id) || 0); }, 0) + 1;
    var ensure = function (name, group, code) {
      var found = accounts.find(function (item) { return item && item.name === name; });
      if (found) { found.system = true; return; }
      accounts.push({ id: nextId++, group: group, code: code, name: name, picture: group === "asset" ? "📄" : "🧾", parentId: null, active: true, pinned: false, system: true });
    };
    ensure("اسناد دریافتنی", "asset", "106");
    ensure("اسناد پرداختنی", "liability", "206");
    var text = JSON.stringify(accounts);
    window.localStorage.setItem(KEY, text);
    window.localStorage.setItem(DONE, "done");
    }
  } catch (error) { /* اگر ذخیره‌سازی در دسترس نباشد، 094 بعداً تلاش می‌کند */ }
  // ویجت‌های ثابت داشبورد (همان منطق 095): پیش از React نوشته می‌شود تا نیازی به ریلود نباشد
  try {
    var FIXED = ["payamBank", "checksCard", "quickAccess"];
    var config = {};
    try { config = JSON.parse(window.localStorage.getItem("hesabno:homeWidgets") || "{}") || {}; } catch (e) { config = {}; }
    var changed = false;
    FIXED.forEach(function (key) { if (config[key] !== false) { config[key] = false; changed = true; } });
    if (Array.isArray(config.order)) {
      var order = config.order.filter(function (key) { return FIXED.indexOf(key) === -1; });
      if (order.length !== config.order.length) { config.order = order; changed = true; }
    }
    if (changed) window.localStorage.setItem("hesabno:homeWidgets", JSON.stringify(config));
  } catch (error) { /* 095 بعداً تلاش می‌کند */ }
})();
