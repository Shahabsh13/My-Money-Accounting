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
      var cur=(document.body.innerText.indexOf("تومان")>-1&&document.body.innerText.indexOf("ریال")<0)?"تومان":"ریال";
      heads.forEach(function(h){
        var a=h.parentElement&&h.parentElement.querySelector('article[id^="tx-card-"]');
        var t=a&&byId[a.id.slice(8)];if(!t||!t.date)return;
        var day=dkey(t.date),bal=opening;
        txs.forEach(function(x){if(!x||excluded(x)||dkey(x.date)>day)return;if(x.type==="income")bal+=num(x.amount);else if(x.type==="expense")bal-=num(x.amount)});
        var txt=(bal<0?"−":"")+Math.abs(bal).toLocaleString("fa-IR")+" "+cur;
        h.classList.add("hesabno-day-line");
        var rule=h.querySelector(".hesabno-day-rule"),b=h.querySelector(".hesabno-day-balance");
        if(!rule){rule=document.createElement("span");rule.className="hesabno-day-rule";h.appendChild(rule)}
        if(!b){b=document.createElement("span");b.className="hesabno-day-balance";h.appendChild(b)}
        if(b.textContent!==txt)b.textContent=txt;
        b.classList.toggle("neg",bal<0);
      });
    }catch(e){console.warn("[hesabno day-line]",e)}
    finally{setTimeout(function(){busy=false},0)}
  }
  var tm=null;function sched(){clearTimeout(tm);tm=setTimeout(run,120)}
  function start(){run();new MutationObserver(sched).observe(document.body,{childList:true,subtree:true})}
  if(document.body)start();else document.addEventListener("DOMContentLoaded",start);
})();
