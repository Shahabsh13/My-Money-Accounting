(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var scheduled = false;
    var sync = function () {
      scheduled = false;
      document.querySelectorAll("main").forEach(function (main) {
        var isCheckForm = clean(main.textContent).includes("مشخصات چک صیادی");
        var label = Array.from(main.querySelectorAll("p")).find(function (node) { return clean(node.textContent) === "این عملیات کارمزد دارد"; });
        var section = label && label.closest("section");
        if (!section) return;
        var toggle = section.querySelector("button");
        if (isCheckForm && toggle && String(toggle.className || "").includes("bg-emerald-500")) toggle.click();
        var nextDisplay = isCheckForm ? "none" : "";
        if (section.style.display !== nextDisplay) section.style.display = nextDisplay;
        var nextState = isCheckForm ? "hidden" : "visible";
        if (section.getAttribute("data-hesabno-check-fee-section") !== nextState) section.setAttribute("data-hesabno-check-fee-section", nextState);
      });
    };
    var schedule = function () {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(sync);
    };
    sync();
    document.addEventListener("click", schedule, true);
    if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  })();
