(function () {
  var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
  var profileClean = function () {
    document.querySelectorAll("span").forEach(function (node) { if (clean(node.textContent) === "نسخه پیشرفته PRO") node.remove(); });
    document.querySelectorAll("p").forEach(function (node) { if (clean(node.textContent) === "همراه: ۰۹۱۲۳۴۵۶۷۸۹") node.textContent = "پروفایل شخصی"; });
  };
  var addMoreCategories = function () {
    var main = document.querySelector("main");
    if (!main || !clean(main.querySelector("h1") && main.querySelector("h1").textContent).includes("بیشتر و امکانات")) return;
    var groups = [
      ["hesabno-more-category-finance", "مدیریت مالی", ["سرفصل حساب‌ها", "چک‌ها و اسناد صیادی", "وام و خریدهای اقساطی", "بودجه‌بندی هوشمند"]],
      ["hesabno-more-category-tools", "ابزارهای کاربردی", ["پیامبانک", "دوره‌ای و میانبرهای سریع", "پروژه‌ها و اعضای خانواده"]],
      ["hesabno-more-category-settings", "تنظیمات", ["تنظیمات پایه", "مدیریت دسترسی‌ها"]],
      ["hesabno-more-category-last", "دوره مالی و پشتیبان‌گیری", ["سال مالی و دوره‌های مالی", "فایل‌های خروجی و گزارش‌ها", "پشتیبان‌گیری و بازیابی داده‌ها"]],
    ];
    var firstTarget = Array.from(main.querySelectorAll("button")).find(function (button) { return clean(button.textContent).includes("تنظیمات پایه"); });
    var list = firstTarget && firstTarget.parentElement;
    if (!list) return;
    groups.forEach(function (item) {
      if (document.getElementById(item[0])) return;
      var target = Array.from(list.querySelectorAll("button")).find(function (button) { return clean(button.textContent).includes(item[2][0]); });
      if (!target) return;
      var heading = document.createElement("div");
      heading.id = item[0]; heading.className = "hesabno-more-category-heading"; heading.textContent = item[1];
      list.insertBefore(heading, target);
    });
    Array.from(list.querySelectorAll("button")).filter(function (button) { return clean(button.textContent).includes("دانلود فایل HTML"); }).forEach(function (button) { button.remove(); });
    var wanted = [];
    groups.forEach(function (item) {
      var heading = document.getElementById(item[0]);
      if (heading && heading.parentElement === list) wanted.push(heading);
      item[2].forEach(function (label) {
        var button = Array.from(list.querySelectorAll("button")).find(function (candidate) { return clean(candidate.textContent).includes(label); });
        if (button) wanted.push(button);
      });
    });
    var updateBackupSubtitle = function () {
      var backupButton = Array.from(list.querySelectorAll("button")).find(function (button) { return clean(button.textContent).includes("پشتیبان‌گیری و بازیابی داده‌ها"); });
      var backupSubtitle = backupButton && backupButton.querySelector("div.grow p:last-child");
      if (!backupSubtitle) return;
      var original = backupButton.dataset.hesabnoBackupSubtitle || clean(backupSubtitle.textContent).replace(/^آخرین پشتیبان:s*/, "");
      if (backupButton.dataset.hesabnoBackupSubtitle !== original) backupButton.dataset.hesabnoBackupSubtitle = original;
      var backupDate = window.__safeGet ? window.__safeGet("hesabno:last_backup_date") : localStorage.getItem("hesabno:last_backup_date");
      var nextSubtitle = backupDate ? "آخرین پشتیبان: " + backupDate : original;
      if (backupSubtitle.textContent !== nextSubtitle) backupSubtitle.textContent = nextSubtitle;
    };
    var current = Array.from(list.children).filter(function (node) { return node.classList.contains("hesabno-more-category-heading") || node.tagName === "BUTTON"; });
    if (current.length === wanted.length && current.every(function (node, index) { return node === wanted[index]; })) { updateBackupSubtitle(); return; }
    var fragment = document.createDocumentFragment();
    wanted.forEach(function (node) { fragment.appendChild(node); });
    list.appendChild(fragment);
    updateBackupSubtitle();
  };
  var setupResetWarning = function () {
    var title = Array.from(document.querySelectorAll("h4")).find(function (node) {
      return ["صفر کردن داده‌ها", "ریست برنامه"].indexOf(clean(node.textContent)) !== -1;
    });
    if (!title || !title.parentElement || title.parentElement.querySelector("[data-reset-warning]")) return;
    var row = title.parentElement.parentElement.parentElement, description = title.parentElement.querySelector("p"), action = row && row.querySelector("button");
    if (!row || !action) return;
    var badge = document.createElement("span");
    badge.dataset.resetWarning = "true"; badge.className = "hesabno-reset-warning"; badge.textContent = "غیرقابل‌بازگشت";
    title.parentElement.insertBefore(badge, title);
    title.textContent = "ریست برنامه";
    if (description) description.remove();
    var actionLabel = action.querySelector("span");
    if (actionLabel) actionLabel.textContent = "ریست برنامه";
  };
  var setupHealthCard = function () {
    var heading = Array.from(document.querySelectorAll("h2")).find(function (node) { return clean(node.textContent) === "پشتیبان‌گیری و بازیابی داده‌ها"; });
    if (!heading || document.getElementById("hesabno-health-card")) return;
    var overlay = heading.closest("div.fixed");
    var box = overlay && Array.from(overlay.querySelectorAll("div")).find(function (node) { var cls = typeof node.className === "string" ? node.className : ""; return cls.includes("max-w-") && cls.includes("rounded-3xl") && node !== overlay; });
    if (!box) return;
    var card = document.createElement("section");
    card.id = "hesabno-health-card"; card.className = "hesabno-health-card";
    card.innerHTML = '<strong>بررسی سلامت داده‌ها</strong><button type="button" data-health-check>بررسی سلامت داده‌ها</button><span data-health-result role="status"></span><div data-health-details></div>';
    var keys = [
      ["hesabno:transactions", "تراکنش‌ها"], ["hesabno:accounts", "حساب‌ها"], ["hesabno:accounts_v5", "حساب‌ها (نسخه ۵)"],
      ["hesabno:checks", "چک‌ها"], ["hesabno:check_settlement_dates", "تاریخ تسویه چک‌ها"], ["hesabno:loans", "وام‌ها"],
      ["hesabno:installments", "اقساط"], ["hesabno:recurring_rules", "قوانین دوره‌ای"], ["hesabno:budgets", "بودجه‌ها"],
      ["hesabno:fiscal_years", "سال‌های مالی"], ["hesabno:shortcuts", "میانبرها"], ["hesabno:familyMembers", "اعضای خانواده"],
      ["hesabno:family_members", "اعضای خانواده (نسخه دیگر)"], ["hesabno:projects", "پروژه‌ها"], ["hesabno:homeWidgets", "ابزارک‌های صفحه اصلی"],
      ["hesabno:projectMeta", "اطلاعات پروژه‌ها"], ["hesabno:familyMemberMeta", "اطلاعات اعضای خانواده"], ["hesabno:payambank:inbox", "صندوق پیامبانک"],
      ["hesabno:payambank:custom_patterns", "الگوهای سفارشی پیامک"], ["hesabno:user_profile", "پروفایل کاربر"],
      ["hesabno:local_snapshots", "نسخه‌های محلی"], ["hesabno:exported_files", "فایل‌های خروجی"]
    ];
    var details = card.querySelector("[data-health-details]");
    var result = card.querySelector("[data-health-result]");
    var check = function () {
      var valid = 0, errors = [];
      keys.forEach(function (item) {
        try {
          var raw = window.localStorage.getItem(item[0]);
          if (raw === null && window.__hesabnoMemoryStorage && Object.prototype.hasOwnProperty.call(window.__hesabnoMemoryStorage, item[0])) raw = window.__hesabnoMemoryStorage[item[0]];
          if (raw === null || raw === undefined) return;
          try { JSON.parse(raw); valid += 1; }
          catch (error) { errors.push({ key: item[0], name: item[1], raw: raw }); }
        } catch (error) { errors.push({ key: item[0], name: item[1], raw: null }); }
      });
      result.textContent = errors.length ? "خطا در " + errors.length + " بخش" : valid ? valid + " بخش سالم است ✓" : "داده‌ای برای بررسی وجود ندارد";
      result.setAttribute("data-health-state", errors.length ? "invalid" : "ok");
      details.replaceChildren();
      errors.forEach(function (item) {
        var row = document.createElement("div");
        row.setAttribute("data-health-key", item.key);
        row.style.cssText = "margin-top:10px;line-height:1.8;overflow-wrap:anywhere";
        var name = document.createElement("strong"); name.textContent = item.name;
        var path = document.createElement("div"); path.textContent = "کلید ذخیره‌سازی داخلی برنامه: ";
        var key = document.createElement("bdi"); key.dir = "ltr"; key.textContent = item.key; path.appendChild(key);
        var button = document.createElement("button"); button.type = "button"; button.textContent = "تعمیر ایمن";
        var message = document.createElement("div"); message.setAttribute("role", "status");
        button.addEventListener("click", function () {
          // تنها اصلاح بدون حدس: حذف نشانگر BOM از ابتدای متن JSON معتبر.
          if (typeof item.raw !== "string" || item.raw.charAt(0) !== "\ufeff") {
            message.textContent = "تعمیر بدون احتمال از دست رفتن اطلاعات ممکن نیست؛ داده‌ها تغییر نکردند."; return;
          }
          var repaired = item.raw.slice(1);
          try { JSON.parse(repaired); } catch (error) {
            message.textContent = "تعمیر بدون احتمال از دست رفتن اطلاعات ممکن نیست؛ داده‌ها تغییر نکردند."; return;
          }
          // آداپتور بومی ممکن است پیوست‌ها را هنگام نوشتن جابه‌جا کند.
          if ((item.key === "hesabno:transactions" || item.key === "hesabno:checks") && repaired.indexOf("data:") !== -1) {
            message.textContent = "تعمیر ایمن این بخش با پیوست‌ها در دسترس نیست؛ داده‌ها تغییر نکردند."; return;
          }
          // در آداپتور SQLite، نوشتن در دو مخزن جداگانه اتمی نیست؛ تعمیر را متوقف می‌کنیم.
          if (window.Storage && window.Storage.prototype.__hesabnoSqlAdapterInstalled) {
            message.textContent = "تعمیر ایمن با ذخیره‌سازی بومی این دستگاه فعلاً در دسترس نیست؛ داده‌ها تغییر نکردند."; return;
          }
          try {
            if (window.__hesabnoStoragePersistent === false || window.localStorage.getItem(item.key) !== item.raw ||
                (window.__safeGet && window.__safeGet(item.key) !== item.raw)) {
              message.textContent = "داده تغییر کرده یا ذخیره‌سازی پایدار در دسترس نیست؛ دوباره بررسی کنید."; return;
            }
            window.localStorage.setItem(item.key, repaired);
            if (window.localStorage.getItem(item.key) !== repaired) throw new Error("write not confirmed");
            check();
            result.textContent += " — نشانگر اضافی ابتدای «" + item.name + "» حذف شد.";
          } catch (error) {
            // بازگرداندن تنها زمانی که مقدار همان مقدار پیشنهادی ما باشد؛ از بازنویسی تغییر جدید پرهیز می‌شود.
            try { if (window.localStorage.getItem(item.key) === repaired) window.localStorage.setItem(item.key, item.raw); } catch (ignored) {}
            message.textContent = "ثبت تعمیر تأیید نشد؛ وضعیت داده را بررسی کنید.";
          }
        });
        row.appendChild(name); row.appendChild(path); row.appendChild(button); row.appendChild(message); details.appendChild(row);
      });
    };
    card.querySelector("[data-health-check]").addEventListener("click", check);
    box.appendChild(card);
  };
  (function(){
    /* قواعد ظاهری توست (.hn-toast) و پنهان‌سازی .hesabno-undo-toast در بستهٔ ۲۳۵ قرار دارد. */
    var pendingUndo=null, pendingTimer=null;
    var show=function(label, undo){
      document.querySelectorAll(".hn-toast").forEach(function(n){n.remove();});
      var dur=undo?6000:3000, t=document.createElement("div"); t.className="hn-toast";
      t.innerHTML='<div class="hn-toast-row"><span></span>'+(undo?'<button type="button">برگرداندن</button>':'')+'</div><div class="hn-toast-bar"></div>';
      t.querySelector("span").textContent=label; t.querySelector(".hn-toast-bar").style.animationDuration=dur+"ms";
      var gone=false, close=function(dx){ if(gone)return; gone=true; t.style.opacity="0"; t.style.transform="translateX(calc(-50% + "+(dx||0)+"px))"; setTimeout(function(){t.remove();},300); };
      var timer=setTimeout(function(){close(0);},dur);
      if(undo) t.querySelector("button").addEventListener("click",function(){ clearTimeout(timer); try{undo();}catch(e){console.error(e);} close(0); });
      var sx=null, dx=0;
      t.addEventListener("pointerdown",function(e){ if(e.target.tagName==="BUTTON")return; sx=e.clientX; dx=0; t.style.transition="none"; try{t.setPointerCapture(e.pointerId);}catch(_){} });
      t.addEventListener("pointermove",function(e){ if(sx===null)return; dx=e.clientX-sx; t.style.transform="translateX(calc(-50% + "+dx+"px))"; t.style.opacity=String(Math.max(0.2,1-Math.abs(dx)/250)); });
      var end=function(){ if(sx===null)return; sx=null; t.style.transition=""; if(Math.abs(dx)>70){ clearTimeout(timer); close(dx>0?400:-400); } else { t.style.transform="translateX(-50%)"; t.style.opacity="1"; } };
      t.addEventListener("pointerup",end); t.addEventListener("pointercancel",end);
      document.body.appendChild(t);
    };
    window.__hesabnoToast=function(label){ var u=pendingUndo; pendingUndo=null; clearTimeout(pendingTimer); show(String(label).replace(/\s*[✓🗑️]+\s*$/u,""), u); };
    var queueUndo=function(label, undo){ pendingUndo=undo; clearTimeout(pendingTimer); pendingTimer=setTimeout(function(){ if(pendingUndo){ var u=pendingUndo; pendingUndo=null; show(label,u);} },60); };
    window.addEventListener("hesabno:transaction-deleted", function () { queueUndo("سند حذف شد", window.__hesabnoUndoTransaction); });
    window.addEventListener("hesabno:account-deleted", function () { queueUndo("حساب یا سرفصل حذف شد", window.__hesabnoUndoAccount); });
  })();
  var enhance = function () { profileClean(); addMoreCategories(); setupHealthCard(); setupResetWarning(); };
  enhance();
  if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, enhance);
})();
