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
      position: "fixed", inset: "0", zIndex: "2147483646",
      background: "radial-gradient(ellipse at 18% 12%,rgba(16,185,129,.20),transparent 38%),radial-gradient(ellipse at 88% 86%,rgba(45,212,191,.12),transparent 34%),linear-gradient(145deg,#071b1b 0%,#0b2527 52%,#101a2b 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
      fontFamily: "Vazirmatn, system-ui, sans-serif", direction: "rtl", color: "#f1f5f9", overflowY: "auto", boxSizing: "border-box"
    };
    var overlay = document.createElement("div");
    overlay.id = "hesabno-first-run";
    Object.keys(css).forEach(function (k) { overlay.style[k] = css[k]; });

    var card = document.createElement("form");
    card.setAttribute("novalidate", "novalidate");
    card.style.cssText = "position:relative;isolation:isolate;overflow:hidden;width:100%;max-width:400px;box-sizing:border-box;background:linear-gradient(155deg,rgba(20,43,45,.97),rgba(13,27,39,.98));border:1px solid rgba(110,231,183,.22);border-radius:28px;padding:clamp(20px,5vw,28px);box-shadow:0 28px 80px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.05)";
    var glow = document.createElement("div");
    glow.setAttribute("aria-hidden", "true");
    glow.style.cssText = "position:absolute;z-index:-1;left:-54px;top:-66px;width:170px;height:170px;border-radius:50%;background:rgba(16,185,129,.11);filter:blur(10px);pointer-events:none";
    card.appendChild(glow);

    var brand = document.createElement("div");
    brand.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:22px";
    var mark = document.createElement("div");
    mark.style.cssText = "width:48px;height:48px;flex:0 0 48px;display:grid;place-items:center;border-radius:17px;background:linear-gradient(145deg,#1a6658,#123e3b);border:1px solid rgba(110,231,183,.32);box-shadow:0 8px 24px rgba(16,185,129,.14)";
    mark.innerHTML = '<svg viewBox="0 0 48 48" width="32" height="32" fill="none" aria-hidden="true"><rect x="8" y="7" width="25" height="34" rx="6" stroke="#d1fae5" stroke-width="2" transform="rotate(-7 8 7)"/><path d="M15 18h12M15 23h8M16 31v-4m6 4v-8m6 8v-12" stroke="#6ee7b7" stroke-width="2.6" stroke-linecap="round"/><circle cx="34" cy="31" r="10" fill="#34d399" stroke="#0d3833" stroke-width="2"/><path d="m29.5 31 3 3 6-6.5" stroke="#073b31" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var brandText = document.createElement("div");
    brandText.style.cssText = "min-width:0";
    var brandName = document.createElement("div");
    brandName.textContent = "MY MONEY";
    brandName.style.cssText = "font-size:11px;font-weight:900;letter-spacing:2px;color:#6ee7b7";
    var brandCaption = document.createElement("div");
    brandCaption.textContent = "مدیریت مالی، ساده‌تر";
    brandCaption.style.cssText = "font-size:12px;color:#a7c5c1;margin-top:3px";
    brandText.appendChild(brandName); brandText.appendChild(brandCaption); brand.appendChild(mark); brand.appendChild(brandText);

    var step = document.createElement("div");
    step.textContent = "شروع کار  ·  مرحله ۱ از ۱";
    step.style.cssText = "display:inline-flex;align-items:center;margin:0 0 10px;padding:6px 10px;border:1px solid rgba(110,231,183,.18);border-radius:999px;background:rgba(16,185,129,.08);font-size:11px;font-weight:700;color:#86efc6";
    var title = document.createElement("h1");
    title.textContent = "به حساب‌وکتابت خوش آمدی";
    title.style.cssText = "margin:0 0 8px;font-size:clamp(20px,5.3vw,24px);line-height:1.65;font-weight:900;letter-spacing:-.4px;color:#f0fdfa";
    var sub = document.createElement("p");
    sub.textContent = "اول خودت را معرفی کن؛ بعد از این، برنامه با نام خودت از تو استقبال می‌کند.";
    sub.style.cssText = "margin:0 0 22px;font-size:13px;line-height:1.95;color:#a8c1c0";

    function field(id, label, placeholder, required, type) {
      var wrap = document.createElement("div");
      wrap.style.cssText = "margin-bottom:13px";
      var lb = document.createElement("label");
      lb.htmlFor = id;
      lb.textContent = label + (required ? " *" : " (اختیاری)");
      lb.style.cssText = "display:block;margin-bottom:7px;font-size:12.5px;font-weight:750;color:#d5e9e5";
      var input = document.createElement("input");
      input.id = id; input.name = id; input.type = type || "text";
      input.placeholder = placeholder; input.autocomplete = id.indexOf("mobile") >= 0 ? "tel" : "given-name";
      input.style.cssText = "width:100%;box-sizing:border-box;padding:14px 15px;border-radius:15px;border:1px solid #345052;background:rgba(5,20,27,.64);color:#f0fdfa;font-size:15px;outline:none;font-family:inherit;transition:border-color .18s,box-shadow .18s,background .18s";
      input.addEventListener("focus", function () { input.style.borderColor = "#34d399"; input.style.boxShadow = "0 0 0 3px rgba(52,211,153,.12)"; input.style.background = "rgba(5,20,27,.92)"; });
      input.addEventListener("blur", function () { input.style.borderColor = "#345052"; input.style.boxShadow = "none"; input.style.background = "rgba(5,20,27,.64)"; });
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
    submit.style.cssText = "display:flex;align-items:center;justify-content:center;gap:10px;width:100%;margin-top:8px;padding:15px;border:1px solid rgba(167,243,208,.38);border-radius:16px;background:linear-gradient(100deg,#6ee7b7 0%,#34d399 55%,#2dd4bf 100%);color:#073b31;font-size:15px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 10px 25px rgba(16,185,129,.17);transition:transform .15s,filter .15s";
    submit.innerHTML = 'ورود به برنامه <span aria-hidden="true" style="font-size:20px;line-height:1">←</span>';
    submit.addEventListener("pointerdown", function () { submit.style.transform = "scale(.985)"; });
    submit.addEventListener("pointerup", function () { submit.style.transform = "scale(1)"; });
    submit.addEventListener("pointerleave", function () { submit.style.transform = "scale(1)"; });
    var privacy = document.createElement("p");
    privacy.textContent = "اطلاعاتت فقط برای شخصی‌سازی تجربه‌ی داخل برنامه استفاده می‌شود.";
    privacy.style.cssText = "display:flex;align-items:flex-start;gap:7px;margin:15px 2px 0;font-size:10.5px;line-height:1.8;color:#87a6a3";
    var lock = document.createElement("span");
    lock.innerHTML = '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true"><rect x="4" y="8" width="12" height="9" rx="2" stroke="#6ee7b7" stroke-width="1.5"/><path d="M7 8V6a3 3 0 0 1 6 0v2" stroke="#6ee7b7" stroke-width="1.5" stroke-linecap="round"/></svg>';
    lock.style.cssText = "display:inline-flex;flex:0 0 auto;margin-top:2px";
    privacy.appendChild(lock); privacy.appendChild(document.createTextNode(privacy.textContent));

    card.appendChild(brand); card.appendChild(step); card.appendChild(title); card.appendChild(sub);
    card.appendChild(first.wrap); card.appendChild(last.wrap); card.appendChild(mobile.wrap);
    card.appendChild(submit); card.appendChild(privacy);
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
        t: "دسترسی راحت",
        b: "موجودی کل، درآمد و هزینهی ماهانه، نمودار سرفصل‌ها و میانبرهای سریع را در یک نگاه ببین.",
        svg: '<svg viewBox="0 0 200 160" fill="none"><defs><linearGradient id="t1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#134e4a"/><stop offset="1" stop-color="#0f2a2e"/></linearGradient></defs><rect x="35" y="8" width="130" height="134" rx="26" fill="url(#t1)" stroke="#2b5b58" stroke-width="1.5"/><rect x="52" y="26" width="26" height="18" rx="7" fill="#0f2127" stroke="#244047"/><rect x="82" y="26" width="26" height="18" rx="7" fill="#0f2127" stroke="#244047"/><rect x="112" y="26" width="26" height="18" rx="7" fill="#0f2127" stroke="#244047"/><path d="M52 116 L78 94 L100 104 L124 76 L148 86" stroke="#6ee7b7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="124" cy="76" r="4" fill="#34d399"/><path d="M50 120 h100" stroke="#2b5b58" stroke-width="2" stroke-linecap="round"/></svg>'
      },
      {
        t: "ثبت تراکنش به راحتی",
        b: "دریافت، پرداخت و انتقال وجه را با مبلغ، سرفصل، حساب و شرح ثبت کن؛ سندها را دنبال کن.",
        svg: '<svg viewBox="0 0 200 160" fill="none"><defs><linearGradient id="t2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#134e4a"/><stop offset="1" stop-color="#0f2a2e"/></linearGradient></defs><rect x="35" y="8" width="130" height="134" rx="26" fill="url(#t2)" stroke="#2b5b58" stroke-width="1.5"/><circle cx="72" cy="62" r="23" fill="#0d2527" stroke="#10b981" stroke-width="2"/><path d="M72 74 V52 M64 60 l8 -8 8 8" stroke="#6ee7b7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="128" cy="62" r="23" fill="#241b0c" stroke="#f59e0b" stroke-width="2"/><path d="M128 50 V74 M120 66 l8 8 8 -8" stroke="#fcd34d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><rect x="80" y="96" width="40" height="32" rx="7" fill="#e8f4ef"/><rect x="87" y="103" width="26" height="3" rx="1.5" fill="#0e6b58" opacity=".5"/><rect x="87" y="110" width="18" height="3" rx="1.5" fill="#0e6b58" opacity=".35"/><path d="M80 128 l5 -5 5 5 5 -5 5 5 5 -5 5 5 5 -5 5 5 5 -5 5 5" stroke="#0e6b58" stroke-width="2" fill="none"/></svg>'
      },
      {
        t: "تحلیل راحت",
        b: "مقایسهی ماهانه، توزیع هزینه‌ها و درآمدها و میانگین روزانه را ببین.",
        svg: '<svg viewBox="0 0 200 160" fill="none"><defs><linearGradient id="t3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#134e4a"/><stop offset="1" stop-color="#0f2a2e"/></linearGradient><linearGradient id="b3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#0d9488"/></linearGradient></defs><rect x="35" y="8" width="130" height="134" rx="26" fill="url(#t3)" stroke="#2b5b58" stroke-width="1.5"/><rect x="56" y="84" width="16" height="36" rx="5" fill="url(#b3)" opacity=".55"/><rect x="80" y="68" width="16" height="52" rx="5" fill="url(#b3)" opacity=".8"/><rect x="104" y="90" width="16" height="30" rx="5" fill="url(#b3)"/><rect x="128" y="58" width="16" height="62" rx="5" fill="#fbbf24"/><path d="M62 78 L86 62 L110 72 L134 50" stroke="#a7f3d0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="134" cy="50" r="3.5" fill="#6ee7b7"/><path d="M52 122 h100" stroke="#2b5b58" stroke-width="2" stroke-linecap="round"/></svg>'
      },
      {
        t: "مدیریت آسان",
        b: "سرفصل‌ها، بانک‌ها، چک‌ها، وام، اقساط و بودجه را یک‌جا کنترل کن.",
        svg: '<svg viewBox="0 0 200 160" fill="none"><defs><linearGradient id="t4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#134e4a"/><stop offset="1" stop-color="#0f2a2e"/></linearGradient></defs><rect x="35" y="8" width="130" height="134" rx="26" fill="url(#t4)" stroke="#2b5b58" stroke-width="1.5"/><rect x="56" y="28" width="38" height="38" rx="12" fill="#0f2127" stroke="#244047"/><rect x="106" y="28" width="38" height="38" rx="12" fill="#0f2127" stroke="#244047"/><rect x="56" y="78" width="38" height="38" rx="12" fill="#0f2127" stroke="#244047"/><rect x="106" y="78" width="38" height="38" rx="12" fill="#0f2127" stroke="#244047"/><circle cx="75" cy="47" r="7" fill="none" stroke="#2dd4bf" stroke-width="2.5"/><path d="M125 42 v10 M120 47 h10" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/><rect x="70" y="92" width="10" height="10" rx="3" fill="none" stroke="#fb7185" stroke-width="2.5"/><path d="M118 90 l8 8 M126 90 l-8 8" stroke="#6ee7b7" stroke-width="2.5" stroke-linecap="round"/></svg>'
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
      "#hesabno-intro-tour .intro-art{position:relative;overflow:hidden;height:250px;display:flex;align-items:center;justify-content:center;margin:8px 0 20px;border:1px solid #294349;border-radius:20px;background:linear-gradient(160deg,#122a30,#0b171c);padding:8px}" +
      "#hesabno-intro-tour .intro-art::after{content:'';position:absolute;z-index:5;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.07) 50%,transparent 65%);transform:translateX(-120%);animation:introSheen 5.4s ease-in-out infinite}" +
      "@keyframes introSheen{0%{transform:translateX(-120%)}45%,100%{transform:translateX(120%)}}" +
      "#hesabno-intro-tour .intro-art svg{position:relative;z-index:2;width:100%;height:100%;animation:mockIn .45s cubic-bezier(.22,.75,.25,1) both}" +
      "@keyframes mockIn{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}" +
      "#hesabno-intro-tour .intro-kicker{color:#5eead4;font-size:11px;font-weight:800}" +
      "#hesabno-intro-tour .intro-copy{animation:introCopyIn .42s cubic-bezier(.22,.75,.25,1) both}" +
      "@keyframes introCopyIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
      "#hesabno-intro-tour h2{margin:8px 0 0;color:#f4fbfa;font-size:22px}" +
      "#hesabno-intro-tour p{margin:6px 0 0;color:#a6bfbe;font-size:13px;line-height:1.9}" +
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
      "@media(max-height:620px){#hesabno-intro-tour .intro-art{height:190px;margin:6px 0 12px}#hesabno-intro-tour .intro-card{padding:16px}}" +
      "@media(prefers-reduced-motion:reduce){#hesabno-intro-tour *,#hesabno-intro-tour *::before,#hesabno-intro-tour *::after{animation:none!important;transition:none!important}}";
    document.head.appendChild(style);
    var card = document.createElement("section"); card.className = "intro-card"; card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true"); card.setAttribute("aria-label", "معرفی برنامه");
    card.innerHTML = '<div style="display:flex;align-items:center"><strong style="letter-spacing:.08em;font-size:11px">MY MONEY</strong></div><div class="intro-art" aria-hidden="true" data-intro-art></div><div class="intro-copy" data-intro-copy><div class="intro-kicker" data-intro-step></div><h2 data-intro-title></h2><p data-intro-body aria-live="polite"></p></div><div class="intro-dots" data-intro-dots style="margin-top:18px"></div><div class="intro-actions"><button type="button" class="intro-skip" data-intro-skip>رد کردن</button><button type="button" class="intro-next" data-intro-next>بعدی ←</button></div>';
    overlay.appendChild(style); overlay.appendChild(card); document.body.appendChild(overlay);
    var step = card.querySelector('[data-intro-step]'), title = card.querySelector('[data-intro-title]'), body = card.querySelector('[data-intro-body]'), dots = card.querySelector('[data-intro-dots]'), next = card.querySelector('[data-intro-next]'), copy = card.querySelector('[data-intro-copy]'), art = card.querySelector('[data-intro-art]');
    function finish() { store(key, "1"); overlay.remove(); style.remove(); done(); }
    function render() {
      step.textContent = faDigits(current + 1) + " از " + faDigits(slides.length);
      title.textContent = slides[current].t;
      body.textContent = slides[current].b;
      art.innerHTML = slides[current].svg;
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
