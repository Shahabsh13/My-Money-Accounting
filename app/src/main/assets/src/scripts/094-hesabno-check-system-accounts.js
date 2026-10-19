(function () {
    var key = "hesabno:check-system-accounts-v1";
    var get = function (name) {
      try { return window.__safeGet ? window.__safeGet(name) : window.localStorage.getItem(name); } catch (error) { return null; }
    };
    var set = function (name, value) {
      if (window.__safeSet) return window.__safeSet(name, value);
      try { window.localStorage.setItem(name, value); return true; } catch (error) { return false; }
    };
    var load = function (name) {
      try {
        var value = JSON.parse(get(name) || "null");
        return Array.isArray(value) ? value : [];
      } catch (error) { return []; }
    };
    var accounts = load("hesabno:accounts_v5");
    var requiredAccountsReady = ["اسناد دریافتنی", "اسناد پرداختنی"].every(function (name) {
      return accounts.some(function (account) { return account && account.name === name && account.system === true; });
    });
    if (get(key) === "done" && requiredAccountsReady) return;
   var nextId = accounts.reduce(function (max, account) { return Math.max(max, Number(account && account.id) || 0); }, 0) + 1;
   var ensure = function (name, group, code) {
     var account = accounts.find(function (item) { return item && item.name === name; });
     if (account) {
       if (account.system !== true) account.system = true;
       return;
     }
     accounts.push({ id: nextId++, group: group, code: code, name: name, picture: group === "asset" ? "📄" : "🧾", parentId: null, active: true, pinned: false, system: true });
   };
   ensure("اسناد دریافتنی", "asset", "106");
   ensure("اسناد پرداختنی", "liability", "206");
    /* نگهبان مهاجرت (۶.۰): سه نوشتن با هم اتمی می‌شوند؛ اگر یکی شکست بخورد، همه بازگردانی می‌شوند */
    if (window.__hesabnoMigration) {
      window.__hesabnoMigration.run(
        "094-check-system-accounts",
        ["hesabno:accounts_v5", "hesabno:accounts", key],
        function (db) {
          db.set("hesabno:accounts_v5", JSON.stringify(accounts));
          db.set("hesabno:accounts", JSON.stringify(accounts));
          db.set(key, "done");
        }
      );
      return;
    }
    set("hesabno:accounts_v5", JSON.stringify(accounts));
    set("hesabno:accounts", JSON.stringify(accounts));
    set(key, "done");
    // This migration runs before the app mounts on DOMContentLoaded; reloading is unnecessary
    // and can loop forever when the preview only provides in-memory storage.
 })();
