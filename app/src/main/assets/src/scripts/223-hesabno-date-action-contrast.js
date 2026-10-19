(function () {
"use strict";
var clean=function(v){return String(v||"").replace(/\s+/g," ").trim();};
/* ظاهر (رنگ/وزن/شفافیت تاریخ‌ها) در بستهٔ ۲۳۵ (لایهٔ ظاهر) تعریف شده است.
   این فایل دیگر هیچ رنگ یا اندازه‌ای نمی‌نویسد؛ فقط «کلاس معنایی» می‌گذارد و
   نوع دکمه‌های کارت تراکنش را برای دسترس‌پذیری مشخص می‌کند. */
var sync=function(){
var dark=document.documentElement.getAttribute("data-theme")==="dark";
var b=document.querySelector('button[title="مشاهده تقویم و تاریخ امروز"]');
if(b){var box=b.querySelector("div.text-left")||b.querySelector("div");var rows=box?Array.from(box.children).filter(function(n){return n.tagName==="DIV";}):[];var spans=rows[0]?rows[0].querySelectorAll("span"):[];var d=spans.length?spans[spans.length-1]:null;if(d&&!d.classList.contains("hesabno-dashboard-date-value"))d.classList.add("hesabno-dashboard-date-value");}
/* رنگ تاریخ‌های لیست/صورت‌حساب با همان انتخابگرها در CSS اعمال می‌شود. */
document.querySelectorAll('article[id^="tx-card-"] button').forEach(function(b){var t=clean((b.innerText||b.textContent)+" "+b.getAttribute("title"));var k="";if(/ویرایش/.test(t))k="edit";else if(/حذف/.test(t))k="delete";else if(/اصلاحی|اصلاحیه|برگشت وجه|برگشت/.test(t)&&!/مشاهده سند اصلاحی|مشاهده اصلاحی/.test(t))k="correction";if(k&&b.getAttribute("data-hesabno-action-kind")!==k)b.setAttribute("data-hesabno-action-kind",k);});
};
var q=false;var schedule=function(){if(q)return;q=true;Promise.resolve().then(function(){q=false;sync();});};sync();if(document.body)window.__hesabnoDom.watch(document.body, {childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["class","title","data-theme"]}, schedule);document.addEventListener("click",function(){schedule();},true);
})();