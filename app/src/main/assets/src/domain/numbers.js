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
   * کبیسه‌بودن سال جلالی — دقیقاً همان الگوریتم هسته (f9) با جدول چرخه‌های ۳۳ساله.
   * ۱۴۰۳ کبیسه است و اسفندش ۳۰ روز دارد؛ قاعده‌ی سادهٔ «سال٪۳۳ در {…}» در ۱۴۰۷/۱۴۰۸
   * با الگوریتم درست اختلاف دارد، پس همان جدول استفاده می‌شود.
   */
  var LEAP_BOUNDS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  var LEAP_REMAINDERS = [1, 5, 9, 13, 17, 22, 26, 30];

  function isLeapYear(year) {
    var first = LEAP_BOUNDS[0];
    if (year < first || year >= LEAP_BOUNDS[LEAP_BOUNDS.length - 1]) {
      return LEAP_REMAINDERS.indexOf(((year % 33) + 33) % 33) !== -1;
    }
    /*
     * همان حلقه‌ی هسته: طول چرخه (cycle) از مرزِ **بعدی** گرفته می‌شود، نه از مرزِ قبلی.
     * اگر این را به «current - previous» تغییر دهیم، ۱۴۰۷/۱۴۰۸ اشتباه می‌شوند.
     */
    var current = first;
    var cycle = 0;
    var index = 1;
    for (; index < LEAP_BOUNDS.length; index += 1) {
      var candidate = LEAP_BOUNDS[index];
      cycle = candidate - current;
      if (year < candidate) break;
      current = candidate;
    }
    var offset = year - current;
    if (cycle - offset < 6) offset = offset - cycle + Math.floor((cycle + 4) / 33) * 33;
    var remainder = Math.floor((offset + 1) % 33 - 1);
    if (remainder === -1) remainder = 4;
    return remainder % 4 === 0 && remainder !== 0;
  }

  /* تعداد روزهای ماه جلالی — همان rn هسته */
  function daysInMonth(year, month) {
    if (month >= 1 && month <= 6) return 31;
    if ((month >= 7 && month <= 11) || isLeapYear(year)) return 30;
    return 29;
  }

  /*
   * جمع/تفریق ماه روی تاریخ جلالی «YYYY/MM/DD» با همان قاعده‌ی روز-پایان-ماه هسته (lr):
   * روز به تعداد روزهای ماه مقصد محدود می‌شود، با احتساب کبیسه (اسفند ۱۴۰۳ = ۳۰ روز).
   * ورودی نامعتبر دست‌نخورده برمی‌گردد.
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
    var limit = daysInMonth(nextYear, nextMonth);
    if (nextDay > limit) nextDay = limit;
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
    isLeapYear: isLeapYear,
    daysInMonth: daysInMonth,
  };
});
