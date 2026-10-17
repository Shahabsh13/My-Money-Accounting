(function(){
  var KEY="hesabno:reset_safety_backup";
  var clean=function(v){return String(v||"").replace(/\s+/g," ").trim();};
  var add=function(){
    try{
      if(!window.localStorage.getItem(KEY)) return;
      if(document.querySelector("[data-reset-safety-restore]")) return;
      var title=Array.from(document.querySelectorAll("h4")).find(function(n){
        return ["صفر کردن داده‌ها","ریست کامل داده‌ها","پاک‌کردن سوابق مالی","پاک‌کردن داده‌های سفارشی"].indexOf(clean(n.textContent))!==-1;
      });
      if(!title) return;
      var row=title.parentElement&&title.parentElement.parentElement&&title.parentElement.parentElement.parentElement;
      if(!row) return;
      var btn=document.createElement("button");
      btn.type="button";
      btn.dataset.resetSafetyRestore="true";
      btn.className="mt-2 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600";
      btn.textContent="بازگرداندن داده‌های قبل از آخرین ریست";
      btn.addEventListener("click",function(){
        try{
          var data=JSON.parse(window.localStorage.getItem(KEY)||"null");
          if(data&&window.__hesabnoRestoreResetData&&window.__hesabnoRestoreResetData(data)){
            window.localStorage.removeItem(KEY);
          } else alert("بازیابی ممکن نشد.");
        }catch(e){alert("بازیابی ممکن نشد.");}
      });
      row.appendChild(btn);
    }catch(e){try{console.warn("[hesabno]",e)}catch(_){}}
  };
  add();
  if(document.body) window.__hesabnoDom.watch(document.body, {childList:true,subtree:true}, add);
})();
