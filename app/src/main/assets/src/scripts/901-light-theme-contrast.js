/* اصلاح کنتراست حالت روشن (data-theme="light")
 * برای هر عنصر متنی، رنگ متن و پس‌زمینهٔ واقعی را پیدا می‌کند و اگر کنتراست کمتر از 4.5 بود،
 * رنگ متن را به‌تدریج تیره می‌کند. متن‌های روی پس‌زمینهٔ تیره یا گرادیانی تغییر نمی‌کنند.
 * در حالت تیره هیچ کاری انجام نمی‌شود. */
(function () {
  var MARK = "data-hn-lc";
  var canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  var ctx = canvas.getContext("2d", { willReadFrequently: true });
  var cache = Object.create(null);

  // هر رنگ CSS را به [r,g,b,a] در sRGB تبدیل می‌کند
  function toRGBA(c) {
    if (cache[c]) return cache[c];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    var d = ctx.getImageData(0, 0, 1, 1).data;
    return (cache[c] = [d[0], d[1], d[2], d[3] / 255]);
  }
  function lum(r, g, b) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function contrast(a, b) {
    var l1 = lum(a[0], a[1], a[2]), l2 = lum(b[0], b[1], b[2]);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  // پس‌زمینهٔ مؤثر. null یعنی نامشخص (گرادیان یا تصویر) و باید نادیده گرفته شود
  function effectiveBg(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      var cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== "none") {
        // گرادیان: تیره‌ترین رنگ توقف را به‌عنوان بدترین حالت برای کنتراست در نظر می‌گیریم
        var toks = cs.backgroundImage.match(/(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}|oklch\([^)]*\))/g);
        if (!toks || !toks.length) return null;
        var darkest = null, dl = 2;
        toks.forEach(function (t) {
          var c = toRGBA(t);
          if (c[3] < 0.5) return;
          var l = lum(c[0], c[1], c[2]);
          if (l < dl) { dl = l; darkest = c; }
        });
        return darkest ? [darkest[0], darkest[1], darkest[2], 1] : null;
      }
      var bg = toRGBA(cs.backgroundColor);
      if (bg[3] >= 0.5) return bg;
      node = node.parentElement;
    }
    return [255, 255, 255, 1];
  }
  function hasOwnText(el) {
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && n.textContent.trim()) return true;
    }
    return false;
  }
  function darken(rgb, t) {
    var target = [15, 23, 42];
    return [0, 1, 2].map(function (i) { return Math.round(rgb[i] + (target[i] - rgb[i]) * t); });
  }
  // تغییرات این اسکریپت باید فوری باشند. اگر انتقال رنگ فعال باشد، مرورگر رنگ میانی را
  // ثبت می‌کند و اسکریپت با خواندن همان مقدار میانی، رنگ را دوباره عوض می‌کند (نوسان بین دو رنگ).
  // انتقال‌ها در کل یک اجرا با کلاس hn-lc-batch خاموش هستند (نه برای هر المان جدا)
  function withoutTransition(el, fn) { fn(); }
  // رنگ و شفافیت اصلی متن را می‌خواند، بدون اثر رنگ‌هایی که خود این اسکریپت قبلاً ثبت کرده.
  // اگر این کار نشود، اسکریپت رنگ تصحیح‌شدهٔ خودش را می‌خواند و همیشه نتیجهٔ متفاوت می‌گیرد.
  function originalStyle(el) {
    if ((el.hasAttribute(MARK) || el.hasAttribute("data-hn-lc-opaque")) && el.hasAttribute("data-hn-orig")) {
      var parts = el.getAttribute("data-hn-orig").split("|");
      return { color: parts[0], opacity: parseFloat(parts[1]) || 1 };
    }
    var cs = getComputedStyle(el);
    return { color: cs.color, opacity: parseFloat(cs.opacity) };
  }
  function clearMark(el) {
    withoutTransition(el, function () {
      el.style.removeProperty("--hn-lc-color");
    });
    el.removeAttribute(MARK);
    el.removeAttribute("data-hn-lc-opaque");
    el.removeAttribute("data-hn-orig");
  }

  var BATCH = "hn-lc-batch";
  function run() {
    var root = document.documentElement;
    if (root.getAttribute("data-theme") !== "light") { document.querySelectorAll("[" + MARK + "]").forEach(clearMark); return; }
    root.classList.add(BATCH);
    try { runInner(root); } finally {
      // یک بار چیدمان برای همهٔ تغییرات، سپس برگرداندن انتقال‌ها
      void root.offsetWidth;
      root.classList.remove(BATCH);
    }
  }
  function runInner(root) {
    // در لحظهٔ عوض شدن تم هیچ رنگی ثبت نشود؛ بررسی نهایی بعد از پایان انتقال انجام می‌شود
    if (root.classList.contains("hn-theme-instant")) return;
    if (root.getAttribute("data-theme") !== "light") {
      document.querySelectorAll("[" + MARK + "]").forEach(clearMark);
      return;
    }
    var els = document.querySelectorAll("body *");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.closest("[data-hn-dialog]")) continue;
      // These money colors are contrast-tested at their explicit 14px size. Do not darken them again.
      if (el.closest('[data-hesabno-transaction-amount][data-hesabno-amount-tone="income"], [data-hesabno-transaction-amount][data-hesabno-amount-tone="expense"]')) {
        if (el.hasAttribute(MARK) || el.hasAttribute("data-hn-lc-opaque")) clearMark(el);
        continue;
      }
      if (el.closest("[data-hesabno-simple-report-native]")) continue;
      if (el.closest("[data-hesabno-metadata-canonical], [data-hesabno-tx-metadata-row], [data-hesabno-footnote-kind], [data-hesabno-compound-badge], [data-hesabno-tx-status-badge], [data-hesabno-check-correction-link], [data-hesabno-returned-effect], [data-hesabno-returned-correction], [data-hesabno-check-replacement-link], .hesabno-tx-project-chip, .hesabno-tx-family-chip, .hesabno-canonical-meta-chip, .hesabno-footnote-action-chip, .hesabno-day-balance")) {
        if (el.hasAttribute(MARK) || el.hasAttribute("data-hn-lc-opaque")) clearMark(el);
        continue;
      }
      if (!hasOwnText(el)) {
        if (el.hasAttribute(MARK)) clearMark(el);
        continue;
      }
      var orig = originalStyle(el);
      var fg = toRGBA(orig.color);
      var bg = effectiveBg(el);
      var op = orig.opacity;
      var fix = false;
      if (bg && lum(bg[0], bg[1], bg[2]) > 0.35) {
        var fs = parseFloat(getComputedStyle(el).fontSize) || 16;
        var need = fs < 14 ? 7 : 4.5; // متن ریز، کنتراست بیشتری لازم دارد
        if (contrast(fg, bg) < need) {
          var t = 0.05, out = fg, guard = 0;
          while (guard++ < 40) {
            var cand = darken(fg, t);
            out = [cand[0], cand[1], cand[2], 1];
            if (contrast(out, bg) >= need || t >= 1) break;
            t += 0.05;
          }
          var nextColor = "rgb(" + out[0] + "," + out[1] + "," + out[2] + ")";
          if (el.style.getPropertyValue("--hn-lc-color").replace(/\s+/g, "") !== nextColor.replace(/\s+/g, "")) {
            withoutTransition(el, function () { el.style.setProperty("--hn-lc-color", nextColor); });
          }
          if (!el.hasAttribute(MARK)) el.setAttribute(MARK, "1");
          fix = true;
        }
        if (op < 0.9) {
          if (!el.hasAttribute("data-hn-lc-opaque")) {
            withoutTransition(el, function () { el.setAttribute("data-hn-lc-opaque", "1"); });
          }
          fix = true;
        }
      }
      if (fix) {
        if (!el.hasAttribute("data-hn-orig")) el.setAttribute("data-hn-orig", orig.color + "|" + orig.opacity);
      }
      else if (el.hasAttribute(MARK) || el.hasAttribute("data-hn-lc-opaque")) clearMark(el);
    }
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; try { run(); } catch (e) { try { console.warn("[hesabno-lc]", e && e.message); } catch (_) {} } });
  }
  // هنگام عوض شدن تم، انتقال رنگ‌ها موقتاً غیرفعال می‌شود تا رنگ‌های نهایی خوانده شوند.
  // خواندن رنگ میانیِ انتقال باعث ثبت رنگ اشتباه می‌شد.
  var INSTANT = "hn-theme-instant";
  var TRANSITION_END_MS = 500;
  var instantTimer = null, finalTimer = null;
  function themeChanged() {
    var root = document.documentElement;
    root.classList.add(INSTANT);
    clearTimeout(instantTimer);
    clearTimeout(finalTimer);
    schedule();
    instantTimer = setTimeout(function () {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { root.classList.remove(INSTANT); });
      });
    }, 60);
    // بعد از پایان انتقال، یک بار با رنگ‌های نهایی بررسی می‌شود
    finalTimer = setTimeout(schedule, TRANSITION_END_MS);
  }
  function isOwnToggle(r) {
    if (r.attributeName !== "class" || r.oldValue == null) return false;
    var strip = function (v) { return v.replace(INSTANT, "").replace("hn-lc-batch", "").replace(/\s+/g, " ").trim(); };
    var cur = strip(document.documentElement.getAttribute("class") || "");
    var old = strip(r.oldValue);
    return cur === old;
  }
  window.__hesabnoDom.watch(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeOldValue: true,
    attributeFilter: ["data-theme", "class"]
  }, function (records) {
    var themeTouched = false, relevant = false;
    records.forEach(function (r) {
      if (r.type === "attributes" && r.attributeName === "data-theme") themeTouched = true;
      if (r.type === "attributes" && r.attributeName === "class" && isOwnToggle(r)) return;
      relevant = true;
    });
    if (themeTouched) themeChanged();
    else if (relevant) schedule();
  });
  /* قواعد hn-theme-instant، hn-lc-batch و [data-hn-lc] در بستهٔ ۲۳۵ قرار دارد. */
  // وقتی انیمیشن یا انتقال یک المان تمام می‌شود، رنگ پس‌زمینه نهایی شده؛ بررسی دوباره لازم است
  document.addEventListener("transitionend", schedule, true);
  document.addEventListener("animationend", schedule, true);
  window.addEventListener("load", schedule);
  schedule();
})();
