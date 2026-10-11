(function(){
  var SS=window.sessionStorage, K='hesabno:softReload', T='hesabno:lastTab';
  var restore=null; try{restore=JSON.parse(SS.getItem(K)||'null');SS.removeItem(K);}catch(e){try{console.warn("[hesabno]",e)}catch(_){}}
  function cover(bg){var d=document.createElement('div');d.id='hesabno-soft-cover';d.style.cssText='position:fixed;inset:0;z-index:2147483647;background:'+bg+';display:flex;align-items:center;justify-content:center;transition:opacity .25s';d.innerHTML='<div style="width:34px;height:34px;border:3px solid rgba(120,120,120,.25);border-top-color:#7c3aed;border-radius:50%;animation:hsr 0.8s linear infinite"></div><style>@keyframes hsr{to{transform:rotate(360deg)}}</style>';(document.body||document.documentElement).appendChild(d);return d;}
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('nav.fixed button');if(b)try{SS.setItem(T,b.innerText.trim());SS.setItem(T+'Idx',String([].indexOf.call(b.parentNode.querySelectorAll('button'),b)));}catch(x){}},true);
  window.__hesabnoSoftReload=function(){
    var bg=getComputedStyle(document.body).backgroundColor||'#eef3f6';
    var sc=[...document.querySelectorAll('main,[class*="overflow-y-auto"]')].map(function(el,i){return el.scrollTop;});
    try{SS.setItem(K,JSON.stringify({tab:SS.getItem(T),idx:SS.getItem(T+'Idx'),bg:bg,y:window.scrollY,sc:sc}));}catch(e){try{console.warn("[hesabno]",e)}catch(_){}}
    if(!document.getElementById('hesabno-soft-cover'))cover(bg);
    setTimeout(function(){window.location.reload();},30);
  };
  if(!restore)return;
  document.documentElement.style.background=restore.bg;
  var c=null;
  function start(){c=cover(restore.bg);var n=0;var iv=setInterval(function(){n++;
    var nav=document.querySelector('nav.fixed');
    if(nav||n>60){clearInterval(iv);
      if(nav&&(restore.tab||restore.idx!=null)){var bs=[...nav.querySelectorAll('button')];var b=bs.find(function(x){return x.innerText.trim()===restore.tab;})||bs[+restore.idx];if(b)b.click();}
      setTimeout(function(){window.scrollTo(0,restore.y||0);var els=[...document.querySelectorAll('main,[class*="overflow-y-auto"]')];(restore.sc||[]).forEach(function(v,i){if(els[i])els[i].scrollTop=v;});
        if(!c)return;c.style.opacity='0';setTimeout(function(){c.remove();document.documentElement.style.background='';},260);},120);
    }},50);}
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();
