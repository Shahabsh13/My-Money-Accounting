/**
 * لایه ۲۳۵: پچ تضمین ریشه‌ای و نمایشی متون فارسی هنگام جابه‌جایی و باز کردن
 * HesabNo Text Root & Display Stability Script
 */
(function () {
  'use strict';

  // ۱. این لایه به تنظیمات کاربر دست نمی‌زند:
  //    فونت انتخابی (hesabno:fontFamily) و data-font را خود برنامه مدیریت می‌کند.
  function initRoot() {
    /* عمداً خالی: فونت/زبان/جهت تغییر نمی‌کنند */
  }

  // ۲. اصلاح نمایشی کارت‌های انتقال (جابه‌جایی وجه) و رفع شکستگی کلمات
  function stabilizeTransferCards() {
    var transferContainers = document.querySelectorAll('article [class*="overflow-x-auto"] > div');
    transferContainers.forEach(function (row) {
      if (!row) return;
      var text = row.textContent || '';
      if (text.indexOf('از:') !== -1 && text.indexOf('به:') !== -1) {
        if (row.getAttribute('data-hesabno-transfer-row') !== 'true') row.setAttribute('data-hesabno-transfer-row', 'true');
        if (row.style.whiteSpace !== 'nowrap') row.style.whiteSpace = 'nowrap';
        if (row.style.direction !== 'rtl') row.style.direction = 'rtl';
        if (row.style.flexWrap !== 'nowrap') row.style.flexWrap = 'nowrap';
        row.classList.remove('flex-wrap');
        row.classList.add('whitespace-nowrap');

        row.querySelectorAll('span.font-semibold').forEach(function (name) {
          if (name.style.whiteSpace !== 'nowrap') name.style.whiteSpace = 'nowrap';
          if (name.style.overflow !== 'hidden') name.style.overflow = 'hidden';
          if (name.style.textOverflow !== 'ellipsis') name.style.textOverflow = 'ellipsis';
          if (name.style.display !== 'inline-block') name.style.display = 'inline-block';
          if (name.style.maxWidth !== '140px') name.style.maxWidth = '140px';
          if (name.style.verticalAlign !== 'middle') name.style.verticalAlign = 'middle';
          if (name.style.wordBreak !== 'normal') name.style.wordBreak = 'normal';
          if (name.style.overflowWrap !== 'normal') name.style.overflowWrap = 'normal';
          if (name.style.letterSpacing !== 'normal') name.style.letterSpacing = 'normal';
          if (name.style.flexShrink !== '1') name.style.flexShrink = '1';
        });

        row.querySelectorAll('span:not(.font-semibold)').forEach(function (s) {
          if (s.style.letterSpacing !== 'normal') s.style.letterSpacing = 'normal';
          if (s.style.whiteSpace !== 'nowrap') s.style.whiteSpace = 'nowrap';
          if (s.style.flexShrink !== '0') s.style.flexShrink = '0';
        });
      }
    });
  }

  // ۳. محافظت از متون هنگام باز کردن کارت‌ها و جزئیات تراکنش
  function stabilizeOpenedCards() {
    var cards = document.querySelectorAll('article[id^="tx-card-"]');
    cards.forEach(function (card) {
      if (card.style.transform !== 'none') card.style.transform = 'none';

      // متن عنوان و شرح تراکنش هنگام باز شدن
      var descNode = card.querySelector('p.leading-tight');
      if (descNode) {
        if (descNode.style.overflowWrap !== 'break-word') descNode.style.overflowWrap = 'break-word';
        if (descNode.style.wordBreak !== 'normal') descNode.style.wordBreak = 'normal';
        if (descNode.style.whiteSpace !== 'normal') descNode.style.whiteSpace = 'normal';
        if (descNode.style.lineHeight !== '1.55') descNode.style.lineHeight = '1.55';
      }

      // شماره سند و پرانتزها و تاریخ
      var monoNumbers = card.querySelectorAll('span.font-mono, [data-hesabno-money-rtl="true"]');
      monoNumbers.forEach(function (num) {
        if (num.style.unicodeBidi !== 'isolate') num.style.unicodeBidi = 'isolate';
      });
    });
  }

  // ۴. جلوگیری از انیمیشن‌های لرزشی ۳ بعدی هنگام جابه‌جایی تب‌ها
  function stabilizeTabMotion() {
    var main = document.querySelector('main');
    if (main) {
      if (main.classList.contains('hesabno-tab-horizontal-in') ||
          main.classList.contains('hesabno-page-open-up') ||
          main.classList.contains('hesabno-full-page-side-open') ||
          main.classList.contains('hesabno-tab-shell')) {
        if (main.style.transform !== 'none') main.style.transform = 'none';
      }
    }
  }

  // ۵. هماهنگی با کیبورد مبلغ: فقط فیلدهایی که اسکریپت ۲۱۴ خودش «مبلغ» علامت زده
  //    inputmode=none می‌شوند. هیچ فیلدی readOnly نمی‌شود (قفل سراسری، تایپ در
  //    جستجو/تاریخ/نام را از کاربر می‌گرفت).
  function prepareMoneyInputs() {
    var inputs = document.querySelectorAll('[data-hesabno-amount-keyboard-field="true"]');
    inputs.forEach(function (input) {
      if (input.getAttribute('inputmode') !== 'none') input.setAttribute('inputmode', 'none');
    });
  }

  function runStabilizer() {
    initRoot();
    stabilizeTransferCards();
    stabilizeOpenedCards();
    stabilizeTabMotion();
    prepareMoneyInputs();
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(function () {
      queued = false;
      runStabilizer();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runStabilizer, { once: true });
  } else {
    runStabilizer();
  }

  if (document.body) {
    // فقط تغییرات ساختاری (childList) تماشا می‌شود و نه attribute/style؛ وگرنه
    // نوشتن‌های خودِ همین لایه، observer را دوباره صف می‌کرد و یک حلقه‌ی
    // هر-فریمی می‌ساخت (ریشه‌ی مصرف CPU و هنگ‌شدن تست‌ها).
    window.__hesabnoDom.watch(document.body, {
      childList: true,
      subtree: true
    }, schedule);
  }
})();
