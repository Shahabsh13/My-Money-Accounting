(function () {
    var reportId = "hesabno-family-project-report";
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var escapeHtml = function (value) { return String(value).replace(/[&<>"]/g, function (char) { return char === "&" ? "&amp;" : char === "<" ? "&lt;" : char === ">" ? "&gt;" : "&quot;"; }); };
    var readJson = function (key, fallback) {
      try { var value = JSON.parse(localStorage.getItem(key) || "null"); return value == null ? fallback : value; } catch (error) { return fallback; }
    };
    var unique = function (items) {
      var result = [], seen = new Set();
      (items || []).forEach(function (item) { var name = clean(item); if (name && !seen.has(name.toLocaleLowerCase())) { seen.add(name.toLocaleLowerCase()); result.push(name); } });
      return result;
    };
    var readNames = function (type) {
      if (type === "project") return unique(readJson("hesabno:projects", []));
      return unique(readJson("hesabno:familyMembers", readJson("hesabno:family_members", [])));
    };
    try {
      var familyPrimary = readJson("hesabno:familyMembers", null), familyLegacy = readJson("hesabno:family_members", null);
      if (!Array.isArray(familyPrimary) && Array.isArray(familyLegacy)) localStorage.setItem("hesabno:familyMembers", JSON.stringify(familyLegacy));
    } catch (error) {}
    var transactions = function () { var value = readJson("hesabno:transactions", []); return Array.isArray(value) ? value : []; };
    var amount = function (value) { return Number(String(value || "").replace(/[۰-۹]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(digit); }).replace(/[^0-9.-]/g, "")) || 0; };
    var currencyUnit = function () {
      try { return (window.__safeGet ? window.__safeGet("hesabno:currency") : localStorage.getItem("hesabno:currency")) === "toman" ? "تومان" : "ریال"; }
      catch (error) { return "ریال"; }
    };
    var money = function (value) { return Math.round(value || 0).toLocaleString("fa-IR") + " " + currencyUnit(); };
    var matches = function (item, name, type) {
      var field = type === "project" ? item.project : item.familyMember;
      return clean(field).toLocaleLowerCase() === name.toLocaleLowerCase();
    };
    var summary = function (name, type) {
      var rows = transactions().filter(function (item) { return matches(item, name, type); });
      var income = 0, expense = 0;
      rows.forEach(function (item) {
        if (item.check && item.check.status === "bounced") return;
        var value = amount(item.amount);
        if (item.type === "income") income += value;
        if (item.type === "expense") expense += value;
        if (item.feeAmount) expense += amount(item.feeAmount);
      });
      return { rows: rows, income: income, expense: expense, net: income - expense };
    };
    var allNames = function (type) {
      var names = readNames(type), field = type === "project" ? "project" : "familyMember";
      transactions().forEach(function (item) { var value = clean(item[field]); if (value) names.push(value); });
      return unique(names);
    };
    /* ظاهر گزارش پروژه و خانواده (#hesabno-family-project-report) در بستهٔ ۲۳۵ قرار دارد. */
    var addStyles = function () {};
    var openReport = function () {
      if (document.getElementById(reportId)) return;
      addStyles();
      var root = document.createElement("div"); root.id = reportId;
      var state = { type: "project", selected: "" };
      var render = function () {
        var isProject = state.type === "project", names = allNames(state.type), title = isProject ? "گزارش پروژه‌ها" : "گزارش اعضای خانواده", icon = isProject ? "📁" : "👥";
        var entries = names.map(function (name) { var data = summary(name, state.type); return { name: name, data: data, movement: data.income + data.expense }; });
        var totals = entries.reduce(function (result, entry) { result.income += entry.data.income; result.expense += entry.data.expense; result.documents += entry.data.rows.length; return result; }, { income: 0, expense: 0, documents: 0 });
        var activeCount = entries.filter(function (entry) { return entry.data.rows.length > 0; }).length;
        var ranked = entries.filter(function (entry) { return entry.movement > 0; }).sort(function (a, b) { return b.movement - a.movement; }).slice(0, 4);
        var maxMovement = ranked.length ? ranked[0].movement : 0;
        var chartRows = ranked.map(function (entry) {
          var incomeShare = entry.movement ? entry.data.income / entry.movement * 100 : 0, expenseShare = entry.movement ? entry.data.expense / entry.movement * 100 : 0, totalShare = maxMovement ? entry.movement / maxMovement * 100 : 0;
          return '<div class="hfr-chart-row"><div class="hfr-chart-label"><span>' + escapeHtml(entry.name) + '</span><strong>' + money(entry.movement) + '</strong></div><div class="hfr-chart-track"><div class="hfr-chart-total" style="width:' + totalShare.toFixed(1) + '%"><span class="hfr-bar-income" style="width:' + incomeShare.toFixed(1) + '%"></span><span class="hfr-bar-expense" style="width:' + expenseShare.toFixed(1) + '%"></span></div></div></div>';
        }).join("");
        var overview = '<section class="hfr-overview"><div class="hfr-overview-head"><div><small>نمای کلی</small><strong>' + (isProject ? "گردش پروژه‌ها" : "گردش اعضای خانواده") + '</strong></div><span class="hfr-overview-badge">' + activeCount.toLocaleString("fa-IR") + ' مورد دارای گردش</span></div><div class="hfr-kpis"><div class="hfr-kpi" data-tone="income"><span>دریافت</span><strong>' + money(totals.income) + '</strong></div><div class="hfr-kpi" data-tone="expense"><span>هزینه</span><strong>' + money(totals.expense) + '</strong></div><div class="hfr-kpi" data-tone="net"><span>خالص گردش</span><strong>' + money(totals.income - totals.expense) + '</strong></div><div class="hfr-kpi" data-tone="docs"><span>اسناد مرتبط</span><strong>' + totals.documents.toLocaleString("fa-IR") + '</strong></div></div><div class="hfr-compare"><div class="hfr-compare-head"><strong>مقایسه گردش</strong><span>دریافت در برابر هزینه</span></div>' + (chartRows ? '<div class="hfr-chart-list">' + chartRows + '</div><div class="hfr-legend"><span class="income"><i></i>دریافت</span><span class="expense"><i></i>هزینه</span></div>' : '<div class="hfr-chart-empty">پس از ثبت سند مرتبط، نمودار مقایسه اینجا نمایش داده می‌شود.</div>') + '</div></section>';
        var rows = entries.map(function (entry) { var name = entry.name, data = entry.data; return '<button type="button" class="hfr-item" data-hfr-action="select" data-hfr-name="' + escapeHtml(name) + '"><span class="hfr-icon">' + icon + '</span><span><strong>' + escapeHtml(name) + '</strong><small>' + data.rows.length.toLocaleString("fa-IR") + ' سند مرتبط</small></span><span class="hfr-values"><span class="hfr-income">دریافت: ' + money(data.income) + '</span><br><span class="hfr-expense">هزینه: ' + money(data.expense) + '</span></span></button>'; }).join("");
        var selected = state.selected ? summary(state.selected, state.type) : null;
        var detail = selected ? '<div class="hfr-detail"><div class="hfr-detail-head"><h2>جزئیات «' + escapeHtml(state.selected) + '»</h2><span class="hfr-detail-count">' + selected.rows.length.toLocaleString("fa-IR") + ' سند</span></div><div class="hfr-detail-kpis"><div data-tone="income"><small>دریافت</small><strong>' + money(selected.income) + '</strong></div><div data-tone="expense"><small>هزینه</small><strong>' + money(selected.expense) + '</strong></div><div data-tone="net"><small>خالص</small><strong>' + money(selected.net) + '</strong></div></div>' + (selected.rows.length ? selected.rows.map(function (item) { var value = amount(item.amount), sign = item.type === "income" ? "+" : item.type === "expense" ? "−" : "⇄"; return '<div class="hfr-row"><span>' + escapeHtml(item.date || "بدون تاریخ") + ' · ' + escapeHtml(item.title || item.category || "سند") + '</span><strong>' + sign + ' ' + money(value) + '</strong></div>'; }).join("") : '<div class="hfr-empty">برای این مورد سندی ثبت نشده است.</div>') + '</div>' : '';
        var empty = '<div class="hfr-empty"><strong>هنوز موردی تعریف نشده است.</strong><span>پس از تعریف عضو خانواده یا پروژه و ثبت سند مرتبط، دریافت، هزینه و مقایسهٔ گردش اینجا نمایش داده می‌شود.</span></div>';
        root.innerHTML = '<div class="hfr-shell"><header class="hfr-head"><button type="button" data-hfr-action="close" aria-label="بستن">×</button><div><h1>' + title + '</h1><p class="hfr-sub">دریافت، هزینه و خالص گردش در یک نگاه</p></div></header><main class="hfr-content"><div class="hfr-tabs"><button type="button" class="hfr-tab" data-hfr-type="project" data-active="' + isProject + '">پروژه‌ها</button><button type="button" class="hfr-tab" data-hfr-type="family" data-active="' + (!isProject) + '">اعضای خانواده</button></div>' + overview + '<section class="hfr-card"><div class="hfr-title"><span>' + (isProject ? "پروژه‌ها و مراکز هزینه" : "اعضای خانواده") + '</span><span class="hfr-count">' + names.length.toLocaleString("fa-IR") + ' مورد</span></div><div class="hfr-list">' + (rows || empty) + '</div>' + detail + '</section></main></div>';
      };
      root.addEventListener("click", function (event) {
        var target = event.target.closest("[data-hfr-action], [data-hfr-type]"); if (!target) return;
        if (target.dataset.hfrType) { state.type = target.dataset.hfrType; state.selected = ""; render(); return; }
        if (target.dataset.hfrAction === "close") { root.remove(); return; }
        if (target.dataset.hfrAction === "select") { state.selected = target.dataset.hfrName || ""; render(); }
      });
      document.body.appendChild(root); render();
    };
    document.addEventListener("click", function (event) {
      var button = event.target.closest && event.target.closest("button");
      if (!button || !clean(button.textContent).includes("اعضای خانواده و پروژه‌ها")) return;
      var reportsPage = Array.from(document.querySelectorAll("main h1")).some(function (node) { return clean(node.textContent) === "گزارش‌ها"; });
      if (!reportsPage) return;
      event.preventDefault(); event.stopImmediatePropagation(); openReport();
    }, true);
  })();
