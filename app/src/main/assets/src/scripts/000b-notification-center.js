/* Persistent in-app inbox. Viewing the list does not mark notices read. */
(function () {
  'use strict';
  var KEY = 'hesabno:notification-center:v1';
  var pendingClick = null;
  function valid(n) {
    return n && typeof n==='object' && typeof n.id==='string' && typeof n.key==='string'
      && typeof n.title==='string' && typeof n.body==='string' && typeof n.target==='string'
      && Number.isFinite(n.createdAt) && typeof n.read==='boolean';
  }
  function list() {
    try { var a=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(a)?a.filter(valid):[]; }
    catch (_) { return []; }
  }
  function save(a) {
    try {
      var text=JSON.stringify(a);
      localStorage.setItem(KEY,text);
      if(localStorage.getItem(KEY)!==text)return false;
      window.dispatchEvent(new Event('hn-notification-center-updated'));
      return true;
    } catch (_) { return false; } // A failed inbox write must not block the actual system notification.
  }
  function aliases(n) {return (Array.isArray(n.nativeIds)?n.nativeIds:[]).concat(n.nativeId?[n.nativeId]:[]);}
  function add(info) {
    if(!info||typeof info.title!=='string'||!info.title.trim())return null;
    var at=info.createdAt===undefined?Date.now():Number(info.createdAt);
    if(!Number.isFinite(at)||!Number.isFinite(new Date(at).getTime()))return null;
    var body=typeof info.body==='string'?info.body:'',target=typeof info.target==='string'?info.target:'home';
    var a=list(),key=typeof info.key==='string'?info.key:[info.title,body,target,new Date(at).toISOString().slice(0,10)].join('|');
    var old=a.find(function(n){return n.key===key;});
    var nativeId=typeof info.id==='string'?info.id:null;
    if(old){
      if(nativeId&&aliases(old).indexOf(nativeId)===-1){old.nativeIds=aliases(old).concat(nativeId);if(!save(a))return null;}
      return old;
    }
    var n={nativeId:nativeId,nativeIds:nativeId?[nativeId]:[],id:nativeId||key,key:key,title:info.title,body:body,target:target,createdAt:at,read:false};
    a.unshift(n);a.sort(function(x,y){return y.createdAt-x.createdAt;});
    return save(a)?n:null;
  }
  function read(id) {return save(list().map(function(n){return n.id===id?Object.assign({},n,{read:true}):n;}));}
  function sync() {
    try {
      if(window.HnBridge&&window.HnBridge.getNotificationHistoryJson){
        var history=JSON.parse(window.HnBridge.getNotificationHistoryJson());
        if(Array.isArray(history))history.forEach(function(info){try{add(info);}catch(_){}});
      }
    }catch(_){}
  }
  function navigate(target) {
    try {
      var fn,ok;
      if(target.indexOf('sms:')===0){fn=window.__hesabnoOpenSmsFromNotification;if(!fn)return false;ok=fn(target.slice(4));}
      else {fn=target==='checks'?window.__hesabnoOpenChecksFromNotification:target==='loans'?window.__hesabnoOpenLoansFromNotification:target==='home'?window.__hesabnoOpenDashboardFromNotification:null;if(!fn)return false;ok=fn();}
      return ok===true;
    }catch(_){return false;}
  }
  function open(n) {return !!(n&&valid(n)&&navigate(n.target)&&read(n.id));}
  function readNative(id) {var n=list().find(function(n){return aliases(n).indexOf(id)!==-1;});return n?read(n.id):false;}
  function handleWebClick(title,body,target) {
    var n=list().find(function(n){return n.title===title&&n.body===body&&n.target===target;});
    return n ? open(n) : navigate(target);
  }
  function handleNativeClick(id,target) {
    var click={id:id,target:target||'home',attempts:0};pendingClick=click;
    function attempt(){
      if(pendingClick!==click)return;
      sync();
      if(navigate(click.target)){readNative(click.id);pendingClick=null;return;}
      // React's route handlers may not exist yet during a cold start.
      if(++click.attempts<100)setTimeout(attempt,100);
    }
    attempt();
  }
  window.HnNotificationCenter={list:list,add:add,read:read,sync:sync,open:open,readNative:readNative,handleNativeClick:handleNativeClick,handleWebClick:handleWebClick,
    readAll:function(){return save(list().map(function(n){return Object.assign({},n,{read:true});}));}};
  window.addEventListener('focus',sync);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)sync();});
})();
