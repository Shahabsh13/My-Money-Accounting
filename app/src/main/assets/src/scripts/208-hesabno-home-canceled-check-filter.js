(function () {
  var clean = function (value) { return String(value || "").trim().replace(/\s+/g, " "); };
  var digits = function (value) {
    return String(value || "").replace(/[۰-۹٠-٩]/g, function (digit) {
      var index = "۰۱۲۳۴۵۶۷۸۹".indexOf(digit);
      return String(index < 0 ? "٠١٢٣٤٥٦٧٨٩".indexOf(digit) : index);
    });
  };
  var readTransactions = function () {
    try {
      var raw = window.__safeGet ? window.__safeGet("hesabno:transactions") : localStorage.getItem("hesabno:transactions");
      var value = JSON.parse(raw || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) { return []; }
  };
  var excluded = function (transaction) {
    var check = transaction && transaction.check;
    if (!check || transaction.type !== "expense") return false;
    var status = String(check.status || "").trim().toLowerCase();
    return check.debtCanceled === true || check.returnedWithCorrection === true ||
      ["bounced", "refunded", "returned", "returned_check", "dishonored"].indexOf(status) !== -1 ||
      /برگشت|مسترد|returned|refund|bounc|dishonor/i.test(status);
  };
  var sync = function () {
    var canceled = new Set(readTransactions().filter(excluded).map(function (transaction) {
      return digits(transaction.documentNumber || transaction.id);
    }).filter(Boolean));
    document.querySelectorAll("main section").forEach(function (section) {
      var heading = section.querySelector("h2");
      if (!heading || clean(heading.textContent).indexOf("هزینه‌های امروز") !== 0) return;
      var list = Array.from(section.children).find(function (child) {
        return child.classList && child.classList.contains("bg-stone-900/60") && child.classList.contains("divide-y");
      });
      if (!list) return;
      var rows = Array.from(list.children), visible = 0;
      rows.forEach(function (row) {
        var number = Array.from(row.querySelectorAll("span")).find(function (node) {
          return clean(node.textContent).charAt(0) === "#";
        });
        var id = number ? digits(clean(number.textContent).slice(1)) : "";
        var hide = id && canceled.has(id);
        if (!id) {
          var title = row.querySelector("p.font-bold");
          var label = clean(title && title.textContent).toLocaleLowerCase();
          var matches = readTransactions().filter(function (transaction) {
            return excluded(transaction) && label && label === clean(transaction.title || transaction.description).toLocaleLowerCase();
          });
          hide = matches.length === 1;
        }
        if (hide) {
          if (row.getAttribute("data-hesabno-canceled-home-check") !== "true") row.setAttribute("data-hesabno-canceled-home-check", "true");
          if (row.getAttribute("aria-hidden") !== "true") row.setAttribute("aria-hidden", "true");
          if (row.style.getPropertyValue("display") !== "none") row.style.setProperty("display", "none", "important");
        } else {
          if (row.hasAttribute("data-hesabno-canceled-home-check")) row.removeAttribute("data-hesabno-canceled-home-check");
          if (row.hasAttribute("aria-hidden")) row.removeAttribute("aria-hidden");
          if (row.style.getPropertyValue("display")) row.style.removeProperty("display");
          visible += 1;
        }
      });
      var badge = Array.from(heading.querySelectorAll("span")).find(function (node) {
        return /سند$/.test(clean(node.textContent));
      });
      var nextBadgeText = visible.toLocaleString("fa-IR") + " سند";
      if (visible && badge && badge.textContent !== nextBadgeText) badge.textContent = nextBadgeText;
      else if (!visible && badge) badge.remove();
      var empty = section.querySelector(":scope > [data-hesabno-home-empty]");
      if (!visible && rows.length) {
        if (list.style.getPropertyValue("display") !== "none") list.style.setProperty("display", "none", "important");
        if (!empty) {
          empty = document.createElement("div");
          empty.dataset.hesabnoHomeEmpty = "true";
          empty.className = "p-4 rounded-2xl bg-stone-800/40 border border-stone-800 text-center text-xs text-stone-400";
          empty.innerHTML = "<span>هیچ هزینه‌ای برای امروز ثبت نشده است.</span>";
          section.insertBefore(empty, list.nextSibling);
        }
      } else {
        if (list.style.getPropertyValue("display")) list.style.removeProperty("display");
        if (empty) empty.remove();
      }
    });
  };
  var queued = false;
  var schedule = function () {
    if (queued) return;
    queued = true;
    Promise.resolve().then(function () { queued = false; sync(); });
  };
  sync();
  if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true, characterData: true }, schedule);
  window.addEventListener("storage", schedule);
})();
