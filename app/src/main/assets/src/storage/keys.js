/*
 * رجیستری کلیدهای ذخیره‌سازی و نام رویدادها (مرحله ۶.۱)
 *
 * چرا؟ پیش از این هیچ فهرست واحدی از کلیدها وجود نداشت: هر اسکریپت خودش رشته‌ی «hesabno:…» را
 * می‌نوشت. پیامدها: (۱) دو مسیر پشتیبان‌گیری، دو فهرست متفاوت داشتند؛ (۲) کلید تازه می‌توانست
 * بدون پشتیبان/پاک‌سازی اضافه شود؛ (۳) بعضی رشته‌های «hesabno:» در واقع **نام رویداد**اند، نه
 * کلید ذخیره‌سازی، و با هم اشتباه گرفته می‌شدند.
 *
 * این فایل مرجع واحد است. خودش داده‌ی خالص است (بدون DOM/storage) و در index.html بارگذاری
 * نمی‌شود؛ فقط آزمون‌ها و ابزارها آن را می‌خوانند. آزمون tests/storage-keys.test.cjs تضمین می‌کند
 * که هر رشته‌ی «hesabno:» در کد، دقیقاً یکی از این مدخل‌ها باشد.
 *
 * میدان‌های هر مدخل:
 *   key      نام دقیق کلید یا رویداد
 *   backend  'local' | 'session' | 'event'
 *   type     'json' | 'raw'            (برای رویدادها null)
 *   scope    'data' | 'settings' | 'resume' | 'internal'
 *   backup   آیا در فهرست پشتیبان‌گیری «ریست کامل» (۱۰۸) هست؟
 *   owner    اسکریپتی که عمدتاً آن را می‌نویسد
 *   note     توضیح کوتاه فارسی (اختیاری)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.HesabnoStorage = root.HesabnoStorage || {}).keys = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  "use strict";

  var AVAILABLE = [
    /* ── داده‌ی کاربر (backup = در فهرست پشتیبان ریست کامل) ── */
    { key: "hesabno:accounts", backend: "local", type: "json", scope: "data", backup: true, owner: "004", note: "نسخه‌ی قدیمی حساب‌ها؛ ۱۰۸ هم می‌نویسد" },
    { key: "hesabno:accounts_v5", backend: "local", type: "json", scope: "data", backup: true, owner: "000", note: "منبع اصلی حساب‌ها" },
    { key: "hesabno:active_fiscal_year_id", backend: "local", type: "raw", scope: "data", backup: true, owner: "059", note: "شناسه‌ی سال مالی فعال (رشته‌ی خام)" },
    { key: "hesabno:budgets", backend: "local", type: "json", scope: "data", backup: true, owner: "000" },
    { key: "hesabno:check_settlement_dates", backend: "local", type: "json", scope: "data", backup: true, owner: "142", note: "نقشه‌ی تاریخ تسویه‌ی چک؛ از مرحله ۸ در پشتیبان ریست هم هست" },
    { key: "hesabno:checks", backend: "local", type: "json", scope: "data", backup: true, owner: "000" },
    { key: "hesabno:exported_files", backend: "local", type: "json", scope: "data", backup: true, owner: "067" },
    { key: "hesabno:family_members", backend: "local", type: "json", scope: "data", backup: true, owner: "067", note: "کلید قدیمی اعضای خانواده" },
    { key: "hesabno:familyMemberMeta", backend: "local", type: "json", scope: "data", backup: true, owner: "077" },
    { key: "hesabno:familyMembers", backend: "local", type: "json", scope: "data", backup: true, owner: "077" },
    { key: "hesabno:fiscal_years", backend: "local", type: "json", scope: "data", backup: true, owner: "059" },
    { key: "hesabno:homeWidgets", backend: "local", type: "json", scope: "data", backup: true, owner: "000b", note: "چیدمان ویجت‌ها (شیء)" },
    { key: "hesabno:installments", backend: "local", type: "json", scope: "data", backup: true, owner: "000" },
    { key: "hesabno:loans", backend: "local", type: "json", scope: "data", backup: true, owner: "000" },
    { key: "hesabno:payambank:inbox", backend: "local", type: "json", scope: "data", backup: true, owner: "009" },
    { key: "hesabno:projectMeta", backend: "local", type: "json", scope: "data", backup: true, owner: "077" },
    { key: "hesabno:projects", backend: "local", type: "json", scope: "data", backup: true, owner: "077" },
    { key: "hesabno:recurring_rules", backend: "local", type: "json", scope: "data", backup: true, owner: "000" },
    { key: "hesabno:shortcuts", backend: "local", type: "json", scope: "data", backup: true, owner: "065" },
    { key: "hesabno:transactions", backend: "local", type: "json", scope: "data", backup: true, owner: "067", note: "بزرگ‌ترین کلید؛ نوشتنش پرتکرار است" },
    { key: "hesabno:user_profile", backend: "local", type: "json", scope: "data", backup: true, owner: "217" },

    /* ── تنظیمات ── */
    { key: "hesabno:always_show_more_tx_options", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:bankStatementSummaryExpanded", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:biometric", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:calendar", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:checkAlertDays", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:currency", backend: "local", type: "raw", scope: "settings", backup: false, owner: "010", note: "rial | toman" },
    { key: "hesabno:dashboardPeriod", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:first_run_intro_done", backend: "local", type: "raw", scope: "settings", backup: false, owner: "217" },
    { key: "hesabno:first_run_profile_done", backend: "local", type: "raw", scope: "settings", backup: false, owner: "217" },
    { key: "hesabno:fontFamily", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:fontSize", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:haptic", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:includeCashInDashboard", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:lang", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:lock", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:number_format", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067", note: "نام قدیمی تنظیم قالب عدد؛ فقط خوانده می‌شود" },
    { key: "hesabno:numFormat", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067", note: "نام فعلی تنظیم قالب عدد" },
    { key: "hesabno:payambank:custom_patterns", backend: "local", type: "json", scope: "settings", backup: true, owner: "067" },
    { key: "hesabno:permissions", backend: "local", type: "json", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:pin", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:reminder", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:reminderTime", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:reportsMode", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:reports_dateFilter", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:simpleReports_activeTab", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:simpleReports_breakdownView", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:simpleReports_chartMode", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:simpleReports_currentDateStr", backend: "local", type: "raw", scope: "settings", backup: false, owner: "142" },
    { key: "hesabno:simpleReports_customRange", backend: "local", type: "json", scope: "settings", backup: false, owner: "067", note: "شیء {start, end}" },
    { key: "hesabno:simpleReports_month", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:simpleReports_periodType", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:simpleReports_year", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:sms", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067" },
    { key: "hesabno:theme", backend: "local", type: "raw", scope: "settings", backup: false, owner: "067", note: "light | dark" },

    /* ── داخلی (نشانگر، پشتیبان موقت، وضعیت ابزار) ── */
    { key: "hesabno:accounts_backup_old", backend: "local", type: "json", scope: "internal", backup: false, owner: "004", note: "پشتیبان موقت انتقال کلید حساب" },
    { key: "hesabno:check-system-accounts-v1", backend: "local", type: "raw", scope: "internal", backup: false, owner: "000b", note: "«done» پس از ایجاد حساب‌های سیستمی" },
    { key: "hesabno:default_accounts_v2", backend: "local", type: "json", scope: "internal", backup: false, owner: "000", note: "نشانگر کاشت حساب‌های پیش‌فرض" },
    { key: "hesabno:last_backup_date", backend: "local", type: "raw", scope: "internal", backup: true, owner: "067" },
    { key: "hesabno:local_snapshots", backend: "local", type: "json", scope: "internal", backup: true, owner: "067", note: "نقطه‌های بازگشت محلی (حداکثر ۵)" },
    { key: "hesabno:payambank:preview-backup", backend: "local", type: "raw", scope: "internal", backup: false, owner: "120", note: "پشتیبان موقت صندوق در حالت پیش‌نمایش" },
    { key: "hesabno:payambank:preview-state", backend: "local", type: "raw", scope: "internal", backup: false, owner: "120", note: "«active» در حالت پیش‌نمایش" },
    { key: "hesabno:reset_safety_backup", backend: "local", type: "json", scope: "internal", backup: false, owner: "108", note: "عکس فوری پیش از ریست" },

    /* ── موقت (sessionStorage) ── */
    { key: "hesabno:check-resolution-resume", backend: "session", type: "raw", scope: "resume", backup: false, owner: "134" },
    { key: "hesabno:lastTab", backend: "session", type: "raw", scope: "resume", backup: false, owner: "003" },
    { key: "hesabno:lastTabIdx", backend: "session", type: "raw", scope: "resume", backup: false, owner: "003", note: "کلید مشتق‌شده: lastTab + «Idx»" },
    { key: "hesabno:linked-cancel-resume", backend: "session", type: "raw", scope: "resume", backup: false, owner: "201" },
    { key: "hesabno:payment-refund-resume", backend: "session", type: "raw", scope: "resume", backup: false, owner: "132" },
    { key: "hesabno:report-account-detail-origin", backend: "session", type: "raw", scope: "resume", backup: false, owner: "221", note: "مهر زمانی کلیک روی گزارش" },
    { key: "hesabno:softReload", backend: "session", type: "raw", scope: "resume", backup: false, owner: "003" },

    /* ── نام رویدادهای پنجره (نه کلید ذخیره‌سازی) ── */
    { key: "hesabno:account-deleted", backend: "event", type: null, scope: "event", backup: false, owner: "078" },
    { key: "hesabno:catalogs-changed", backend: "event", type: null, scope: "event", backup: false, owner: "077" },
    { key: "hesabno:payambank:updated", backend: "event", type: null, scope: "event", backup: false, owner: "067" },
    { key: "hesabno:settlement-date-updated", backend: "event", type: null, scope: "event", backup: false, owner: "142" },
    { key: "hesabno:storage-write-failed", backend: "event", type: null, scope: "event", backup: false, owner: "000a", note: "رخداد شکست نوشتن (سهمیه/دسترسی) از نگهبان ۶.۲ — کلید ذخیره‌سازی نیست" },
    { key: "hesabno:transaction-deleted", backend: "event", type: null, scope: "event", backup: false, owner: "078" },
  ];

  var byKey = new Map();
  for (var index = 0; index < AVAILABLE.length; index += 1) byKey.set(AVAILABLE[index].key, AVAILABLE[index]);

  function isKnown(name) { return byKey.has(name); }
  function entry(name) { return byKey.get(name) || null; }
  function backendOf(name) { var item = byKey.get(name); return item ? item.backend : null; }
  function storageKeys() { return AVAILABLE.filter(function (item) { return item.backend !== "event"; }); }
  function eventNames() { return AVAILABLE.filter(function (item) { return item.backend === "event"; }); }
  function keysForBackend(backend) { return AVAILABLE.filter(function (item) { return item.backend === backend; }); }
  function keysWithScope(scope) { return AVAILABLE.filter(function (item) { return item.scope === scope; }); }
  /* کلیدهایی که «ریست کامل داده» (۱۰۸) پشتیبان می‌گیرد */
  function backupKeys() { return AVAILABLE.filter(function (item) { return item.backup === true; }); }

  return {
    version: 1,
    all: AVAILABLE,
    byKey: function (name) { return entry(name); },
    isKnown: isKnown,
    backendOf: backendOf,
    storageKeys: storageKeys,
    eventNames: eventNames,
    keysForBackend: keysForBackend,
    keysWithScope: keysWithScope,
    backupKeys: backupKeys,
  };
});
