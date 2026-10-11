(function () {
    var key = "hesabno:transactions";
    var get = function (name) { try { return window.__safeGet ? window.__safeGet(name) : localStorage.getItem(name); } catch (error) { return null; } };
    var set = function (name, value) { try { window.__safeSet ? window.__safeSet(name, value) : localStorage.setItem(name, value); } catch (error) {} };
    var read = function () { try { var value = JSON.parse(get(key) || "[]"); return Array.isArray(value) ? value : []; } catch (error) { return []; } };
    var systemAccount = function (type) { return type === "income" ? "اسناد دریافتنی" : "اسناد پرداختنی"; };
    var bankName = function (item) {
      var check = item.check || {}, system = systemAccount(item.type);
      return String(check.settlementBank || check.linkedBank || check.bank || (item.account && item.account !== system ? item.account : "")).trim();
    };
    var reconcile = function () {
      var items = read(), before = items.length, changed = false;
      items = items.filter(function (item) {
        if (item && item.isCheckSettlement === true && item.method === "check_settlement") { changed = true; return false; }
        return true;
      });
      items.forEach(function (item) {
        if (!item || !item.check || item.check.status !== "cleared") return;
        var bank = bankName(item), system = systemAccount(item.type);
        if (!bank) return;
        if (item.account !== bank) { item.account = bank; changed = true; }
        var nextCheck = Object.assign({}, item.check, { linkedBank: bank });
        delete nextCheck.settlementId;
        if (JSON.stringify(nextCheck) !== JSON.stringify(item.check)) { item.check = nextCheck; changed = true; }
        if (item.checkSettlementId != null) { delete item.checkSettlementId; changed = true; }
        if (system === item.account) { item.account = bank; changed = true; }
      });
      if (changed || before !== items.length) {
        set(key, JSON.stringify(items));
      }
    };
    window.setTimeout(reconcile, 900);
    window.setInterval(reconcile, 6000);
  })();
