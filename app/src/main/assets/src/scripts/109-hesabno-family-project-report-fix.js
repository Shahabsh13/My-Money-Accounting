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
    var addStyles = function () {
      if (document.getElementById("hesabno-family-project-report-style")) return;
      var style = document.createElement("style"); style.id = "hesabno-family-project-report-style";
      style.textContent = "#" + reportId + "{position:fixed;inset:0;z-index:70;background:rgba(10,15,20,.78);backdrop-filter:blur(5px);direction:rtl;overflow:auto}#" + reportId + " .hfr-shell{width:100%;max-width:520px;min-height:100%;margin:auto;background:#20262d;color:#e6edf2;box-shadow:0 0 36px #0008}#" + reportId + " .hfr-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #3b4650;background:#252d35;position:sticky;top:0;z-index:1}#" + reportId + " .hfr-head button{width:38px;height:38px;border:1px solid #46535e;border-radius:13px;color:#d7e0e5;background:#303a43;font-size:20px;cursor:pointer}#" + reportId + " h1{margin:0;font-size:15px;font-weight:900}#" + reportId + " .hfr-sub{margin:3px 0 0;color:#9eabb5;font-size:10px}#" + reportId + " .hfr-content{padding:15px 14px 30px}#" + reportId + " .hfr-tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:5px;border:1px solid #46535e;border-radius:17px;background:#2a333c}#" + reportId + " .hfr-tab{border:0;border-radius:12px;padding:11px;color:#aebbc4;background:transparent;font-size:12px;font-weight:800;cursor:pointer}#" + reportId + " .hfr-tab[data-active=true]{color:#17222a;background:#dff1f3}#" + reportId + " .hfr-card{margin-top:13px;padding:13px;border:1px solid #46535e;border-radius:19px;background:#28323b}#" + reportId + " .hfr-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:13px;font-weight:900}#" + reportId + " .hfr-count{color:#9eabb5;font-size:10px}#" + reportId + " .hfr-list{display:grid;gap:8px}#" + reportId + " .hfr-item{display:flex;align-items:center;gap:9px;width:100%;border:1px solid #43515b;border-radius:14px;padding:10px;text-align:right;color:#edf4f5;background:#222b33;cursor:pointer}#" + reportId + " .hfr-item strong{display:block;font-size:12px}#" + reportId + " .hfr-item small{display:block;margin-top:3px;color:#91a2ad;font-size:9px}#" + reportId + " .hfr-icon{display:grid;place-items:center;width:35px;height:35px;flex:0 0 35px;border-radius:11px;background:#33414a;font-size:18px}#" + reportId + " .hfr-values{margin-right:auto;text-align:left;font-size:10px;line-height:1.7}#" + reportId + " .hfr-income{color:#73d8b6}#" + reportId + " .hfr-expense{color:#f59a9a}#" + reportId + " .hfr-detail{margin-top:13px;border-top:1px solid #46535e;padding-top:12px}#" + reportId + " .hfr-detail h2{margin:0 0 8px;font-size:12px}#" + reportId + " .hfr-row{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #3b4650;padding:8px 0;font-size:10px}#" + reportId + " .hfr-row:last-child{border-bottom:0}#" + reportId + " .hfr-empty{padding:18px 8px;border:1px dashed #43515b;border-radius:13px;color:#9cabb4;text-align:center;font-size:11px}html[data-theme=light] #" + reportId + " .hfr-shell{background:#edf4f7;color:#263746}html[data-theme=light] #" + reportId + " .hfr-head{border-color:#c0d0d9;background:#f7fbfc}html[data-theme=light] #" + reportId + " .hfr-card{border-color:#bdced8;background:#f7fbfc}html[data-theme=light] #" + reportId + " .hfr-item{border-color:#c4d4dc;background:#fff;color:#263746}html[data-theme=light] #" + reportId + " .hfr-tabs{border-color:#bdced8;background:#dfe9ee}html[data-theme=light] #" + reportId + " .hfr-tab{color:#587080}html[data-theme=light] #" + reportId + " .hfr-tab[data-active=true]{color:#24404d;background:#fff}";
      document.head.appendChild(style);
      var dashboardStyle = document.createElement("style"); dashboardStyle.id = "hesabno-family-project-report-dashboard-style";
      dashboardStyle.textContent = `
        #${reportId} .hfr-overview{margin-top:13px;padding:13px;border:1px solid #43515b;border-radius:19px;background:linear-gradient(145deg,#293943,#222c34)}
        #${reportId} .hfr-overview-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
        #${reportId} .hfr-overview-head>div{display:grid;gap:3px}
        #${reportId} .hfr-overview-head small{color:#9eabb5;font-size:9px}
        #${reportId} .hfr-overview-head strong{font-size:13px}
        #${reportId} .hfr-overview-badge{flex:none;padding:5px 8px;border-radius:999px;background:#35434d;color:#c4d3da;font-size:9px}
        #${reportId} .hfr-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
        #${reportId} .hfr-kpi{min-width:0;padding:10px;border:1px solid #394852;border-radius:14px;background:#202a32}
        #${reportId} .hfr-kpi span{display:block;color:#9eabb5;font-size:9px}
        #${reportId} .hfr-kpi strong{display:block;margin-top:5px;overflow-wrap:anywhere;font-size:12px;line-height:1.35}
        #${reportId} .hfr-kpi[data-tone=income] strong{color:#65d6a3}
        #${reportId} .hfr-kpi[data-tone=expense] strong{color:#ff9a9a}
        #${reportId} .hfr-kpi[data-tone=net] strong{color:#88d4e2}
        #${reportId} .hfr-kpi[data-tone=docs] strong{color:#f2cb79}
        #${reportId} .hfr-compare{margin-top:10px;padding:12px;border:1px solid #394852;border-radius:16px;background:rgba(20,27,33,.42)}
        #${reportId} .hfr-compare-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
        #${reportId} .hfr-compare-head strong{font-size:11px}
        #${reportId} .hfr-compare-head span{color:#91a2ad;font-size:9px}
        #${reportId} .hfr-chart-list{display:grid;gap:10px;margin-top:11px}
        #${reportId} .hfr-chart-row{display:grid;gap:5px}
        #${reportId} .hfr-chart-label{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10px}
        #${reportId} .hfr-chart-label span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c7d1d7}
        #${reportId} .hfr-chart-label strong{flex:none;color:#edf4f5;font-size:9px}
        #${reportId} .hfr-chart-track{height:9px;overflow:hidden;border-radius:999px;background:#182129;direction:rtl}
        #${reportId} .hfr-chart-total{display:flex;height:100%;overflow:hidden;border-radius:inherit}
        #${reportId} .hfr-bar-income{height:100%;background:#39bb83}
        #${reportId} .hfr-bar-expense{height:100%;background:#f17172}
        #${reportId} .hfr-legend{display:flex;gap:12px;margin-top:10px;color:#aab8c2;font-size:9px}
        #${reportId} .hfr-legend span{display:inline-flex;align-items:center;gap:5px}
        #${reportId} .hfr-legend i{width:7px;height:7px;border-radius:50%}
        #${reportId} .hfr-legend .income i{background:#39bb83}
        #${reportId} .hfr-legend .expense i{background:#f17172}
        #${reportId} .hfr-chart-empty{padding:12px;border-radius:12px;background:#202a32;color:#9eabb5;text-align:center;font-size:10px;line-height:1.6}
        #${reportId} .hfr-empty strong{display:block;margin-bottom:5px;color:#e6edf2;font-size:12px}
        #${reportId} .hfr-empty span{display:block;max-width:35em;margin:auto;line-height:1.8}
        #${reportId} .hfr-detail-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
        #${reportId} .hfr-detail-head h2{margin:0;font-size:12px}
        #${reportId} .hfr-detail-count{color:#9eabb5;font-size:9px}
        #${reportId} .hfr-detail-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:10px 0}
        #${reportId} .hfr-detail-kpis>div{min-width:0;padding:8px;border-radius:11px;background:#28333c}
        #${reportId} .hfr-detail-kpis small{display:block;color:#9eabb5;font-size:8px}
        #${reportId} .hfr-detail-kpis strong{display:block;margin-top:4px;overflow-wrap:anywhere;font-size:9px}
        #${reportId} .hfr-detail-kpis [data-tone=income] strong{color:#65d6a3}
        #${reportId} .hfr-detail-kpis [data-tone=expense] strong{color:#ff9a9a}
        #${reportId} .hfr-detail-kpis [data-tone=net] strong{color:#88d4e2}
        html.theme-light #${reportId} .hfr-overview{background:#e8f0f3!important;color:#263746!important;border-color:#c2d2dc!important}
        html.theme-light #${reportId} .hfr-overview-head small,html.theme-light #${reportId} .hfr-overview-badge{color:#617683!important}
        html.theme-light #${reportId} .hfr-overview-badge{background:#d5e3e8!important}
        html.theme-light #${reportId} .hfr-kpi{background:#f7fbfc!important;color:#263746!important;border-color:#cbd9e0!important}
        html.theme-light #${reportId} .hfr-kpi span,html.theme-light #${reportId} .hfr-compare-head span{color:#617683!important}
        html.theme-light #${reportId} .hfr-kpi[data-tone=income] strong{color:#167a5b!important}
        html.theme-light #${reportId} .hfr-kpi[data-tone=expense] strong{color:#b44046!important}
        html.theme-light #${reportId} .hfr-kpi[data-tone=net] strong{color:#246987!important}
        html.theme-light #${reportId} .hfr-kpi[data-tone=docs] strong{color:#8c6518!important}
        html.theme-light #${reportId} .hfr-compare{background:#f3f7f9!important;border-color:#cbd9e0!important;color:#263746!important}
        html.theme-light #${reportId} .hfr-chart-label span{color:#425865!important}
        html.theme-light #${reportId} .hfr-chart-label strong{color:#263746!important}
        html.theme-light #${reportId} .hfr-chart-track{background:#d6e1e6!important}
        html.theme-light #${reportId} .hfr-chart-empty{background:#e7eff2!important;color:#586f7c!important}
        html.theme-light #${reportId} .hfr-empty{color:#607481!important;border-color:#9aadb8!important}
        html.theme-light #${reportId} .hfr-empty strong{color:#263746!important}
        html.theme-light #${reportId} .hfr-empty span{color:#607481!important}
        html.theme-light #${reportId} .hfr-detail-kpis>div{background:#f0f5f7!important}
        html.theme-light #${reportId} .hfr-detail-kpis small{color:#617683!important}
        html.theme-light #${reportId} .hfr-detail-kpis [data-tone=income] strong{color:#167a5b!important}
        html.theme-light #${reportId} .hfr-detail-kpis [data-tone=expense] strong{color:#b44046!important}
        html.theme-light #${reportId} .hfr-detail-kpis [data-tone=net] strong{color:#246987!important}
        html.theme-dark #${reportId} .hfr-overview{background:linear-gradient(145deg,#293943,#222c34)!important;color:#e6edf2!important;border-color:#43515b!important}
        html.theme-dark #${reportId} .hfr-kpi{background:#202a32!important;color:#e6edf2!important;border-color:#394852!important}
        html.theme-dark #${reportId} .hfr-compare{background:rgba(20,27,33,.7)!important;color:#e6edf2!important;border-color:#394852!important}
        html.theme-dark #${reportId} .hfr-empty{color:#9eabb5!important;border-color:#4a5965!important}
        html.theme-dark #${reportId} .hfr-empty strong{color:#e6edf2!important}
        html.theme-dark #${reportId} .hfr-empty span{color:#9eabb5!important}
      `;
      document.head.appendChild(dashboardStyle);
      var safeStyle = document.createElement("style");
      safeStyle.setAttribute("data-hesabno-check-card-layout-safe-style", "true");
      safeStyle.textContent = "[data-hesabno-check-info-grid] > [data-hesabno-check-info-due]{order:1}[data-hesabno-check-info-grid] > [data-hesabno-check-amount-box]{order:2}[data-hesabno-check-info-grid] > [data-hesabno-check-number-box]{order:3}[data-hesabno-check-info-grid] > [data-hesabno-check-info-account]{order:4}[data-hesabno-check-status-display]{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:.35rem!important}[data-hesabno-check-status-display]>*{display:none!important}[data-hesabno-check-status-display]::before{content:\"وضعیت چک:\";color:#667684;font-size:11px;font-weight:800}[data-hesabno-check-status-display=\"in-progress\"]::after{content:\"در جریان\"}[data-hesabno-check-status-display=\"passed\"]::after{content:\"پاس‌شده\"}[data-hesabno-check-status-display=\"bounced\"]::after{content:\"برگشت خورده\"}[data-hesabno-check-status-display=\"refunded\"]::after{content:\"مسترد شده\"}[data-hesabno-check-status-display=\"bank-hold\"]::after{content:\"خوابیده در بانک\"}[data-hesabno-check-status-display]::after{font-size:11px;font-weight:900}[data-hesabno-check-info-grid]::before,[data-hesabno-check-info-grid]::after{display:flex;align-items:center;min-width:0;min-height:0;padding:.625rem;border-radius:.75rem;overflow:hidden;white-space:pre-line;text-overflow:ellipsis;font-size:12px;line-height:1.45;font-weight:900;color:#2d3a45;background:rgba(241,245,249,.8);border:1px solid rgba(148,163,184,.35)}[data-hesabno-check-info-grid]::before{content:\"مبلغ چک\\A\" attr(data-hesabno-check-amount);order:2}[data-hesabno-check-info-grid]::after{content:\"شماره چک\\A\" attr(data-hesabno-check-number);order:3}html[data-theme=\"dark\"] [data-hesabno-check-info-grid]::before,html[data-theme=\"dark\"] [data-hesabno-check-info-grid]::after{color:#e2edf1;background:rgba(28,35,44,.8);border-color:rgba(100,116,139,.45)}html[data-theme=\"dark\"] [data-hesabno-check-status-display]::before{color:#9bb0b9}html[data-theme=\"light\"] [data-hesabno-check-status-display=\"in-progress\"]::after{color:#8a6512}html[data-theme=\"light\"] [data-hesabno-check-status-display=\"passed\"]::after{color:#167257}html[data-theme=\"light\"] [data-hesabno-check-status-display=\"bounced\"]::after{color:#a33b4c}html[data-theme=\"light\"] [data-hesabno-check-status-display=\"refunded\"]::after{color:#4165a6}html[data-theme=\"light\"] [data-hesabno-check-status-display=\"bank-hold\"]::after{color:#6656a0}html[data-theme=\"dark\"] [data-hesabno-check-status-display=\"in-progress\"]::after{color:#f5d17a}html[data-theme=\"dark\"] [data-hesabno-check-status-display=\"passed\"]::after{color:#7bd7b5}html[data-theme=\"dark\"] [data-hesabno-check-status-display=\"bounced\"]::after{color:#f29aa8}html[data-theme=\"dark\"] [data-hesabno-check-status-display=\"refunded\"]::after{color:#9ebcf0}html[data-theme=\"dark\"] [data-hesabno-check-status-display=\"bank-hold\"]::after{color:#b8a9f2}";
      document.head.appendChild(safeStyle);
    };
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
