/*
 * لایه‌ی دامنه — اعداد، قالب‌بندی پول و ماه جلالی (مرحله ۵، تصمیم R5)
 *
 * چرا این فایل وجود دارد؟ قواعد عددی/پولی برنامه داخل باندل مینیفای‌شده‌ی 067 است و همان‌جا
 * می‌ماند (R5: بازنویسی باندل اصلی ممنوع). این ماژول یک پیاده‌سازی خالص و خوانا از همان قواعد
 * است که «هم‌رفتاری‌اش با هسته» با آزمون سایه‌ای اثبات می‌شود (tests/domain-shadow.test.cjs).
 * تا وقتی مرحله‌ی گزارش‌ها (۷) آن را مصرف نکند، در index.html بارگذاری نمی‌شود؛ بنابراین
 * صفر بایت و صفر ریسک برای اجرای فعلی برنامه دارد.
 *
 * وابستگی: هیچ (نه DOM، نه localStorage). تنظیمات (جداکننده/ارز) به‌صورت آرگومان می‌آیند.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.HesabnoDomain = root.HesabnoDomain || {}).numbers = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  "use strict";

  var PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

  /* هر رقم لاتین → رقم فارسی؛ نویسه‌های دیگر دست‌نخورده (هم‌رفتار با te در هسته) */
  function toPersianDigits(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/\d/g, function (digit) { return PERSIAN_DIGITS[parseInt(digit, 10)]; });
  }

  /* ارقام فارسی → لاتین و حذف جداکننده‌های هزارگان (هم‌رفتار با St)
     توجه: فقط U+06F0..U+06F9 تبدیل می‌شود و «،» فارسی حذف نمی‌شود — همان رفتار هسته؛
     این یک محدودیت شناخته‌شده است، نه بهبود بی‌اجازه. */
  function normalizeDigits(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/[۰-۹]/g, function (digit) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)); })
      .replace(/[٬,]/g, "");
  }

  /* جداکننده‌ی هزارگان بر اساس تنظیمات کاربر (هم‌رفتار با uk) */
  function separatorFor(format) {
    if (format === "slash") return "/";
    if (format === "space") return " ";
    if (format === "standard") return ",";
    return "،";
  }

  /* قالب‌بندی مبلغ با گرد کردن نیم‌به‌بالا و علامت منفی (هم‌رفتار با F0) */
  function formatAmount(value, format) {
    if (isNaN(value) || value === null || value === undefined) return "۰";
    var negative = value < 0;
    var rounded = Math.round(Math.abs(value));
    var separator = separatorFor(format);
    var grouped = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    return negative ? "-" + toPersianDigits(grouped) : toPersianDigits(grouped);
  }

  /* برچسب ارز (هم‌رفتار با Kr) */
  function currencyLabel(currency) {
    return (currency || "toman") === "toman" ? "تومان" : "ریال";
  }

  /* مبلغ + برچسب ارز (هم‌رفتار با mg) */
  function formatMoney(value, currency, format) {
    return formatAmount(value, format) + " " + currencyLabel(currency);
  }

  /* ورودی کاربر → نمایش گروه‌بندی‌شده؛ منفی و خالی رد می‌شود (هم‌رفتار با Ot) */
  function parseAmountInput(raw, format) {
    if (raw === null || raw === undefined) return "";
    var normalized = normalizeDigits(raw);
    if (/[-−]/.test(normalized)) return "";
    var digits = normalized.replace(/\D/g, "");
    if (!digits) return "";
    var grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, separatorFor(format));
    return toPersianDigits(grouped);
  }

  /*
   * جمع/تفریق ماه روی تاریخ جلالی «YYYY/MM/DD» با همان قاعده‌ی روز-پایان-ماه هسته (lr):
   * ماه‌های ۱–۶ سی روز، ۷–۱۱ سی روز، ۱۲ بیست‌ونه روز؛ روز ۳۱ در نیمه‌ی دوم به ۳۰ و در
   * اسفند به ۲۹ محدود می‌شود. ورودی نامعتبر دست‌نخورده برمی‌گردد.
   */
  function addMonths(jalaliDate, months) {
    if (!jalaliDate) return "";
    var parts = normalizeDigits(jalaliDate).replace(/-/g, "/").split("/");
    if (parts.length < 3) return jalaliDate;
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return jalaliDate;
    var total = year * 12 + (month - 1) + months;
    var nextYear = Math.floor(total / 12);
    var nextMonth = (total % 12) + 1;
    var nextDay = day;
    if (nextMonth > 6 && nextDay === 31) nextDay = 30;
    if (nextMonth === 12 && nextDay > 29) nextDay = 29;
    return nextYear + "/" + String(nextMonth).padStart(2, "0") + "/" + String(nextDay).padStart(2, "0");
  }

  return {
    toPersianDigits: toPersianDigits,
    normalizeDigits: normalizeDigits,
    separatorFor: separatorFor,
    formatAmount: formatAmount,
    currencyLabel: currencyLabel,
    formatMoney: formatMoney,
    parseAmountInput: parseAmountInput,
    addMonths: addMonths,
  };
});
