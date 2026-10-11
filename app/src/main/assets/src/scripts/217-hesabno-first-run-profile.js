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
  mount();
})();
