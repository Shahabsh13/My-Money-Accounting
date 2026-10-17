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
    var title = Array.from(document.querySelectorAll("h4")).find(function (node) { return clean(node.textContent) === "صفر کردن داده‌ها"; });
    if (!title || !title.parentElement || title.parentElement.querySelector("[data-reset-warning]")) return;
    var row = title.parentElement.parentElement.parentElement, description = title.parentElement.querySelector("p"), action = row && row.querySelector("button");
    if (!row || !description || !action) return;
    var badge = document.createElement("span");
    badge.dataset.resetWarning = "true"; badge.className = "hesabno-reset-warning"; badge.textContent = "غیرقابل‌بازگشت";
    title.parentElement.insertBefore(badge, title);
    title.textContent = "پاک‌کردن داده‌های سفارشی";
    description.textContent = "مواردی که خودتان تعریف کرده‌اید پاک می‌شوند؛ پیش‌فرض‌های برنامه پس از بارگذاری دوباره ساخته می‌شوند. پیش از ادامه می‌توانید پشتیبان بگیرید.";
    var actionLabel = action.querySelector("span");
    if (actionLabel) actionLabel.textContent = "پاک‌کردن داده‌های سفارشی";
  };
  var setupHealthCard = function () {
    var heading = Array.from(document.querySelectorAll("h2")).find(function (node) { return clean(node.textContent) === "پشتیبان‌گیری و بازیابی داده‌ها"; });
    if (!heading || document.getElementById("hesabno-health-card")) return;
    var overlay = heading.closest("div.fixed");
    var box = overlay && Array.from(overlay.querySelectorAll("div")).find(function (node) { var cls = typeof node.className === "string" ? node.className : ""; return cls.includes("max-w-") && cls.includes("rounded-3xl") && node !== overlay; });
    if (!box) return;
    var card = document.createElement("section");
    card.id = "hesabno-health-card"; card.className = "hesabno-health-card";
    card.innerHTML = '<strong>بررسی سلامت داده‌ها</strong><p>قبل از ریست یا بازیابی، مطمئن شوید بخش‌های ذخیره‌شده قابل خواندن هستند.</p><button type="button" data-health-check>بررسی سلامت داده‌ها</button><span data-health-result></span>';
    card.querySelector("[data-health-check]").addEventListener("click", function () {
      var keys = ["hesabno:transactions", "hesabno:accounts", "hesabno:accounts_v5", "hesabno:loans", "hesabno:installments", "hesabno:budgets", "hesabno:shortcuts"];
      var valid = 0, invalid = 0;
      keys.forEach(function (key) { var raw = window.__safeGet ? __safeGet(key) : localStorage.getItem(key); if (!raw) return; try { JSON.parse(raw); valid += 1; } catch (error) { invalid += 1; } });
      var result = card.querySelector("[data-health-result]");
      result.textContent = invalid ? "خطا در " + invalid + " بخش" : valid ? valid + " بخش سالم است ✓" : "داده‌ای برای بررسی وجود ندارد";
      result.style.color = invalid ? "#d66f67" : "#2c9d8b";
    });
    box.appendChild(card);
  };
  (function(){
    if (!document.getElementById("hn-toast-style")) { var st=document.createElement("style"); st.id="hn-toast-style";
      st.textContent='.hesabno-undo-toast{display:none!important}.hn-toast{position:fixed;left:50%;bottom:calc(88px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:99999;width:min(92vw,420px);background:rgba(28,25,23,.97);color:#f5f5f4;border:1px solid rgba(120,113,108,.35);border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.45);overflow:hidden;direction:rtl;font-size:13px;touch-action:pan-y;transition:opacity .3s,transform .3s;animation:hnIn .25s ease-out}.hn-toast-row{display:flex;align-items:center;gap:10px;padding:12px 14px}.hn-toast-row span{flex:1;line-height:1.6}.hn-toast-row button{flex:none;background:rgba(16,185,129,.15);color:#34d399;border:0;border-radius:10px;padding:6px 12px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit}.hn-toast-bar{height:3px;background:#34d399;transform-origin:right;animation:hnBar linear forwards}@keyframes hnBar{from{transform:scaleX(1)}to{transform:scaleX(0)}}@keyframes hnIn{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}';
      document.head.appendChild(st); }
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
