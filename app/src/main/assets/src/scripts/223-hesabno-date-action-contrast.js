(function () {
"use strict";
var clean=function(v){return String(v||"").replace(/\s+/g," ").trim();};
var sync=function(){
var dark=document.documentElement.getAttribute("data-theme")==="dark";
var b=document.querySelector('button[title="مشاهده تقویم و تاریخ امروز"]');
if(b){var box=b.querySelector("div.text-left")||b.querySelector("div");var rows=box?Array.from(box.children).filter(function(n){return n.tagName==="DIV";}):[];var spans=rows[0]?rows[0].querySelectorAll("span"):[];var d=spans.length?spans[spans.length-1]:null;if(d){d.style.setProperty("color",dark?"#f2d18a":"#244b59","important");d.style.setProperty("font-weight","900","important");d.style.setProperty("opacity","1","important");}}
document.querySelectorAll(".hesabno-transaction-day-header .hesabno-transaction-day-date, [data-hesabno-period-date='true'], [data-hesabno-relative-date], .hesabno-statement-date-cell").forEach(function(n){if(n.closest("[data-hesabno-period-hidden='true']"))return;n.style.setProperty("color",dark?"#b9cbd4":"#526875","important");n.style.setProperty("opacity","1","important");});
document.querySelectorAll('article[id^="tx-card-"] button').forEach(function(b){var t=clean((b.innerText||b.textContent)+" "+b.getAttribute("title"));var k="";if(/ویرایش/.test(t))k="edit";else if(/حذف/.test(t))k="delete";else if(/اصلاحی|اصلاحیه|برگشت وجه|برگشت/.test(t)&&!/مشاهده سند اصلاحی|مشاهده اصلاحی/.test(t))k="correction";if(k&&b.getAttribute("data-hesabno-action-kind")!==k)b.setAttribute("data-hesabno-action-kind",k);});
};
var q=false;var schedule=function(){if(q)return;q=true;requestAnimationFrame(function(){q=false;sync();});};sync();if(document.body)window.__hesabnoDom.watch(document.body, {childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["class","title","data-theme"]}, schedule);document.addEventListener("click",function(){setTimeout(schedule,0);},true);
})();