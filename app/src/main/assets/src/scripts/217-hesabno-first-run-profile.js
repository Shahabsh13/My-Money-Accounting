/* First launch: welcome tour + ask the user for name, family name and mobile before entering the app.
   Tour slides have bespoke SVG illustrations. Stores into "hesabno:user_profile" and then soft-reloads
   so the dashboard greeting picks the saved name. Shown only once (flag keys below). */
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

  /* ── profile form (after the tour) ─────────────────────────────────── */
  function build() {
    var css = {
      position: "fixed", inset: "0", zIndex: "2147483646",
      background: "radial-gradient(1100px 500px at 12% 8%,rgba(16,185,129,.16),transparent 55%),radial-gradient(900px 480px at 95% 90%,rgba(45,212,191,.12),transparent 60%),#071115",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
      fontFamily: "Vazirmatn, system-ui, sans-serif", direction: "rtl", color: "#f1f5f9", overflowY: "auto"
    };
    var overlay = document.createElement("div");
    overlay.id = "hesabno-first-run";
    Object.keys(css).forEach(function (k) { overlay.style[k] = css[k]; });

    var formStyle = document.createElement("style");
    formStyle.textContent = "#hesabno-first-run input:focus{border-color:#2dd4bf!important;box-shadow:0 0 0 3px rgba(45,212,191,.18)}#hesabno-first-run button{transition:transform .15s ease,box-shadow .2s ease}#hesabno-first-run button:hover{transform:translateY(-1px)}#hesabno-first-run button:active{transform:scale(.98)}";
    document.head.appendChild(formStyle);

    var card = document.createElement("form");
    card.setAttribute("novalidate", "novalidate");
    card.style.cssText = "width:100%;max-width:380px;background:linear-gradient(150deg,#13272d,#0b171c);border:1px solid #2a4a50;border-radius:24px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,.45)";

    var brand = document.createElement("div");
    brand.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:12px";
    brand.innerHTML = '<span style="width:9px;height:9px;border-radius:3px;background:linear-gradient(135deg,#34d399,#0d9488);display:inline-block"></span><strong style="font-size:11px;letter-spacing:.06em">MY MONEY</strong>';

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
    submit.style.cssText = "width:100%;margin-top:6px;padding:13px;border:0;border-radius:14px;background:linear-gradient(115deg,#34d399,#14b8a6);color:#052e1b;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 10px 24px rgba(20,184,166,.25)";

    card.appendChild(brand); card.appendChild(title); card.appendChild(sub);
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

  /* ── welcome tour ──────────────────────────────────────────────────── */
  function showIntro(done) {
    var key = "hesabno:first_run_intro_done";
    if (read(key) === "1") { done(); return; }
    var slides = [
      {
        t: "شروع ساده و سریع",
        b: "در چند قدم کوتاه با بخش‌های اصلی مای مانی آشنا شو.",
        svg: '<svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="iv1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4ade80"/><stop offset="1" stop-color="#14b8a6"/></linearGradient><linearGradient id="iv1f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#fb7185"/></linearGradient></defs><rect x="26" y="12" width="148" height="72" rx="14" fill="#0d1b21" stroke="#2b5b58" stroke-width="1.5"/><rect x="40" y="22" width="70" height="10" rx="5" fill="#142830"/><circle cx="152" cy="27" r="3" fill="#2dd4bf"/><circle cx="142" cy="27" r="3" fill="#1f6f63"/><circle cx="132" cy="27" r="3" fill="#1f6f63"/><path d="M92 58 C92 40 100 27 110 27 C120 27 128 40 128 58 L124 96 L96 96 Z" fill="url(#iv1)"/><circle cx="112" cy="46" r="8" fill="#0b171c" stroke="#7df3e0" stroke-width="2"/><path d="M97 82 L85 100 L99 95 Z" fill="#14b8a6"/><path d="M123 82 L135 100 L121 95 Z" fill="#14b8a6"/><path d="M101 96 Q112 118 123 96 Z" fill="url(#iv1f)"/><path d="M108 96 Q112 108 116 96 Z" fill="#fde68a" opacity=".9"/><path d="M70 70 l16 -8" stroke="#2dd4bf" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/><path d="M66 84 l18 -8" stroke="#2dd4bf" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/><path d="M158 44 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" fill="#6ee7b7"/><path d="M40 104 l2.5 5 5 2.5 -5 2.5 -2.5 5 -2.5 -5 -5 -2.5 5 -2.5 Z" fill="#2dd4bf" opacity=".8"/><path d="M156 110 l2 4.5 4.5 2 -4.5 2 -2 4.5 -2 -4.5 -4.5 -2 4.5 -2 Z" fill="#3ff0d8" opacity=".7"/><circle cx="166" cy="96" r="13" fill="#10b981"/><path d="M159 96 l5 5 9 -10" stroke="#052e1b" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      },
      {
        t: "حساب‌ها و مانده‌ها",
        b: "حساب‌های بانکی، صندوق و مانده‌ها را یک‌جا مدیریت کن.",
        svg: '<svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="iv2c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c4a46"/><stop offset="1" stop-color="#0e262b"/></linearGradient></defs><g transform="rotate(-7 110 78)"><rect x="42" y="48" width="118" height="62" rx="11" fill="#0f232a" stroke="#31534f" stroke-width="1.5"/></g><rect x="32" y="34" width="122" height="62" rx="11" fill="url(#iv2c)" stroke="#2f6e63" stroke-width="1.5"/><rect x="44" y="46" width="20" height="14" rx="3" fill="#fbbf24"/><path d="M58 60 L60 52 56 48 52 50" stroke="#b45309" stroke-width="1" opacity=".7"/><path d="M44 72 h92 M44 78 h60" stroke="#5fb8a6" stroke-width="2" stroke-linecap="round" opacity=".55"/><rect x="96" y="18" width="84" height="22" rx="11" fill="#0d1f25" stroke="#2b6b5e" stroke-width="1.5"/><path d="M108 29 l10 -8 M118 21 h8 M126 21 v10" stroke="#6ee7b7" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M143 33 h22" stroke="#3b7d70" stroke-width="2.4" stroke-linecap="round"/><circle cx="150" cy="106" r="10" fill="#fcd34d" stroke="#b45309" stroke-width="1.5"/><circle cx="150" cy="106" r="6" fill="none" stroke="#b45309" stroke-width="1" opacity=".6"/><circle cx="170" cy="94" r="7" fill="#fbbf24" stroke="#b45309" stroke-width="1.5"/><path d="M170 90 v8 M167 94 h6" stroke="#92400e" stroke-width="1.3" stroke-linecap="round"/><path d="M40 100 l2 4.5 4.5 2 -4.5 2 -2 4.5 -2 -4.5 -4.5 -2 4.5 -2 Z" fill="#2dd4bf" opacity=".75"/><path d="M178 122 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5 Z" fill="#6ee7b7" opacity=".6"/></svg>'
      },
      {
        t: "ثبت تراکنش‌ها",
        b: "دریافت، پرداخت و انتقال وجه را سریع و منظم ثبت کن.",
        svg: '<svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="iv3g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#0d9488"/></linearGradient><linearGradient id="iv3a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs><circle cx="54" cy="52" r="27" fill="#0d2527" stroke="#10b981" stroke-width="2"/><path d="M54 66 V42 M46 50 l8 -8 8 8" stroke="#6ee7b7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 76 h24" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" opacity=".6"/><circle cx="146" cy="52" r="27" fill="#241b0c" stroke="#f59e0b" stroke-width="2"/><path d="M146 40 V64 M138 56 l8 8 8 -8" stroke="#fcd34d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M134 30 h24" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" opacity=".6"/><rect x="80" y="28" width="40" height="86" rx="7" fill="#e8f4ef"/><rect x="88" y="38" width="24" height="4" rx="2" fill="#0b9e77" opacity=".55"/><rect x="88" y="50" width="24" height="3" rx="1.5" fill="#0e6b58" opacity=".4"/><rect x="88" y="58" width="24" height="3" rx="1.5" fill="#0e6b58" opacity=".4"/><rect x="88" y="70" width="24" height="3" rx="1.5" fill="#f59e0b" opacity=".75"/><rect x="88" y="80" width="18" height="3" rx="1.5" fill="#0e6b58" opacity=".4"/><path d="M80 114 l5 -6 5 6 5 -6 5 6 5 -6 5 6 5 -6 5 6" stroke="#0e6b58" stroke-width="2" fill="none"/><path d="M81 62 C 72 76 74 90 86 92" stroke="#2b5b55" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round"/><path d="M120 86 C 130 90 136 78 128 66" stroke="#3a4a33" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round"/><circle cx="30" cy="98" r="8" fill="#fcd34d" stroke="#b45309" stroke-width="1.5"/><circle cx="172" cy="96" r="8" fill="#fbbf24" stroke="#b45309" stroke-width="1.5"/><path d="M166 30 l2.5 5 5 2.5 -5 2.5 -2.5 5 -2.5 -5 -5 -2.5 5 -2.5 Z" fill="#6ee7b7" opacity=".7"/><path d="M40 118 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 Z" fill="#2dd4bf" opacity=".6"/></svg>'
      },
      {
        t: "گزارش‌های روشن",
        b: "با گزارش‌ها و سوابق، وضعیت مالی خودت را بهتر دنبال کن.",
        svg: '<svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="iv4g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#0d9488"/></linearGradient></defs><path d="M42 40 h120 M42 62 h120 M42 84 h120" stroke="#20383c" stroke-width="1.5" stroke-dasharray="2 6"/><rect x="52" y="72" width="15" height="42" rx="4" fill="url(#iv4g)" opacity=".55"/><rect x="74" y="56" width="15" height="58" rx="4" fill="url(#iv4g)" opacity=".75"/><rect x="96" y="78" width="15" height="36" rx="4" fill="url(#iv4g)"/><rect x="118" y="44" width="15" height="70" rx="4" fill="#fbbf24"/><rect x="140" y="62" width="15" height="52" rx="4" fill="url(#iv4g)" opacity=".65"/><path d="M40 116 h130" stroke="#35636b" stroke-width="3" stroke-linecap="round"/><path d="M40 121 h60" stroke="#35636b" stroke-width="2" stroke-linecap="round" opacity=".6"/><path d="M58 66 L80 52 L101 64 L125 36 L148 56" stroke="#a7f3d0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="125" cy="36" r="4" fill="#6ee7b7"/><path d="M146 58 l8 -2 -4 -7" stroke="#a7f3d0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="56" cy="34" r="16" stroke="#1f4b47" stroke-width="6" fill="none"/><circle cx="56" cy="34" r="16" stroke="#2dd4bf" stroke-width="6" fill="none" stroke-dasharray="62 38.5" stroke-linecap="round" transform="rotate(-60 56 34)"/><path d="M166 22 l2.5 5 5 2.5 -5 2.5 -2.5 5 -2.5 -5 -5 -2.5 5 -2.5 Z" fill="#6ee7b7" opacity=".7"/><path d="M34 132 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 Z" fill="#2dd4bf" opacity=".6"/></svg>'
      }
    ];
    var current = 0;

    var overlay = document.createElement("div");
    overlay.id = "hesabno-intro-tour";
    overlay.dir = "rtl";

    var style = document.createElement("style");
    style.textContent = "#hesabno-intro-tour *{box-sizing:border-box;margin:0}#hesabno-intro-tour{position:fixed;inset:0;z-index:2147483645;display:flex;align-items:center;justify-content:center;padding:18px;overflow-y:auto;background:radial-gradient(1100px 500px at 12% 8%,rgba(16,185,129,.16),transparent 55%),radial-gradient(900px 480px at 95% 90%,rgba(45,212,191,.12),transparent 60%),#071115;color:#eef7f6;font-family:Vazirmatn,system-ui,sans-serif}#hesabno-intro-tour .intro-orb{position:fixed;border-radius:50%;filter:blur(60px);pointer-events:none;opacity:.55}#hesabno-intro-tour .intro-orb.a{width:260px;height:260px;top:-80px;right:-60px;background:radial-gradient(circle,#14b8a6,transparent 70%);animation:hesabnoOrbA 11s ease-in-out infinite alternate}#hesabno-intro-tour .intro-orb.b{width:220px;height:220px;bottom:-70px;left:-50px;background:radial-gradient(circle,#10b981,transparent 70%);animation:hesabnoOrbB 13s ease-in-out infinite alternate}@keyframes hesabnoOrbA{from{transform:translate(0,0) scale(1)}to{transform:translate(-40px,30px) scale(1.12)}}@keyframes hesabnoOrbB{from{transform:translate(0,0) scale(1)}to{transform:translate(36px,-26px) scale(1.1)}}#hesabno-intro-tour .intro-card{position:relative;width:100%;max-width:440px;padding:22px;border-radius:28px;background:linear-gradient(150deg,#13272d,#0b171c);border:1px solid #2a4a50;box-shadow:0 30px 80px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.04);animation:hesabnoIntroCard 460ms cubic-bezier(.22,.75,.25,1) both}@keyframes hesabnoIntroCard{from{opacity:0;transform:translateY(22px) scale(.97)}to{opacity:1;transform:none}}#hesabno-intro-tour .intro-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}#hesabno-intro-tour .intro-brand{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.06em}#hesabno-intro-tour .intro-brand .dot{width:9px;height:9px;border-radius:3px;background:linear-gradient(135deg,#34d399,#0d9488)}#hesabno-intro-tour .intro-meta{font-size:11px;color:#7f9d9c}#hesabno-intro-tour .intro-progress{height:5px;border-radius:6px;background:#1b3338;overflow:hidden;margin-bottom:18px}#hesabno-intro-tour .intro-progress i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#34d399,#2dd4bf);transition:width .34s cubic-bezier(.22,.75,.25,1)}#hesabno-intro-tour .intro-art{height:196px;display:grid;place-items:center;border:1px solid #2a4a50;border-radius:22px;background:radial-gradient(circle at 50% 42%,#14333a,#0b171c 78%);position:relative;overflow:hidden;margin-bottom:18px}#hesabno-intro-tour .intro-art svg{width:210px;height:auto;filter:drop-shadow(0 10px 22px rgba(0,0,0,.35))}#hesabno-intro-tour .intro-art::after{content:'';position:absolute;inset:auto -20% -45% -20%;height:120px;background:radial-gradient(closest-side,rgba(16,185,129,.2),transparent 75%)}#hesabno-intro-tour h2{margin-bottom:8px;color:#f4fbfa;font-size:22px;font-weight:800}#hesabno-intro-tour p{min-height:50px;color:#a6bfbe;font-size:13px;line-height:1.9}#hesabno-intro-tour .intro-nav{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:18px}#hesabno-intro-tour .intro-dots{display:flex;align-items:center;gap:6px}#hesabno-intro-tour .intro-dots span{width:7px;height:7px;border-radius:9px;background:#3a5356;transition:all .3s ease}#hesabno-intro-tour .intro-dots span.active{width:22px;background:linear-gradient(90deg,#34d399,#2dd4bf)}#hesabno-intro-tour .intro-count{font-size:10.5px;color:#7f9d9c;white-space:nowrap}#hesabno-intro-tour .intro-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:16px}#hesabno-intro-tour button{min-height:46px;padding:0 18px;border:0;border-radius:14px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;transition:transform .15s ease,box-shadow .2s ease,background .2s ease}#hesabno-intro-tour button:hover{transform:translateY(-1px)}#hesabno-intro-tour button:active{transform:translateY(0) scale(.98)}#hesabno-intro-tour button:focus-visible{outline:2px solid #2dd4bf;outline-offset:2px}#hesabno-intro-tour .intro-skip{background:#1e3237;color:#b9cecc;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}#hesabno-intro-tour .intro-skip:hover{background:#274047}#hesabno-intro-tour .intro-next{background:linear-gradient(115deg,#34d399,#14b8a6);color:#052e1b;box-shadow:0 10px 24px rgba(20,184,166,.28)}#hesabno-intro-tour .intro-next:hover{box-shadow:0 14px 30px rgba(20,184,166,.4)}#hesabno-intro-tour .intro-swap{animation:hesabnoArtIn 380ms cubic-bezier(.22,.75,.25,1) both}@keyframes hesabnoArtIn{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}@media(max-height:620px){#hesabno-intro-tour .intro-art{height:132px;margin-bottom:12px}#hesabno-intro-tour .intro-art svg{width:150px}#hesabno-intro-tour .intro-card{padding:16px}#hesabno-intro-tour p{min-height:0}#hesabno-intro-tour .intro-nav{margin-top:12px}#hesabno-intro-tour .intro-actions{margin-top:12px}}@media(prefers-reduced-motion:reduce){#hesabno-intro-tour *,#hesabno-intro-tour *::before,#hesabno-intro-tour *::after{animation:none!important;transition:none!important}}";
    document.head.appendChild(style);

    var orbA = document.createElement("div"); orbA.className = "intro-orb a";
    var orbB = document.createElement("div"); orbB.className = "intro-orb b";
    overlay.appendChild(orbA); overlay.appendChild(orbB);

    var card = document.createElement("section");
    card.className = "intro-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", "معرفی برنامه");
    card.innerHTML =
      '<div class="intro-head"><span class="intro-brand"><span class="dot"></span>MY MONEY</span><span class="intro-meta">معرفی کوتاه</span></div>' +
      '<div class="intro-progress"><i data-intro-bar></i></div>' +
      '<div class="intro-swap" data-intro-swap>' +
        '<div class="intro-art"><svg data-intro-art style="width:210px;height:auto"></svg></div>' +
        '<h2 data-intro-title></h2>' +
        '<p data-intro-body aria-live="polite"></p>' +
      '</div>' +
      '<div class="intro-nav"><div class="intro-dots" data-intro-dots></div><span class="intro-count" data-intro-count></span></div>' +
      '<div class="intro-actions">' +
        '<button type="button" class="intro-skip" data-intro-skip>رد کردن</button>' +
        '<button type="button" class="intro-next" data-intro-next>بعدی ←</button>' +
      '</div>';

    overlay.appendChild(style); overlay.appendChild(card);
    document.body.appendChild(overlay);

    var art = card.querySelector("[data-intro-art]");
    var titleEl = card.querySelector("[data-intro-title]");
    var bodyEl = card.querySelector("[data-intro-body]");
    var dotsEl = card.querySelector("[data-intro-dots]");
    var countEl = card.querySelector("[data-intro-count]");
    var barEl = card.querySelector("[data-intro-bar]");
    var swapEl = card.querySelector("[data-intro-swap]");
    var next = card.querySelector("[data-intro-next]");

    function finish() { store(key, "1"); overlay.remove(); style.remove(); done(); }
    function render() {
      art.innerHTML = slides[current].svg;
      titleEl.textContent = slides[current].t;
      bodyEl.textContent = slides[current].b;
      dotsEl.innerHTML = slides.map(function (_, i) {
        return '<span class="' + (i === current ? "active" : "") + '"></span>';
      }).join("");
      countEl.textContent = faDigits(current + 1) + " از " + faDigits(slides.length);
      barEl.style.width = Math.round(((current + 1) / slides.length) * 100) + "%";
      next.textContent = current === slides.length - 1 ? "شروع کنیم ←" : "بعدی ←";
      swapEl.classList.remove("intro-swap");
      void swapEl.offsetWidth;
      swapEl.classList.add("intro-swap");
    }
    next.addEventListener("click", function () {
      if (current < slides.length - 1) { current += 1; render(); } else finish();
    });
    card.querySelector("[data-intro-skip]").addEventListener("click", finish);
    render();
    next.focus();
  }

  function startFirstRun() { showIntro(mount); }
  startFirstRun();
})();