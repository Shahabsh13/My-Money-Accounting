(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var sync = function () {
      Array.from(document.querySelectorAll("p")).filter(function (node) { return clean(node.textContent) === "اسناد پرداختنی"; }).forEach(function (label) {
        var textGroup = label.parentElement;
        if (!textGroup) return;
        var description = Array.from(textGroup.querySelectorAll("p")).find(function (node) { return clean(node.textContent) === "حساب واسط تا زمان وصول یا پاس‌شدن"; });
        if (!description) return;
        description.setAttribute("data-hesabno-payables-account-description", "true");
        description.style.setProperty("display", "none", "important");
        label.style.setProperty("align-self", "center", "important");
        label.style.setProperty("line-height", "1.3", "important");
        textGroup.style.setProperty("min-width", "0", "important");
        textGroup.style.setProperty("align-self", "center", "important");
        var accountRow = textGroup.parentElement;
        if (!accountRow) return;
        accountRow.style.setProperty("align-items", "center", "important");
        accountRow.style.setProperty("min-width", "0", "important");
        var status = Array.from(accountRow.querySelectorAll("span")).find(function (node) { return clean(node.textContent) === "در جریان"; });
        if (!status) return;
        status.setAttribute("data-hesabno-check-entry-status", "true");
        status.style.setProperty("display", "inline-flex", "important");
        status.style.setProperty("align-items", "center", "important");
        status.style.setProperty("flex", "0 0 auto", "important");
        status.style.setProperty("min-width", "max-content", "important");
        status.style.setProperty("white-space", "nowrap", "important");
        status.style.setProperty("line-height", "1.2", "important");
      });
    };
    var queued = false;
    var schedule = function () {
      if (queued) return;
      queued = true;
      Promise.resolve().then(function () { queued = false; sync(); });
    };
    sync();
  if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  })();
