(function(){
  function get(k){try{return JSON.parse((window.__safeGet?window.__safeGet(k):localStorage.getItem(k))||"null")}catch(e){return null}}
  function num(v){return Number(v)||0}
  function excluded(t){var c=t&&t.check;if(!c)return false;var st=String(c.status||"").toLowerCase();return c.debtCanceled===true||/bounced|refunded|returned|dishonor|برگشت|مسترد/.test(st)}
  function dkey(d){return String(d||"").slice(0,10)}
  var busy=false;
  function run(){
    if(busy)return;busy=true;
    try{
      var heads=document.querySelectorAll("main div.sticky.hesabno-transaction-day-header");
      if(!heads.length)return;
      var txs=get("hesabno:transactions")||[];if(!Array.isArray(txs))txs=[];
      var accs=get("hesabno:accounts_v5")||get("hesabno:accounts")||[];if(!Array.isArray(accs))accs=[];
      var opening=accs.reduce(function(s,a){return s+num(a&&(a.openingBalance!=null?a.openingBalance:a.initialBalance))},0);
      var byId={};txs.forEach(function(t){if(t&&t.id!=null)byId[String(t.id)]=t});
      var bodyText=String(document.body&&(document.body.innerText||document.body.textContent)||"");
      var cur=(bodyText.indexOf("تومان")>-1&&bodyText.indexOf("ریال")<0)?"تومان":"ریال";
      heads.forEach(function(h){
        var a=h.parentElement&&h.parentElement.querySelector('article[id^="tx-card-"]');
        var t=a&&byId[a.id.slice(8)];if(!t||!t.date)return;
        var day=dkey(t.date),bal=opening;
        txs.forEach(function(x){if(!x||excluded(x)||dkey(x.date)>day)return;if(x.type==="income")bal+=num(x.amount);else if(x.type==="expense")bal-=num(x.amount)});
        var txt=(bal<0?"−":"")+Math.abs(bal).toLocaleString("fa-IR")+" "+cur;
        if(!h.classList.contains("hesabno-day-line"))h.classList.add("hesabno-day-line");
        var rule=h.querySelector(".hesabno-day-rule"),b=h.querySelector(".hesabno-day-balance");
        if(!rule){rule=document.createElement("span");rule.className="hesabno-day-rule";h.appendChild(rule)}
        if(!b){b=document.createElement("span");b.className="hesabno-day-balance";b.setAttribute("dir","rtl");b.setAttribute("data-hesabno-money-rtl","true");h.appendChild(b)}
        if(b.getAttribute("dir")!=="rtl")b.setAttribute("dir","rtl");
        if(b.getAttribute("data-hesabno-money-rtl")!=="true")b.setAttribute("data-hesabno-money-rtl","true");
        if(b.textContent!==txt)b.textContent=txt;
        if(b.classList.contains("neg")!==(bal<0))b.classList.toggle("neg",bal<0);
      });
    }catch(e){console.warn("[hesabno day-line]",e)}
    finally{busy=false}
  }
  var queued=false;function sched(){if(queued)return;queued=true;Promise.resolve().then(function(){queued=false;run()})}
  function start(){run();window.__hesabnoDom.watch(document.body, {childList:true,subtree:true}, sched);}
  if(document.body)start();else document.addEventListener("DOMContentLoaded",start);
})();
