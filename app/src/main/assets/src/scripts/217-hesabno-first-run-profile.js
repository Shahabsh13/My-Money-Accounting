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
      ["شروع ساده و سریع", "در چند قدم کوتاه با بخش‌های اصلی مای مانی آشنا شو."],
      ["حساب‌ها و مانده‌ها", "حساب‌های بانکی، صندوق و مانده‌ها را یک‌جا مدیریت کن."],
      ["ثبت تراکنش‌ها", "دریافت، پرداخت و انتقال وجه را سریع و منظم ثبت کن."],
      ["گزارش‌های روشن", "با گزارش‌ها و سوابق، وضعیت مالی خودت را بهتر دنبال کن."]
    ];
    var current = 0;
    var overlay = document.createElement("div");
    overlay.id = "hesabno-intro-tour";
    overlay.dir = "rtl";
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483645;display:flex;align-items:center;justify-content:center;padding:18px;background:radial-gradient(circle at 15% 10%,rgba(16,185,129,.18),transparent 38%),#071115;color:#eef7f6;font-family:Vazirmatn,system-ui,sans-serif";
    var style = document.createElement("style");
    style.textContent = "#hesabno-intro-tour *{box-sizing:border-box}#hesabno-intro-tour .intro-card{width:100%;max-width:420px;padding:22px;border:1px solid #294349;border-radius:26px;background:linear-gradient(145deg,#12252b,#0b171c);box-shadow:0 24px 70px #0008}#hesabno-intro-tour .intro-art{height:190px;display:grid;place-items:center;margin:8px 0 20px;border:1px solid #294349;border-radius:20px;background:radial-gradient(circle at center, #173b3c,#0b171c)}#hesabno-intro-tour .intro-art svg{width:150px;height:130px}#hesabno-intro-tour .intro-kicker{color:#5eead4;font-size:11px;font-weight:800}#hesabno-intro-tour h2{margin:8px 0;color:#f4fbfa;font-size:22px}#hesabno-intro-tour p{min-height:48px;margin:0;color:#a6bfbe;font-size:13px;line-height:1.9}#hesabno-intro-tour .intro-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:22px}#hesabno-intro-tour button{min-height:44px;padding:0 16px;border:0;border-radius:13px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}#hesabno-intro-tour .intro-skip{background:#23383d;color:#b9cecc}#hesabno-intro-tour .intro-next{background:linear-gradient(110deg,#6ee7b7,#2dd4bf);color:#06251e}#hesabno-intro-tour .intro-dots{display:flex;gap:5px;align-items:center}#hesabno-intro-tour .intro-dots span{width:6px;height:6px;border-radius:9px;background:#385052}#hesabno-intro-tour .intro-dots span.active{width:18px;background:#34d399}@media(max-height:600px){#hesabno-intro-tour .intro-art{height:130px;margin:6px 0 12px}#hesabno-intro-tour .intro-card{padding:16px}}";
    document.head.appendChild(style);
    var card = document.createElement("section"); card.className = "intro-card"; card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true"); card.setAttribute("aria-label", "معرفی برنامه");
    card.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between"><strong style="letter-spacing:.08em;font-size:11px">MY MONEY</strong><span style="font-size:10px;color:#7f9d9c">معرفی کوتاه</span></div><div class="intro-art" aria-hidden="true"><svg viewBox="0 0 160 140" fill="none"><rect x="23" y="24" width="114" height="92" rx="18" fill="#102128" stroke="#3b7d70"/><rect x="38" y="40" width="84" height="16" rx="6" fill="#34d399" opacity=".22"/><path d="M45 48h34M45 75h70M45 87h48" stroke="#6ee7b7" stroke-width="4" stroke-linecap="round"/><circle cx="109" cy="99" r="13" fill="#10b981"/><path d="m103 99 4 4 8-9" stroke="#effdf7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="intro-kicker" data-intro-step></div><h2 data-intro-title></h2><p data-intro-body></p><div class="intro-dots" data-intro-dots style="margin-top:18px"></div><div class="intro-actions"><button type="button" class="intro-skip" data-intro-skip>رد کردن</button><button type="button" class="intro-next" data-intro-next>بعدی ←</button></div>';
    overlay.appendChild(style); overlay.appendChild(card); document.body.appendChild(overlay);
    var step = card.querySelector('[data-intro-step]'), title = card.querySelector('[data-intro-title]'), body = card.querySelector('[data-intro-body]'), dots = card.querySelector('[data-intro-dots]'), next = card.querySelector('[data-intro-next]');
    function finish() { store(key, "1"); overlay.remove(); style.remove(); done(); }
    function render() { step.textContent = faDigits(current + 1) + " از " + faDigits(slides.length); title.textContent = slides[current][0]; body.textContent = slides[current][1]; dots.innerHTML = slides.map(function (_, i) { return '<span class="' + (i === current ? 'active' : '') + '"></span>'; }).join(''); next.textContent = current === slides.length - 1 ? "شروع کنیم ←" : "بعدی ←"; }
    next.addEventListener("click", function () { if (current < slides.length - 1) { current += 1; render(); } else finish(); });
    card.querySelector('[data-intro-skip]').addEventListener("click", finish);
    render(); next.focus();
  }

  function startFirstRun() { showIntro(mount); }
  startFirstRun();
})();
