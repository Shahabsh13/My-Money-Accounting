/* First launch:
   Step 1 (before entering user profile info): Optional restore from Google Drive / backup file.
   Step 2: Ask the user for name, family name and mobile before entering the app, with a button to return to Step 1.
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

  // Already set up check is performed in startFirstRun() so window.__hesabnoOpenFirstRunWizard is always registered.
  var existing = null;
  try { existing = JSON.parse(read(PROFILE_KEY) || "null"); } catch (error) { existing = null; }

  function build() {
    var overlay = document.createElement("div");
    overlay.id = "hesabno-first-run";

    var card = document.createElement("form");
    card.className = "hesabno-fr-card";
    card.setAttribute("novalidate", "novalidate");
    card.setAttribute("data-hesabno-fr-active-step", "restore");

    var glow = document.createElement("div");
    glow.className = "hesabno-fr-glow";
    glow.setAttribute("aria-hidden", "true");


    // ── مرحله ۱ از ۲: صفحه بازیابی از گوگل درایو / فایل پشتیبان (قبل از وارد کردن اطلاعات) ──
    var restoreView = document.createElement("div");
    restoreView.className = "hesabno-fr-view";
    restoreView.setAttribute("data-hesabno-fr-view", "restore");

    var rStep = document.createElement("div");
    rStep.className = "hesabno-fr-step";
    rStep.textContent = "شروع کار  ·  مرحله ۱ از ۳";

    var rTitle = document.createElement("h1");
    rTitle.className = "hesabno-fr-title";
    rTitle.textContent = "نسخه پشتیبان قبلی دارید؟";

    var rSub = document.createElement("p");
    rSub.className = "hesabno-fr-sub";
    rSub.textContent = "پشتیبان دارید؟ بازیابی کنید؛ وگرنه ادامه دهید.";

    var gdriveBox = document.createElement("div");
    gdriveBox.className = "hesabno-fr-gdrive-box";

    var gdriveBtn = document.createElement("button");
    gdriveBtn.type = "button";
    gdriveBtn.className = "hesabno-fr-gdrive-btn";
    gdriveBtn.setAttribute("data-hesabno-fr-gdrive-btn", "true");
    gdriveBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg><span>بازیابی از گوگل درایو</span>';

    var fileBtn = document.createElement("button");
    fileBtn.type = "button";
    fileBtn.className = "hesabno-fr-file-btn";
    fileBtn.setAttribute("data-hesabno-fr-file-btn", "true");
    fileBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>انتخاب فایل پشتیبان</span>';

    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json,application/json";
    fileInput.className = "hesabno-fr-hidden-file";

    var rStatus = document.createElement("div");
    rStatus.className = "hesabno-fr-restore-status";
    rStatus.setAttribute("data-hesabno-fr-restore-status", "");

    gdriveBox.appendChild(gdriveBtn);
    gdriveBox.appendChild(fileBtn);
    gdriveBox.appendChild(fileInput);
    gdriveBox.appendChild(rStatus);

    var goProfileBtn = document.createElement("button");
    goProfileBtn.type = "button";
    goProfileBtn.className = "hesabno-fr-submit";
    goProfileBtn.setAttribute("data-hesabno-fr-go-profile", "true");
    goProfileBtn.innerHTML = 'شروع بدون پشتیبان <span class="hesabno-fr-submit-arrow" aria-hidden="true">←</span>';

    restoreView.appendChild(rTitle);
    restoreView.appendChild(gdriveBox);
    restoreView.appendChild(goProfileBtn);

    // ── مرحله ۲ از ۳: صفحه وارد کردن اطلاعات کاربری (همراه با دکمه بازگشت به صفحه بازیابی) ──
    var profileView = document.createElement("div");
    profileView.className = "hesabno-fr-view";
    profileView.setAttribute("data-hesabno-fr-view", "profile");

    var step = document.createElement("div");
    step.className = "hesabno-fr-step";
    step.textContent = "شروع کار  ·  مرحله ۲ از ۳";
    var title = document.createElement("h1");
    title.className = "hesabno-fr-title";
    title.textContent = "مشخصات شما";
    var sub = document.createElement("p");
    sub.className = "hesabno-fr-sub";
    sub.textContent = "";

    function field(id, label, placeholder, required, type) {
      var wrap = document.createElement("div");
      wrap.className = "hesabno-fr-field";
      var lb = document.createElement("label");
      lb.className = "hesabno-fr-label";
      lb.htmlFor = id;
      lb.textContent = label + (required ? " *" : " (اختیاری)");
      var input = document.createElement("input");
      input.className = "hesabno-fr-input";
      input.id = id; input.name = id; input.type = type || "text";
      input.placeholder = placeholder; input.autocomplete = id.indexOf("mobile") >= 0 ? "tel" : "given-name";
      var err = document.createElement("div");
      err.className = "hesabno-fr-err";
      wrap.appendChild(lb); wrap.appendChild(input); wrap.appendChild(err);
      return { wrap: wrap, input: input, err: err };
    }

    var first = field("hesabno-fr-first", "نام", "مثلاً علی", true);
    var last = field("hesabno-fr-last", "نام خانوادگی", "مثلاً رضایی", true);
    var mobile = field("hesabno-fr-mobile", "شماره موبایل", "۰۹۱۲۳۴۵۶۷۸۹", false, "tel");

    var submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "hesabno-fr-submit";
    submit.setAttribute("data-hesabno-fr-submit-profile", "true");
    submit.textContent = 'بعدی';

    var backToRestoreBtn = document.createElement("button");
    backToRestoreBtn.type = "button";
    backToRestoreBtn.className = "hesabno-fr-back-restore";
    backToRestoreBtn.setAttribute("data-hesabno-fr-back-restore", "true");
    backToRestoreBtn.textContent = 'قبلی';

    var privacy = document.createElement("p");
    privacy.className = "hesabno-fr-privacy";
    var privacyText = "اطلاعاتت فقط برای شخصی‌سازی تجربه‌ی داخل برنامه استفاده می‌شود.";
    var lock = document.createElement("span");
    lock.className = "hesabno-fr-lock";
    lock.innerHTML = '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true"><rect x="4" y="8" width="12" height="9" rx="2" stroke="#6ee7b7" stroke-width="1.5"/><path d="M7 8V6a3 3 0 0 1 6 0v2" stroke="#6ee7b7" stroke-width="1.5" stroke-linecap="round"/></svg>';
    privacy.appendChild(lock); privacy.appendChild(document.createTextNode(privacyText));

    profileView.appendChild(title);
    profileView.appendChild(sub);
    profileView.appendChild(first.wrap);
    profileView.appendChild(last.wrap);
    profileView.appendChild(mobile.wrap);
    var profileNav = document.createElement("div");
    profileNav.className = "hesabno-fr-permissions-nav";
    profileNav.appendChild(backToRestoreBtn);
    profileNav.appendChild(submit);
    profileView.appendChild(profileNav);

    // ── مرحله ۳ از ۳: لیست دسترسی‌ها همراه با دلیل نیاز به هر دسترسی (پس از تکمیل اطلاعات) ──
    var permissionsView = document.createElement("div");
    permissionsView.className = "hesabno-fr-view";
    permissionsView.setAttribute("data-hesabno-fr-view", "permissions");

    var pStep = document.createElement("div");
    pStep.className = "hesabno-fr-step";
    pStep.textContent = "شروع کار  ·  مرحله ۳ از ۳";

    var pTitle = document.createElement("h1");
    pTitle.className = "hesabno-fr-title";
    pTitle.textContent = "دسترسی‌های برنامه";

    var pSub = document.createElement("p");
    pSub.className = "hesabno-fr-sub";
    pSub.textContent = "اختیاری‌اند؛ بعداً هم قابل تغییرند.";

    var permDefs = [
      {
        key: "notifications",
        title: "اعلان‌ها",
        reason: "یادآوری چک، اقساط و ثبت روزانه"
      },
      {
        key: "sms",
        title: "پیامک بانکی",
        reason: "خواندن پیامک‌های واریز و برداشت"
      },
      {
        key: "camera",
        title: "دوربین",
        reason: "عکس‌گرفتن از رسید و چک"
      },
      {
        key: "storage",
        title: "فایل‌ها و پشتیبان",
        reason: "ذخیرهٔ پشتیبان و خروجی گزارش‌ها"
      }
    ];

    var permsList = document.createElement("div");
    permsList.className = "hesabno-fr-perms-list";
    permsList.setAttribute("data-hesabno-fr-perms-list", "true");

    var permNodes = {};

    function readCurrentPermsState() {
      if (typeof window.__hesabnoRefreshPermissionsState === "function") {
        try { return window.__hesabnoRefreshPermissionsState() || {}; } catch (e) {}
      }
      var saved = {};
      try { saved = JSON.parse(read("hesabno:permissions") || "{}") || {}; } catch (e) {}
      var br = window.HnBridge || null;
      return {
        notifications: Boolean(br && typeof br.hasNotificationPermission === "function" ? br.hasNotificationPermission() && saved.notifications !== false : (typeof window.Notification !== "undefined" && window.Notification.permission === "granted" && saved.notifications !== false)),
        sms: Boolean(br && typeof br.hasSmsPermission === "function" ? br.hasSmsPermission() && saved.sms !== false : (saved.smsGranted === true && saved.sms !== false)),
        camera: Boolean(br && typeof br.hasCameraPermission === "function" ? br.hasCameraPermission() && saved.camera !== false : (saved.cameraGranted === true && saved.camera !== false)),
        storage: Boolean(br && typeof br.hasStoragePermission === "function" ? br.hasStoragePermission() && saved.storage !== false : saved.storage !== false),
        biometrics: Boolean(saved.biometrics === true),
        clipboard: Boolean(saved.clipboardGranted === true && saved.clipboard !== false)
      };
    }

    function syncPermsUi() {
      var st = readCurrentPermsState();
      for (var i = 0; i < permDefs.length; i += 1) {
        var k = permDefs[i].key;
        var entry = permNodes[k];
        if (!entry) continue;
        var isGranted = Boolean(st[k]);
        entry.item.setAttribute("data-granted", isGranted ? "true" : "false");
        entry.sw.setAttribute("aria-checked", isGranted ? "true" : "false");
        entry.badge.textContent = isGranted ? "✓ فعال" : "غیرفعال";
      }
    }

    function toggleOrRequestPerm(key) {
      var st = readCurrentPermsState();
      if (st[key]) {
        if (typeof window.__hesabnoOnNativePermissionResult === "function") {
          window.__hesabnoOnNativePermissionResult(key, false);
        }
        syncPermsUi();
        return;
      }
      if (typeof window.__hesabnoRequestDevicePermission === "function") {
        window.__hesabnoRequestDevicePermission(key, function () {
          syncPermsUi();
        });
      }
      syncPermsUi();
    }

    permDefs.forEach(function (def) {
      var item = document.createElement("div");
      item.className = "hesabno-fr-perm-item";
      item.setAttribute("data-hesabno-fr-perm-item", def.key);
      item.setAttribute("data-granted", "false");

      var head = document.createElement("div");
      head.className = "hesabno-fr-perm-head";

      var titleRow = document.createElement("div");
      titleRow.className = "hesabno-fr-perm-title-row";

      var tSpan = document.createElement("span");
      tSpan.className = "hesabno-fr-perm-title";
      tSpan.textContent = def.title;

      var badge = document.createElement("span");
      badge.className = "hesabno-fr-perm-badge";
      badge.textContent = "غیرفعال";

      titleRow.appendChild(tSpan);
      titleRow.appendChild(badge);

      var sw = document.createElement("button");
      sw.type = "button";
      sw.className = "hesabno-fr-perm-switch";
      sw.setAttribute("role", "switch");
      sw.setAttribute("aria-label", def.title);
      sw.setAttribute("aria-checked", "false");
      sw.setAttribute("data-hesabno-fr-perm-key", def.key);
      var knob = document.createElement("span");
      knob.className = "hesabno-fr-perm-knob";
      sw.appendChild(knob);

      sw.addEventListener("click", function () {
        toggleOrRequestPerm(def.key);
      });

      head.appendChild(titleRow);
      head.appendChild(sw);

      var reason = document.createElement("p");
      reason.className = "hesabno-fr-perm-reason";
      reason.setAttribute("data-hesabno-fr-perm-reason", def.key);
      reason.textContent = def.reason;

      item.appendChild(head);
      item.appendChild(reason);
      permsList.appendChild(item);

      permNodes[def.key] = { item: item, sw: sw, badge: badge };
    });

    var restoredFromBackup = false;

    var nextFromPermsBtn = document.createElement("button");
    nextFromPermsBtn.type = "button";
    nextFromPermsBtn.className = "hesabno-fr-submit";
    nextFromPermsBtn.setAttribute("data-hesabno-fr-next-from-perms", "true");
    nextFromPermsBtn.innerHTML = 'ادامه <span class="hesabno-fr-submit-arrow" aria-hidden="true">←</span>';

    var backToProfileBtn = document.createElement("button");
    backToProfileBtn.type = "button";
    backToProfileBtn.className = "hesabno-fr-back-restore";
    backToProfileBtn.setAttribute("data-hesabno-fr-back-profile", "true");
    backToProfileBtn.textContent = "قبلی";

    permissionsView.appendChild(pTitle);
    permissionsView.appendChild(pSub);
    permissionsView.appendChild(permsList);
    var permissionsNav = document.createElement("div");
    permissionsNav.className = "hesabno-fr-permissions-nav";
    permissionsNav.appendChild(backToProfileBtn);
    permissionsNav.appendChild(nextFromPermsBtn);
    permissionsView.appendChild(permissionsNav);

    // ── مرحله ۴: فرم زمان یادآوری اعلان روزانه، چک و وام و انتخاب واحد پول ──
    var preferencesView = document.createElement("div");
    preferencesView.className = "hesabno-fr-view";
    preferencesView.setAttribute("data-hesabno-fr-view", "preferences");

    var prefStep = document.createElement("div");
    prefStep.className = "hesabno-fr-step";
    prefStep.textContent = "شروع کار  ·  تنظیمات یادآوری و واحد پول";

    var prefTitle = document.createElement("h1");
    prefTitle.className = "hesabno-fr-title";
    prefTitle.textContent = "یادآورها و واحد پول";

    var prefSub = document.createElement("p");
    prefSub.className = "hesabno-fr-sub";
    prefSub.textContent = "واحد پول برنامه، زمان یادآوری ثبت روزانه و هشدار سررسید چک و قسط را مشخص کنید.";

    var prefsBox = document.createElement("div");
    prefsBox.className = "hesabno-fr-prefs-box";

    var selectedCurrency = read("hesabno:currency") === "toman" ? "toman" : "rial";
    var dailyReminderEnabled = read("hesabno:reminder") !== "false";
    var dailyReminderTime = clean(read("hesabno:reminderTime")) || "21:00";
    var selectedCheckAlertDays = clean(read("hesabno:checkAlertDays")) || "3";

    // ۱. انتخاب واحد پول
    var currSection = document.createElement("div");
    currSection.className = "hesabno-fr-pref-section";
    var currLabel = document.createElement("div");
    currLabel.className = "hesabno-fr-pref-label";
    currLabel.textContent = "انتخاب واحد پول برنامه";
    var currPills = document.createElement("div");
    currPills.className = "hesabno-fr-pills";
    var currButtons = {};
    [
      { id: "rial", label: "ریال" },
      { id: "toman", label: "تومان" }
    ].forEach(function (cOpt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hesabno-fr-pill";
      btn.setAttribute("data-hesabno-fr-currency", cOpt.id);
      btn.setAttribute("data-selected", selectedCurrency === cOpt.id ? "true" : "false");
      btn.textContent = cOpt.label;
      btn.addEventListener("click", function () {
        selectedCurrency = cOpt.id;
        Object.keys(currButtons).forEach(function (k) {
          currButtons[k].setAttribute("data-selected", k === selectedCurrency ? "true" : "false");
        });
      });
      currButtons[cOpt.id] = btn;
      currPills.appendChild(btn);
    });
    currSection.appendChild(currLabel);
    currSection.appendChild(currPills);

    // ۲. زمان یادآوری اعلان روزانه
    var dailySection = document.createElement("div");
    dailySection.className = "hesabno-fr-pref-section";
    var dailyRow = document.createElement("div");
    dailyRow.className = "hesabno-fr-pref-row";
    var dailyLabel = document.createElement("span");
    dailyLabel.className = "hesabno-fr-pref-label";
    dailyLabel.textContent = "یادآوری اعلان ثبت روزانه";
    var dailySw = document.createElement("button");
    dailySw.type = "button";
    dailySw.className = "hesabno-fr-perm-switch";
    dailySw.setAttribute("role", "switch");
    dailySw.setAttribute("data-hesabno-fr-daily-toggle", "true");
    dailySw.setAttribute("aria-checked", dailyReminderEnabled ? "true" : "false");
    var dailyKnob = document.createElement("span");
    dailyKnob.className = "hesabno-fr-perm-knob";
    dailySw.appendChild(dailyKnob);
    dailySw.addEventListener("click", function () {
      dailyReminderEnabled = !dailyReminderEnabled;
      dailySw.setAttribute("aria-checked", dailyReminderEnabled ? "true" : "false");
    });
    dailyRow.appendChild(dailyLabel);
    dailyRow.appendChild(dailySw);

    var timeInput = document.createElement("input");
    timeInput.type = "time";
    timeInput.id = "hesabno-fr-reminder-time";
    timeInput.className = "hesabno-fr-time-input";
    timeInput.setAttribute("data-hesabno-fr-reminder-time", "true");
    timeInput.value = dailyReminderTime;
    timeInput.addEventListener("change", function () {
      if (clean(timeInput.value)) dailyReminderTime = clean(timeInput.value);
    });
    dailySection.appendChild(dailyRow);
    dailySection.appendChild(timeInput);

    // ۳. یادآوری چک وام و قسط
    var checkSection = document.createElement("div");
    checkSection.className = "hesabno-fr-pref-section";
    var checkLabel = document.createElement("div");
    checkLabel.className = "hesabno-fr-pref-label";
    checkLabel.textContent = "زمان یادآوری چک وام و قسط";
    var checkPills = document.createElement("div");
    checkPills.className = "hesabno-fr-pills";
    var checkButtons = {};
    [
      { id: "1", label: "۱ روز قبل" },
      { id: "2", label: "۲ روز قبل" },
      { id: "3", label: "۳ روز قبل" },
      { id: "5", label: "۵ روز قبل" },
      { id: "7", label: "۷ روز قبل" }
    ].forEach(function (dOpt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hesabno-fr-pill";
      btn.setAttribute("data-hesabno-fr-check-days", dOpt.id);
      btn.setAttribute("data-selected", selectedCheckAlertDays === dOpt.id ? "true" : "false");
      btn.textContent = dOpt.label;
      btn.addEventListener("click", function () {
        selectedCheckAlertDays = dOpt.id;
        Object.keys(checkButtons).forEach(function (k) {
          checkButtons[k].setAttribute("data-selected", k === selectedCheckAlertDays ? "true" : "false");
        });
      });
      checkButtons[dOpt.id] = btn;
      checkPills.appendChild(btn);
    });
    checkSection.appendChild(checkLabel);
    checkSection.appendChild(checkPills);

    prefsBox.appendChild(currSection);
    prefsBox.appendChild(dailySection);
    prefsBox.appendChild(checkSection);

    var finishBtn = document.createElement("button");
    finishBtn.type = "button";
    finishBtn.className = "hesabno-fr-submit";
    finishBtn.setAttribute("data-hesabno-fr-finish", "true");
    finishBtn.innerHTML = 'ورود به برنامه <span class="hesabno-fr-submit-arrow" aria-hidden="true">←</span>';

    var backToPermsBtn = document.createElement("button");
    backToPermsBtn.type = "button";
    backToPermsBtn.className = "hesabno-fr-back-restore";
    backToPermsBtn.setAttribute("data-hesabno-fr-back-perms", "true");
    backToPermsBtn.innerHTML = '<span aria-hidden="true">→</span><span>بازگشت به مرحله دسترسی‌ها</span>';

    preferencesView.appendChild(prefTitle);
    preferencesView.appendChild(prefsBox);
    preferencesView.appendChild(finishBtn);
    preferencesView.appendChild(backToPermsBtn);

    window.addEventListener("hn-permissions-updated", function () {
      syncPermsUi();
    });

    card.appendChild(restoreView);
    card.appendChild(profileView);
    card.appendChild(permissionsView);
    card.appendChild(preferencesView);
    overlay.appendChild(card);

    function savePreferencesAndFinish() {
      var finalTime = clean(timeInput.value) || dailyReminderTime || "21:00";
      store("hesabno:currency", selectedCurrency);
      store("hesabno:reminder", dailyReminderEnabled ? "true" : "false");
      store("hesabno:reminderTime", finalTime);
      store("hesabno:checkAlertDays", String(selectedCheckAlertDays || "3"));
      try {
        if (window.HnBridge && typeof window.HnBridge.saveDailyReminderConfig === "function") {
          window.HnBridge.saveDailyReminderConfig(Boolean(dailyReminderEnabled), finalTime, "", "");
        }
      } catch (e) {}
      finishOnboardingAndEnterApp();
    }

    function finishOnboardingAndEnterApp() {
      store(DONE_KEY, "1");
      overlay.remove();
      if (typeof window.__hesabnoSoftReload === "function") window.__hesabnoSoftReload();
    }

    function proceedFromPermissions() {
      if (restoredFromBackup) {
        finishOnboardingAndEnterApp();
      } else {
        showStep("preferences");
      }
    }

    nextFromPermsBtn.addEventListener("click", proceedFromPermissions);
    backToPermsBtn.addEventListener("click", function () {
      showStep("permissions");
    });

    function showStep(stepName) {
      card.setAttribute("data-hesabno-fr-active-step", stepName);
      if (stepName === "profile") {
        first.input.focus();
      } else if (stepName === "permissions") {
        syncPermsUi();
        pStep.textContent = restoredFromBackup ? "بازیابی حساب  ·  تنظیم دسترسی‌های گوشی" : "شروع کار  ·  مرحله ۳";
        nextFromPermsBtn.textContent = "بعدی";
        pTitle.setAttribute("tabindex", "-1");
        pTitle.focus({ preventScroll: true });
      } else if (stepName === "preferences") {
        prefTitle.setAttribute("tabindex", "-1");
        prefTitle.focus({ preventScroll: true });
      } else {
        gdriveBtn.focus({ preventScroll: true });
      }
      card.scrollTop = 0;
      overlay.scrollTop = 0;
    }

    function applyBackupJsonString(rawJson) {
      try {
        var parsed = JSON.parse(String(rawJson || "").trim());
        if (parsed && typeof parsed === "object" && parsed.attachments && typeof parsed.attachments === "object" && typeof window.__hesabnoImportAttachmentsMap === "function") {
          window.__hesabnoImportAttachmentsMap(parsed.attachments);
        }
        var bag = parsed && typeof parsed === "object" ? (parsed.storageData || parsed.entries) : null;
        if (!bag || typeof bag !== "object" || Array.isArray(bag)) {
          rStatus.setAttribute("data-state", "error");
          rStatus.textContent = "ساختار فایل پشتیبان معتبر نیست.";
          return false;
        }
        var keys = Object.keys(bag);
        var count = 0;
        for (var i = 0; i < keys.length; i += 1) {
          var k = keys[i];
          var val = bag[k];
          if (typeof k === "string" && typeof val === "string") {
            if ((k === "hesabno:transactions" || k === "hesabno:checks") && val.indexOf("data:") !== -1 && typeof window.__hesabnoOffloadTransactionsJson === "function") {
              val = window.__hesabnoOffloadTransactionsJson(val);
            }
            store(k, val);
            count += 1;
          }
        }
        if (parsed && typeof parsed === "object") {
          if (parsed.currency === "rial" || parsed.currency === "toman") {
            store("hesabno:currency", parsed.currency);
          }
          if (parsed.settingsData && typeof parsed.settingsData === "object") {
            Object.keys(parsed.settingsData).forEach(function (sk) {
              var sv = parsed.settingsData[sk];
              if (typeof sv === "string") store(sk, sv);
            });
          }
        }
        if (count === 0) {
          rStatus.setAttribute("data-state", "error");
          rStatus.textContent = "فایل انتخاب‌شده خالی است.";
          return false;
        }
        restoredFromBackup = true;
        card.setAttribute("data-hesabno-fr-restored", "true");
        rStatus.setAttribute("data-state", "ok");
        rStatus.textContent = "اطلاعات نسخه پشتیبان با موفقیت بازیابی شد ✓";
        showStep("permissions");
        return true;
      } catch (err) {
        rStatus.setAttribute("data-state", "error");
        rStatus.textContent = "خطا در خواندن فایل پشتیبان. لطفاً یک فایل JSON معتبر انتخاب کنید.";
        return false;
      }
    }

    window.__hesabnoFirstRunApplyBackup = applyBackupJsonString;
    window.__hesabnoReceiveCloudBackupJson = function (jsonStr) {
      applyBackupJsonString(jsonStr);
    };

    gdriveBtn.addEventListener("click", function () {
      rStatus.textContent = "";
      rStatus.removeAttribute("data-state");
      try {
        if (window.HnBridge) {
          if (typeof window.HnBridge.readFromCloudDrive === "function") {
            var direct = window.HnBridge.readFromCloudDrive();
            if (direct && String(direct).trim()) {
              if (applyBackupJsonString(direct)) return;
            }
          }
          if (typeof window.HnBridge.pickCloudBackupToRestore === "function") {
            window.HnBridge.pickCloudBackupToRestore();
            return;
          }
        }
        if (window.__hesabnoCloudDriveState && window.__hesabnoCloudDriveState.payload) {
          applyBackupJsonString(window.__hesabnoCloudDriveState.payload);
          return;
        }
        rStatus.textContent = "فایل پشتیبان را از سایت درایو دانلود کنید؛ سپس «انتخاب فایل پشتیبان» را بزنید.";
        if (window.confirm("گوگل درایو در دسترس نیست. سایت درایو باز شود؟ پس از دانلود پشتیبان به برنامه برگردید.")) {
          window.open("https://drive.google.com/", "_blank", "noopener,noreferrer");
        }
      } catch (err) {
        rStatus.setAttribute("data-state", "error");
        rStatus.textContent = "امکان باز کردن گوگل درایو وجود ندارد.";
      }
    });

    fileBtn.addEventListener("click", function () {
      rStatus.textContent = "";
      rStatus.removeAttribute("data-state");
      fileInput.click();
    });

    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (typeof FileReader === "function") {
        var reader = new FileReader();
        reader.onload = function () { applyBackupJsonString(reader.result); };
        reader.readAsText(file);
      } else if (typeof file.text === "function") {
        file.text().then(applyBackupJsonString);
      }
    });

    goProfileBtn.addEventListener("click", function () {
      restoredFromBackup = false;
      card.removeAttribute("data-hesabno-fr-restored");
      showStep("profile");
    });

    backToRestoreBtn.addEventListener("click", function () {
      showStep("restore");
    });

    backToProfileBtn.addEventListener("click", function () {
      showStep("profile");
    });

    finishBtn.addEventListener("click", function () {
      savePreferencesAndFinish();
    });

    [first.input, last.input, mobile.input].forEach(function (inp) {
      inp.addEventListener("input", function () {
        if (clean(inp.value)) {
          inp.removeAttribute("data-hesabno-invalid");
          inp.removeAttribute("aria-invalid");
        }
      });
    });

    function validate() {
      var ok = true;
      var f = clean(first.input.value), l = clean(last.input.value);
      var m = toEnglishDigits(mobile.input.value).replace(/[\s-]/g, "");
      first.err.textContent = f ? "" : "نام را وارد کنید";
      last.err.textContent = l ? "" : "نام خانوادگی را وارد کنید";
      if (!f) {
        ok = false;
        first.input.setAttribute("data-hesabno-invalid", "true");
        first.input.setAttribute("aria-invalid", "true");
      } else {
        first.input.removeAttribute("data-hesabno-invalid");
        first.input.removeAttribute("aria-invalid");
      }
      if (!l) {
        ok = false;
        last.input.setAttribute("data-hesabno-invalid", "true");
        last.input.setAttribute("aria-invalid", "true");
      } else {
        last.input.removeAttribute("data-hesabno-invalid");
        last.input.removeAttribute("aria-invalid");
      }
      mobile.err.textContent = "";
      if (m && !/^\+?\d{7,15}$/.test(m)) {
        mobile.err.textContent = "شماره موبایل معتبر نیست";
        mobile.input.setAttribute("data-hesabno-invalid", "true");
        mobile.input.setAttribute("aria-invalid", "true");
        ok = false;
      } else {
        mobile.input.removeAttribute("data-hesabno-invalid");
        mobile.input.removeAttribute("aria-invalid");
      }
      return ok ? { first: f, last: l, mobile: m } : null;
    }

    card.addEventListener("submit", function (event) {
      event.preventDefault();
      var currentStep = card.getAttribute("data-hesabno-fr-active-step");
      if (currentStep === "preferences") {
        savePreferencesAndFinish();
        return;
      }
      if (currentStep === "permissions") {
        proceedFromPermissions();
        return;
      }
      if (currentStep !== "profile") {
        showStep("profile");
        return;
      }
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
        sub.setAttribute("data-error", "true");
        return;
      }
      showStep("permissions");
    });

    return overlay;
  }

  function mount() {
    if (!document.body) { document.addEventListener("DOMContentLoaded", mount); return; }
    if (document.getElementById("hesabno-first-run")) return;
    document.body.appendChild(build());
    var gdriveBtn = document.querySelector('[data-hesabno-fr-gdrive-btn="true"]');
    if (gdriveBtn) gdriveBtn.focus();
  }
  function showIntro(done) {
    var key = "hesabno:first_run_intro_done";
    if (read(key) === "1") { done(); return; }
    var slides = [
      {
        t: "دسترسی راحت",
        b: "موجودی کل، درآمد و هزینهٔ ماهانه، نمودار سرفصل‌ها و میانبرهای سریع را در یک نگاه ببین.",
        svg: '<svg viewBox="0 0 200 160" fill="none"><defs><linearGradient id="t1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#134e4a"/><stop offset="1" stop-color="#0f2a2e"/></linearGradient></defs><rect x="35" y="8" width="130" height="134" rx="26" fill="url(#t1)" stroke="#2b5b58" stroke-width="1.5"/><rect x="52" y="26" width="26" height="18" rx="7" fill="#0f2127" stroke="#244047"/><rect x="82" y="26" width="26" height="18" rx="7" fill="#0f2127" stroke="#244047"/><rect x="112" y="26" width="26" height="18" rx="7" fill="#0f2127" stroke="#244047"/><path d="M52 116 L78 94 L100 104 L124 76 L148 86" stroke="#6ee7b7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="124" cy="76" r="4" fill="#34d399"/><path d="M50 120 h100" stroke="#2b5b58" stroke-width="2" stroke-linecap="round"/></svg>'
      },
      {
        t: "ثبت تراکنش به راحتی",
        b: "دریافت، پرداخت و انتقال وجه را با مبلغ، سرفصل، حساب و شرح ثبت کن؛ سندها را دنبال کن.",
        svg: '<svg viewBox="0 0 200 160" fill="none"><defs><linearGradient id="t2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#134e4a"/><stop offset="1" stop-color="#0f2a2e"/></linearGradient></defs><rect x="35" y="8" width="130" height="134" rx="26" fill="url(#t2)" stroke="#2b5b58" stroke-width="1.5"/><circle cx="72" cy="62" r="23" fill="#0d2527" stroke="#10b981" stroke-width="2"/><path d="M72 74 V52 M64 60 l8 -8 8 8" stroke="#6ee7b7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="128" cy="62" r="23" fill="#241b0c" stroke="#f59e0b" stroke-width="2"/><path d="M128 50 V74 M120 66 l8 8 8 -8" stroke="#fcd34d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><rect x="80" y="96" width="40" height="32" rx="7" fill="#e8f4ef"/><rect x="87" y="103" width="26" height="3" rx="1.5" fill="#0e6b58" opacity=".5"/><rect x="87" y="110" width="18" height="3" rx="1.5" fill="#0e6b58" opacity=".35"/><path d="M80 128 l5 -5 5 5 5 -5 5 5 5 -5 5 5 5 -5 5 5 5 -5 5 5" stroke="#0e6b58" stroke-width="2" fill="none"/></svg>'
      },
      {
        t: "تحلیل راحت",
        b: "مقایسهٔ ماهانه، توزیع هزینه‌ها و درآمدها و میانگین روزانه را ببین.",
        svg: '<svg viewBox="0 0 200 160" fill="none"><defs><linearGradient id="t3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#134e4a"/><stop offset="1" stop-color="#0f2a2e"/></linearGradient><linearGradient id="b3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#0d9488"/></linearGradient></defs><rect x="35" y="8" width="130" height="134" rx="26" fill="url(#t3)" stroke="#2b5b58" stroke-width="1.5"/><rect x="56" y="84" width="16" height="36" rx="5" fill="url(#b3)" opacity=".55"/><rect x="80" y="68" width="16" height="52" rx="5" fill="url(#b3)" opacity=".8"/><rect x="104" y="90" width="16" height="30" rx="5" fill="url(#b3)"/><rect x="128" y="58" width="16" height="62" rx="5" fill="#fbbf24"/><path d="M62 78 L86 62 L110 72 L134 50" stroke="#a7f3d0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="134" cy="50" r="3.5" fill="#6ee7b7"/><path d="M52 122 h100" stroke="#2b5b58" stroke-width="2" stroke-linecap="round"/></svg>'
      },
      {
        t: "مدیریت آسان",
        b: "سرفصل‌ها، بانک‌ها، چک‌ها، وام، اقساط و بودجه را یک‌جا کنترل کن.",
        svg: '<svg viewBox="0 0 200 160" fill="none"><defs><linearGradient id="t4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#134e4a"/><stop offset="1" stop-color="#0f2a2e"/></linearGradient></defs><rect x="35" y="8" width="130" height="134" rx="26" fill="url(#t4)" stroke="#2b5b58" stroke-width="1.5"/><rect x="56" y="28" width="38" height="38" rx="12" fill="#0f2127" stroke="#244047"/><rect x="106" y="28" width="38" height="38" rx="12" fill="#0f2127" stroke="#244047"/><rect x="56" y="78" width="38" height="38" rx="12" fill="#0f2127" stroke="#244047"/><rect x="106" y="78" width="38" height="38" rx="12" fill="#0f2127" stroke="#244047"/><circle cx="75" cy="47" r="7" fill="none" stroke="#2dd4bf" stroke-width="2.5"/><path d="M125 42 v10 M120 47 h10" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/><rect x="70" y="92" width="10" height="10" rx="3" fill="none" stroke="#fb7185" stroke-width="2.5"/><path d="M118 90 l8 8 M126 90 l-8 8" stroke="#6ee7b7" stroke-width="2.5" stroke-linecap="round"/></svg>'
      }
    ];
    /* قواعد ظاهری تور معرفی (#hesabno-intro-tour) و فرم اجرای اول (#hesabno-first-run) در بستهٔ ۲۳۵ قرار دارد. */
    var current = 0;
    var overlay = document.createElement("div");
    overlay.id = "hesabno-intro-tour";
    overlay.dir = "rtl";
    var card = document.createElement("section"); card.className = "intro-card"; card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true"); card.setAttribute("aria-label", "معرفی برنامه");
    card.innerHTML = '<div class="intro-brand-row"><strong class="intro-brand-label">MY MONEY</strong></div><div class="intro-art" aria-hidden="true" data-intro-art></div><div class="intro-copy" data-intro-copy><div class="intro-kicker" data-intro-step></div><h2 data-intro-title></h2><p data-intro-body aria-live="polite"></p></div><div class="intro-dots" data-intro-dots></div><div class="intro-actions"><button type="button" class="intro-skip" data-intro-skip>رد کردن</button><button type="button" class="intro-next" data-intro-next>بعدی ←</button></div>';
    overlay.appendChild(card); document.body.appendChild(overlay);
    var step = card.querySelector('[data-intro-step]'), title = card.querySelector('[data-intro-title]'), body = card.querySelector('[data-intro-body]'), dots = card.querySelector('[data-intro-dots]'), next = card.querySelector('[data-intro-next]'), copy = card.querySelector('[data-intro-copy]'), art = card.querySelector('[data-intro-art]');
    function finish() { store(key, "1"); overlay.remove(); done(); }
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

  window.__hesabnoOpenFirstRunWizard = function (initialStep) {
    var oldOv = document.getElementById("hesabno-first-run");
    if (oldOv) oldOv.remove();
    var ov = build();
    document.body.appendChild(ov);
    var cardEl = ov.querySelector(".hesabno-fr-card");
    if (cardEl && initialStep) {
      cardEl.setAttribute("data-hesabno-fr-active-step", initialStep);
    }
    return ov;
  };

  function startFirstRun() {
    var forceByQuery = false;
    try {
      forceByQuery = window.location && String(window.location.search || "").indexOf("firstRun=1") !== -1;
    } catch (e) {}
    if (!forceByQuery && (read(DONE_KEY) === "1" || (existing && clean(existing.firstName)))) return;
    showIntro(mount);
  }
  startFirstRun();
})();
