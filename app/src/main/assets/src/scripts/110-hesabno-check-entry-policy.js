(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var sync = function () {
      document.querySelectorAll("main").forEach(function (main) {
        var heading = Array.from(main.querySelectorAll("h1")).find(function (node) { return /^ثبت (دریافت|پرداخت)$/.test(clean(node.textContent)); });
        var status = main.querySelector("#field-check-status");
        if (!heading || !status) return;
        if (status.parentElement) status.parentElement.style.display = "none";
        if (clean(heading.textContent) !== "ثبت دریافت") return;
        var bank = Array.from(main.querySelectorAll('input[placeholder*="بانک تجارت"]'))[0];
        if (!bank) return;
        bank.required = true;
        bank.setAttribute("aria-required", "true");
        var label = bank.parentElement && bank.parentElement.previousElementSibling;
        if (label && !clean(label.textContent).includes("(الزامی)")) label.innerHTML = "بانک و شعبه صادرکننده چک <span class=\"text-[10px] text-rose-400 font-normal\">(الزامی)</span>";
      });
    };
     var syncScheduled = false;
    var scheduleSync = function () {
      if (syncScheduled) return;
      syncScheduled = true;
      Promise.resolve().then(function () {
        syncScheduled = false;
        sync();
      });
    };
     sync();
     if (document.body) {
       new MutationObserver(scheduleSync).observe(document.body, { childList: true, subtree: true });
       document.addEventListener("click", scheduleSync, true);
     }
  })();
