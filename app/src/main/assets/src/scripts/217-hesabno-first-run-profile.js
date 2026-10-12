/* First launch: ask the user for name, family name and mobile before entering the app.
   Stores into the same profile key the app reads ("hesabno:user_profile") and then soft-reloads
   so the dashboard greeting picks the saved name. Shown only once (flag key below). */
(function () {
  var PROFILE_KEY = "hesabno:user_profile";
  var DONE_KEY = "hesabno:first_run_profile_done";

  function store(name, value) {
    try {
      if (window.__safeSet) return window.__safeSet(name, value);
      window.localStorage.setItem(name, value);
      return true;
    } catch (error) { return false; }
  }
  function read(name) {
    try { return window.localStorage.getItem(name); } catch (error) { return null; }
  }
  function toEnglishDigits(v) {
    return String(v || "").replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 1776); })
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 1632); });
  }
  function clean(v) { return String(v || "").replace(/\s+/g, " ").trim(); }
  function faDigits(v) {
    return String(v == null ? "" : v).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[d]; });
  }

  // Already set up (flag, or a stored profile that already has a name) -> nothing to do.
  var existing = null;
  try { existing = JSON.parse(read(PROFILE_KEY) || "null"); } catch (error) { existing = null; }
  if (read(DONE_KEY) === "1" || (existing && clean(existing.firstName))) return;

  function build() {
    var css = {
      position: "fixed", inset: "0", zIndex: "2147483646", background: "#0b1220",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
      fontFamily: "Vazirmatn, system-ui, sans-serif", direction: "rtl", color: "#f1f5f9", overflowY: "auto"
    };
    var overlay = document.createElement("div");
    overlay.id = "hesabno-first-run";
    Object.keys(css).forEach(function (k) { overlay.style[k] = css[k]; });

    var card = document.createElement("form");
    card.setAttribute("novalidate", "novalidate");
    card.style.cssText = "width:100%;max-width:380px;background:#111827;border:1px solid #1f2937;border-radius:24px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,.45)";

    var title = document.createElement("h1");
    title.textContent = "خوش آمدید";
    title.style.cssText = "margin:0 0 6px;font-size:20px;font-weight:800;color:#f8fafc";
    var sub = document.createElement("p");
    sub.textContent = "برای شروع، اطلاعات خود را وارد کنید. نام شما در داشبورد نمایش داده می‌شود.";
    sub.style.cssText = "margin:0 0 18px;font-size:12.5px;line-height:1.7;color:#94a3b8";

    function field(id, label, placeholder, required, type) {
      var wrap = document.createElement("div");
      wrap.style.cssText = "margin-bottom:14px";
      var lb = document.createElement("label");
      lb.htmlFor = id;
      lb.textContent = label + (required ? " *" : " (اختیاری)");
      lb.style.cssText = "display:block;margin-bottom:6px;font-size:12.5px;font-weight:700;color:#cbd5e1";
      var input = document.createElement("input");
      input.id = id; input.name = id; input.type = type || "text";
      input.placeholder = placeholder; input.autocomplete = "off";
      input.style.cssText = "width:100%;box-sizing:border-box;padding:12px 14px;border-radius:14px;border:1px solid #334155;background:#0f172a;color:#f8fafc;font-size:15px;outline:none;font-family:inherit";
      var err = document.createElement("div");
      err.style.cssText = "min-height:16px;margin-top:4px;font-size:11.5px;color:#f87171";
      wrap.appendChild(lb); wrap.appendChild(input); wrap.appendChild(err);
      return { wrap: wrap, input: input, err: err };
    }

    var first = field("hesabno-fr-first", "نام", "مثلاً علی", true);
    var last = field("hesabno-fr-last", "نام خانوادگی", "مثلاً رضایی", true);
    var mobile = field("hesabno-fr-mobile", "شماره موبایل", "۰۹۱۲۳۴۵۶۷۸۹", false, "tel");

    var submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "ورود به برنامه";
    submit.style.cssText = "width:100%;margin-top:6px;padding:13px;border:0;border-radius:14px;background:#10b981;color:#052e1b;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit";

    card.appendChild(title); card.appendChild(sub);
    card.appendChild(first.wrap); card.appendChild(last.wrap); card.appendChild(mobile.wrap);
    card.appendChild(submit);
    overlay.appendChild(card);

    function validate() {
      var ok = true;
      var f = clean(first.input.value), l = clean(last.input.value);
      var m = toEnglishDigits(mobile.input.value).replace(/[\s-]/g, "");
      first.err.textContent = f ? "" : "نام را وارد کنید";
      last.err.textContent = l ? "" : "نام خانوادگی را وارد کنید";
      if (!f) ok = false;
      if (!l) ok = false;
      mobile.err.textContent = "";
      if (m && !/^\+?\d{7,15}$/.test(m)) { mobile.err.textContent = "شماره موبایل معتبر نیست"; ok = false; }
      return ok ? { first: f, last: l, mobile: m } : null;
    }

    card.addEventListener("submit", function (event) {
      event.preventDefault();
      var v = validate();
      if (!v) return;
      var stored = null;
      try { stored = JSON.parse(read(PROFILE_KEY) || "null"); } catch (error) { stored = null; }
      var profile = Object.assign({}, stored || {}, {
        firstName: v.first,
        lastName: v.last,
        fullName: (v.first + " " + v.last).trim(),
        mobile: v.mobile
      });
      if (!store(PROFILE_KEY, JSON.stringify(profile))) {
        sub.textContent = "ذخیره اطلاعات انجام نشد. فضای ذخیره‌سازی مرورگر را بررسی کنید.";
        sub.style.color = "#f87171";
        return;
      }
      store(DONE_KEY, "1");
      overlay.remove();
      if (typeof window.__hesabnoSoftReload === "function") window.__hesabnoSoftReload();
    });

    return overlay;
  }

  function mount() {
    if (!document.body) { document.addEventListener("DOMContentLoaded", mount); return; }
    if (document.getElementById("hesabno-first-run")) return;
    document.body.appendChild(build());
    var input = document.getElementById("hesabno-fr-first");
    if (input) input.focus();
  }
  function showIntro(done) {
    var key = "hesabno:first_run_intro_done";
    if (read(key) === "1") { done(); return; }
    var slides = [
      {
        t: "شروع ساده و سریع",
        b: "در چند قدم کوتاه با بخش‌های اصلی مای مانی آشنا شو.",
        mock: '<div class="mock"><div class="m-title"><span>داشبورد</span><span class="m-badge">امروز</span></div><div class="greet">سلام علی 👋</div><div class="summary"><div class="cell"><div class="lbl">موجودی کل</div><div class="val pos">۱۲٬۵۶۰٬۰۰۰</div></div><div class="cell"><div class="lbl">درآمد این ماه</div><div class="val pos">۴٬۲۰۰٬۰۰۰</div></div><div class="cell"><div class="lbl">هزینه این ماه</div><div class="val neg">۱٬۹۸۰٬۰۰۰</div></div></div><div class="row"><div class="r-l"><span class="dot" style="background:#34d399"></span><div><div>مانده حساب‌ها همگام شد</div><div class="sub">آخرین به‌روزرسانی: امروز</div></div></div><span class="amt pos">✓</span></div></div>'
      },
      {
        t: "حساب‌ها و مانده‌ها",
        b: "حساب‌های بانکی، صندوق و مانده‌ها را یک‌جا مدیریت کن.",
        mock: '<div class="mock"><div class="m-title"><span>حساب‌ها</span><span class="m-badge">۳ حساب</span></div><div class="row"><div class="r-l"><span class="dot" style="background:#2dd4bf"></span><div><div>بانک ملت — کارت</div><div class="sub">•••• ۱۲۳۴</div></div></div><span class="amt">۱۲٬۵۰۰٬۰۰۰</span></div><div class="row"><div class="r-l"><span class="dot" style="background:#60a5fa"></span><div><div>بانک صادرات — پس‌انداز</div><div class="sub">•••• ۸۸۲۱</div></div></div><span class="amt">۳٬۲۰۰٬۰۰۰</span></div><div class="row"><div class="r-l"><span class="dot" style="background:#fbbf24"></span><div><div>صندوق — نقدی</div><div class="sub">مغازه</div></div></div><span class="amt">۸۵۰٬۰۰۰</span></div></div>'
      },
      {
        t: "ثبت تراکنش‌ها",
        b: "دریافت، پرداخت و انتقال وجه را سریع و منظم ثبت کن.",
        mock: '<div class="mock"><div class="m-title"><span>تراکنش‌های اخیر</span><span class="m-badge">امروز</span></div><div class="row"><div class="r-l"><span class="dot" style="background:#34d399"></span><div><div>دریافت از آقای احمدی</div><div class="sub">فاکتور فروش • ۱۰:۲۴</div></div></div><span class="amt pos">+۲٬۵۰۰٬۰۰۰</span></div><div class="row"><div class="r-l"><span class="dot" style="background:#fbbf24"></span><div><div>پرداخت اجاره دفتر</div><div class="sub">هزینه ثابت • دیروز</div></div></div><span class="amt neg">−۱٬۸۰۰٬۰۰۰</span></div><div class="row"><div class="r-l"><span class="dot" style="background:#fb7185"></span><div><div>خرید لوازم اداری</div><div class="sub">هزینه جاری • ۲ روز پیش</div></div></div><span class="amt neg">−۳۲۰٬۰۰۰</span></div></div>'
      },
      {
        t: "گزارش‌های روشن",
        b: "با گزارش‌ها و سوابق، وضعیت مالی خودت را بهتر دنبال کن.",
        mock: '<div class="mock"><div class="m-title"><span>گزارش هزینه‌ها</span><span class="m-badge">۱۴۰۳</span></div><div class="bars"><div class="b" style="height:42%"></div><div class="b" style="height:68%"></div><div class="b" style="height:54%"></div><div class="b hi" style="height:88%"></div><div class="b" style="height:63%"></div></div><div class="xaxis"><span>فرو</span><span>ارد</span><span>خرد</span><span>تیر</span><span>مرد</span></div><div class="row" style="justify-content:center"><span class="sub">مجموع هزینه‌ها: </span><span class="amt neg">۹٬۴۵۰٬۰۰۰</span></div></div>'
      }
    ];
    var current = 0;
    var overlay = document.createElement("div");
    overlay.id = "hesabno-intro-tour";
    overlay.dir = "rtl";
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483645;display:flex;align-items:center;justify-content:center;padding:18px;overflow-y:auto;background:radial-gradient(circle at 15% 10%,rgba(16,185,129,.18),transparent 38%),#071115;color:#eef7f6;font-family:Vazirmatn,system-ui,sans-serif";
    var style = document.createElement("style");
    style.textContent =
      "#hesabno-intro-tour *{box-sizing:border-box}" +
      "#hesabno-intro-tour .intro-card{width:100%;max-width:420px;padding:22px;border:1px solid #294349;border-radius:26px;background:linear-gradient(145deg,#12252b,#0b171c);box-shadow:0 24px 70px #0008;animation:introCardIn .5s cubic-bezier(.22,.75,.25,1) both}" +
      "@keyframes introCardIn{from{opacity:0;transform:translateY(18px) scale(.98)}to{opacity:1;transform:none}}" +
      "#hesabno-intro-tour .intro-art{position:relative;overflow:hidden;height:190px;display:flex;align-items:center;margin:8px 0 20px;border:1px solid #294349;border-radius:20px;background:linear-gradient(160deg,#122a30,#0b171c);padding:10px 12px}" +
      "#hesabno-intro-tour .intro-art::after{content:'';position:absolute;z-index:5;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.07) 50%,transparent 65%);transform:translateX(-120%);animation:introSheen 5.4s ease-in-out infinite}" +
      "@keyframes introSheen{0%{transform:translateX(-120%)}45%,100%{transform:translateX(120%)}}" +
      "#hesabno-intro-tour .mock{position:relative;z-index:2;width:100%;display:flex;flex-direction:column;gap:8px;color:#dbe9e7;animation:mockIn .45s cubic-bezier(.22,.75,.25,1) both}" +
      "@keyframes mockIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}" +
      "#hesabno-intro-tour .m-title{display:flex;align-items:center;justify-content:space-between;font-size:11.5px;font-weight:800;color:#eafaf6}" +
      "#hesabno-intro-tour .m-badge{font-size:9px;color:#7f9d9c;background:#12262b;border:1px solid #244047;border-radius:8px;padding:2px 7px}" +
      "#hesabno-intro-tour .greet{font-size:11px;color:#a6bfbe}" +
      "#hesabno-intro-tour .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}" +
      "#hesabno-intro-tour .cell{background:#0f2127;border:1px solid #1d373d;border-radius:10px;padding:7px 8px}" +
      "#hesabno-intro-tour .lbl{font-size:8.5px;color:#7f9d9c}" +
      "#hesabno-intro-tour .val{font-size:11px;font-weight:800;margin-top:3px;font-variant-numeric:tabular-nums}" +
      "#hesabno-intro-tour .row{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#0f2127;border:1px solid #1d373d;border-radius:10px;padding:7px 9px}" +
      "#hesabno-intro-tour .r-l{display:flex;align-items:center;gap:8px;min-width:0}" +
      "#hesabno-intro-tour .r-l>div{min-width:0}" +
      "#hesabno-intro-tour .r-l>div>div:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10.5px}" +
      "#hesabno-intro-tour .dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto}" +
      "#hesabno-intro-tour .amt{font-weight:800;font-size:10.5px;font-variant-numeric:tabular-nums;white-space:nowrap}" +
      "#hesabno-intro-tour .sub{font-size:8.5px;color:#7f9d9c;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#hesabno-intro-tour .pos{color:#34d399}" +
      "#hesabno-intro-tour .neg{color:#fbbf24}" +
      "#hesabno-intro-tour .bars{display:flex;align-items:flex-end;gap:6px;height:62px;padding:0 4px}" +
      "#hesabno-intro-tour .bars .b{flex:1;border-radius:5px 5px 0 0;background:linear-gradient(180deg,#2dd4bf,#0d9488);transform-origin:bottom;animation:barUp .6s cubic-bezier(.22,.75,.25,1) both}" +
      "#hesabno-intro-tour .bars .b.hi{background:linear-gradient(180deg,#6ee7b7,#14b8a6)}" +
      "#hesabno-intro-tour .bars .b:nth-child(2){animation-delay:.05s}" +
      "#hesabno-intro-tour .bars .b:nth-child(3){animation-delay:.1s}" +
      "#hesabno-intro-tour .bars .b:nth-child(4){animation-delay:.15s}" +
      "#hesabno-intro-tour .bars .b:nth-child(5){animation-delay:.2s}" +
      "@keyframes barUp{from{transform:scaleY(0)}to{transform:scaleY(1)}}" +
      "#hesabno-intro-tour .xaxis{display:flex;gap:6px;font-size:8px;color:#6f8f8d}" +
      "#hesabno-intro-tour .xaxis span{flex:1;text-align:center}" +
      "#hesabno-intro-tour .intro-kicker{color:#5eead4;font-size:11px;font-weight:800}" +
      "#hesabno-intro-tour .intro-copy{animation:introCopyIn .42s cubic-bezier(.22,.75,.25,1) both}" +
      "@keyframes introCopyIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
      "#hesabno-intro-tour h2{margin:8px 0;color:#f4fbfa;font-size:22px}" +
      "#hesabno-intro-tour p{min-height:48px;margin:0;color:#a6bfbe;font-size:13px;line-height:1.9}" +
      "#hesabno-intro-tour .intro-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:22px}" +
      "#hesabno-intro-tour button{min-height:44px;padding:0 16px;border:0;border-radius:13px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;transition:transform .15s ease,box-shadow .2s ease,background .2s ease}" +
      "#hesabno-intro-tour button:hover{transform:translateY(-1px)}" +
      "#hesabno-intro-tour button:active{transform:translateY(0) scale(.97)}" +
      "#hesabno-intro-tour button:focus-visible{outline:2px solid #2dd4bf;outline-offset:2px}" +
      "#hesabno-intro-tour .intro-skip{background:#23383d;color:#b9cecc}" +
      "#hesabno-intro-tour .intro-skip:hover{background:#2c464b}" +
      "#hesabno-intro-tour .intro-next{background:linear-gradient(110deg,#6ee7b7,#2dd4bf);color:#06251e;box-shadow:0 8px 20px rgba(45,212,191,.2);animation:introNextGlow 3.4s ease-in-out infinite}" +
      "@keyframes introNextGlow{0%,100%{box-shadow:0 8px 20px rgba(45,212,191,.18)}50%{box-shadow:0 11px 28px rgba(45,212,191,.45)}}" +
      "#hesabno-intro-tour .intro-next:hover{animation:none;box-shadow:0 12px 30px rgba(45,212,191,.45)}" +
      "#hesabno-intro-tour .intro-dots{display:flex;gap:5px;align-items:center}" +
      "#hesabno-intro-tour .intro-dots span{width:6px;height:6px;border-radius:9px;background:#385052;transition:all .3s ease}" +
      "#hesabno-intro-tour .intro-dots span.active{width:18px;background:#34d399}" +
      "@media(max-height:620px){#hesabno-intro-tour .intro-art{height:150px;margin:6px 0 12px}#hesabno-intro-tour .intro-card{padding:16px}#hesabno-intro-tour .bars{height:46px}}" +
      "@media(prefers-reduced-motion:reduce){#hesabno-intro-tour *,#hesabno-intro-tour *::before,#hesabno-intro-tour *::after{animation:none!important;transition:none!important}}";
    document.head.appendChild(style);
    var card = document.createElement("section"); card.className = "intro-card"; card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true"); card.setAttribute("aria-label", "معرفی برنامه");
    card.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between"><strong style="letter-spacing:.08em;font-size:11px">MY MONEY</strong><span style="font-size:10px;color:#7f9d9c">معرفی کوتاه</span></div><div class="intro-art" aria-hidden="true" data-intro-art></div><div class="intro-copy" data-intro-copy><div class="intro-kicker" data-intro-step></div><h2 data-intro-title></h2><p data-intro-body aria-live="polite"></p></div><div class="intro-dots" data-intro-dots style="margin-top:18px"></div><div class="intro-actions"><button type="button" class="intro-skip" data-intro-skip>رد کردن</button><button type="button" class="intro-next" data-intro-next>بعدی ←</button></div>';
    overlay.appendChild(style); overlay.appendChild(card); document.body.appendChild(overlay);
    var step = card.querySelector('[data-intro-step]'), title = card.querySelector('[data-intro-title]'), body = card.querySelector('[data-intro-body]'), dots = card.querySelector('[data-intro-dots]'), next = card.querySelector('[data-intro-next]'), copy = card.querySelector('[data-intro-copy]'), art = card.querySelector('[data-intro-art]');
    function finish() { store(key, "1"); overlay.remove(); style.remove(); done(); }
    function render() {
      step.textContent = faDigits(current + 1) + " از " + faDigits(slides.length);
      title.textContent = slides[current].t;
      body.textContent = slides[current].b;
      art.innerHTML = slides[current].mock;
      dots.innerHTML = slides.map(function (_, i) { return '<span class="' + (i === current ? 'active' : '') + '"></span>'; }).join('');
      next.textContent = current === slides.length - 1 ? "شروع کنیم ←" : "بعدی ←";
      copy.style.animation = "none"; void copy.offsetWidth; copy.style.animation = "";
    }
    next.addEventListener("click", function () { if (current < slides.length - 1) { current += 1; render(); } else finish(); });
    card.querySelector('[data-intro-skip]').addEventListener("click", finish);
    render(); next.focus();
  }

  function startFirstRun() { showIntro(mount); }
  startFirstRun();
})();
