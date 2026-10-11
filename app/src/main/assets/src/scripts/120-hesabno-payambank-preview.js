(function () {
    var inboxKey = "hesabno:payambank:inbox";
    var markerKey = "hesabno:payambank:preview-state";
    var backupKey = "hesabno:payambank:preview-backup";
    var noneValue = "__hesabno_preview_none__";
    var isPreview = new URLSearchParams(window.location.search).get("hesabno-preview") === "payambank";
    var sample = [
      { id: "preview-1", bankName: "بانک ملت", type: "income", amount: 18500000, receivedAt: "۱۴۰۵/۰۷/۰۷", description: "واریز حقوق", isRegistered: false },
      { id: "preview-2", bankName: "بانک سامان", type: "expense", amount: 920000, receivedAt: "۱۴۰۵/۰۷/۰۶", description: "خرید فروشگاه", isRegistered: false },
      { id: "preview-3", bankName: "بانک ملی", type: "income", amount: 3500000, receivedAt: "۱۴۰۵/۰۷/۰۵", description: "واریز ثبت‌شده", isRegistered: true, transactionId: "preview-transaction-3" }
    ];
    var refresh = function () {
      if (!document.body) return;
      var node = document.createElement("span");
      node.hidden = true;
      node.setAttribute("data-hesabno-preview-refresh", "true");
      document.body.appendChild(node);
      window.setTimeout(function () { node.remove(); }, 0);
    };
    try {
      if (isPreview && window.localStorage.getItem(markerKey) !== "active") {
        var original = window.localStorage.getItem(inboxKey);
        window.localStorage.setItem(backupKey, original === null ? noneValue : original);
        window.localStorage.setItem(inboxKey, JSON.stringify(sample));
        window.localStorage.setItem(markerKey, "active");
        refresh();
      } else if (!isPreview && window.localStorage.getItem(markerKey) === "active") {
        var backup = window.localStorage.getItem(backupKey);
        if (backup === noneValue || backup === null) window.localStorage.removeItem(inboxKey);
        else window.localStorage.setItem(inboxKey, backup);
        window.localStorage.removeItem(markerKey);
        window.localStorage.removeItem(backupKey);
        refresh();
      }
    } catch (error) {}
  })();
