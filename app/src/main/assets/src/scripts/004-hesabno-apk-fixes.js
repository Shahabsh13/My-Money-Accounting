(function(){
/* 1) یک کلید واحد برای حساب‌ها */
try{var SP=Storage.prototype,oG=SP.getItem,oS=SP.setItem,oR=SP.removeItem,OLD="hesabno:accounts",NEW="hesabno:accounts_v5";
var mapK=function(k){return k===OLD?NEW:k};
try{var ls=window.localStorage,o=oG.call(ls,OLD);if(o!==null){var cur=oG.call(ls,NEW);if(cur===null){oS.call(ls,NEW,o);cur=oG.call(ls,NEW)}if(cur===o){oR.call(ls,OLD)}else{if(oG.call(ls,"hesabno:accounts_backup_old")===null)oS.call(ls,"hesabno:accounts_backup_old",o);oR.call(ls,OLD)}}}catch(e){try{console.warn("[hesabno]",e)}catch(_){}}
SP.getItem=function(k){return oG.call(this,mapK(k))};
SP.setItem=function(k,v){if(k===OLD&&oG.call(this,NEW)===String(v))return;return oS.call(this,mapK(k),v)};
SP.removeItem=function(k){return oR.call(this,mapK(k))};}catch(e){try{console.warn("[hesabno]",e)}catch(_){}}
/* هشدار «فضا پر شد» به 000a-hesabno-storage-write-guard.js منتقل شد تا از اولین نوشتن بوت فعال باشد */

/* 6) پنجره‌های پیام داخل برنامه به جای alert/confirm */
var nAlert=window.alert&&window.alert.bind(window),nConfirm=window.confirm&&window.confirm.bind(window);
function dlg(msg,isConfirm,cb,isExit){
 var b=document.body;if(!b){if(cb)cb(isConfirm?nConfirm(msg):true);return}
 var w=document.createElement('div');w.setAttribute('data-hn-dialog','');w.setAttribute('role','dialog');w.setAttribute('aria-modal','true');
 w.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:20px;direction:rtl;font-family:Vazirmatn,Tahoma,sans-serif';
 var dk=false;try{var m=getComputedStyle(b).backgroundColor.match(/\d+/g);dk=document.documentElement.classList.contains('dark')||(m&&(+m[0]*299+ +m[1]*587+ +m[2]*114)/1000<110)}catch(e){try{console.warn("[hesabno]",e)}catch(_){}}
 var c=document.createElement('div');c.style.cssText='background:'+(dk?'#1f2937':'#fff')+';color:'+(dk?'#f3f4f6':'#1f2937')+';border-radius:16px;max-width:360px;width:100%;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,.3);font-size:15px;line-height:1.9;white-space:pre-line';
 if(isExit){
  // Keep the page visible behind the exit card, even under global light-theme rules.
  w.style.setProperty('background', 'rgba(8, 20, 24, 0.30)', 'important');
  w.style.setProperty('backdrop-filter', 'blur(8px)', 'important');
  w.style.setProperty('-webkit-backdrop-filter', 'blur(8px)', 'important');
  w.setAttribute('data-hn-exit-dialog','');var brand=document.createElement('div');brand.setAttribute('data-hn-exit-brand','');brand.style.cssText='display:flex;align-items:center;justify-content:flex-start;gap:10px;margin-bottom:14px;direction:rtl;text-align:right;font-weight:800';var logo=document.createElement('img');logo.src='assets/icon/apple-touch-icon.png';logo.alt='';logo.width=36;logo.height=36;logo.style.cssText='width:36px;height:36px;border-radius:10px';var name=document.createElement('span');name.textContent='My Money';brand.appendChild(logo);brand.appendChild(name);c.appendChild(brand);}
 if(isExit){var backupLabel=document.createElement('label');backupLabel.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:13px;cursor:pointer;white-space:normal';var backupCheck=document.createElement('input');backupCheck.type='checkbox';backupCheck.checked=true;backupCheck.setAttribute('data-hn-exit-backup','');backupCheck.style.cssText='width:20px;height:20px;flex-shrink:0;accent-color:#2563eb';var backupText=document.createElement('span');backupText.textContent='گرفتن پشتیبان قبل از خروج';backupLabel.appendChild(backupCheck);backupLabel.appendChild(backupText);c.appendChild(backupLabel);var status=document.createElement('p');status.setAttribute('data-hn-exit-status','');status.setAttribute('role','status');status.style.cssText='font-size:12px;color:#c2410c;white-space:normal';c.appendChild(status);}
 var t=document.createElement('div');t.textContent=String(msg==null?'':msg);c.appendChild(t);
 var r=document.createElement('div');r.style.cssText='display:flex;gap:10px;margin-top:16px';
 function btn(label,primary,val){var x=document.createElement('button');x.type='button';x.textContent=label;x.style.cssText='flex:1;min-height:44px;border-radius:12px;font-size:16px;font-family:inherit;cursor:pointer;border:'+(primary?'0;background:#2563eb;color:#fff':'1px solid #d1d5db;background:#fff;color:#374151');x.onclick=function(ev){ev.stopPropagation();if(isExit&&val){if(x.disabled)return;x.disabled=true;try{if(cb&&cb(val)===false)return;w.remove();}finally{x.disabled=false}}else{w.remove();if(cb)cb(val)}};r.appendChild(x);return x}
 var ok=btn(isConfirm?'بله':'باشه',true,true);if(isConfirm)btn('انصراف',false,false);
 c.appendChild(r);w.appendChild(c);w.addEventListener('click',function(e){e.stopPropagation()});b.appendChild(w);try{ok.focus()}catch(e){try{console.warn("[hesabno]",e)}catch(_){}}
}
window.alert=function(m){dlg(m,false)};
window.__hesabnoDismissExitDialog=function(){
 var dialog=document.querySelector('[data-hn-exit-dialog]');
 if(!dialog)return false;
 var cancel=dialog.querySelectorAll('button')[1];
 if(cancel)cancel.click();else dialog.remove();
 return true;
};
window.__hesabnoConfirmExit=function(){
 if(document.querySelector('[data-hn-dialog]'))return;
 dlg('آیا می‌خواهید از برنامه خارج شوید؟',true,function(yes){
  if(!yes)return;
  var dialog=document.querySelector('[data-hn-exit-dialog]');
  var check=dialog&&dialog.querySelector('[data-hn-exit-backup]');
  var status=dialog&&dialog.querySelector('[data-hn-exit-status]');
  try{
   if(check&&check.checked){
    if(status)status.textContent='در حال ذخیرهٔ پشتیبان…';
    if(typeof window.__hesabnoFlushAutoBackup!=='function'||window.__hesabnoFlushAutoBackup(true)!==true){
     if(status)status.textContent='پشتیبان ذخیره نشد. دوباره تلاش کنید یا برای خروج بدون پشتیبان تیک را بردارید.';
     return false;
    }
   }
   if(window.HnBridge&&typeof window.HnBridge.exitApp==='function')window.HnBridge.exitApp();
  }catch(error){if(status)status.textContent='خطا در ذخیره یا خروج؛ دوباره تلاش کنید.';return false;}
 },true);
};
var lastTarget=null,lastTime=0,approved=null;
['click','submit','change'].forEach(function(ev){document.addEventListener(ev,function(e){if(e.target&&e.target.closest&&e.target.closest('[data-hn-dialog]'))return;lastTarget=e.target;lastTime=Date.now()},true)});
window.confirm=function(m){
 m=String(m==null?'':m);
 if(m==='آیا می‌خواهید از برنامه خارج شوید؟'){window.__hesabnoConfirmExit();return false;}
 if(approved===m){approved=null;return true}
 var tgt=lastTarget,fresh=tgt&&Date.now()-lastTime<4000&&document.contains(tgt);
 if(!fresh)return nConfirm?nConfirm(m):true;
 dlg(m,true,function(yes){if(!yes)return;approved=m;try{if(tgt.tagName==='FORM'&&tgt.requestSubmit)tgt.requestSubmit();else tgt.click()}finally{setTimeout(function(){if(approved===m)approved=null},500)}});
 return false;
};

/* پشتیبان دستی: پذیرش درخواست به معنی ذخیره‌شدن فایل نیست. */
var manualBackupCallbacks=Object.create(null),manualBackupSequence=0;
window.__hesabnoOnManualBackupResult=function(id,status,name){
 var callback=manualBackupCallbacks[id];
 if(!callback)return;
 delete manualBackupCallbacks[id];
 callback(status==='saved'?'saved':status==='cancelled'?'cancelled':'error',name);
};
window.__hesabnoSaveManualBackup=function(name,json,callback){
 var id='manual-'+Date.now()+'-'+(++manualBackupSequence);
 manualBackupCallbacks[id]=callback;
 try{
  if(window.HnBridge&&typeof window.HnBridge.saveManualBackup==='function'&&window.HnBridge.saveManualBackup(name,json,id)===true)return true;
 }catch(error){try{console.warn('[hesabno] manual backup:',error)}catch(_){}}
 delete manualBackupCallbacks[id];
 callback('error');
 return false;
};

/* 3) ذخیرهٔ فایل پشتیبان داخل اپ اندروید (Capacitor) */
var blobs={},oCreate=URL.createObjectURL;
URL.createObjectURL=function(o){var u=oCreate.apply(URL,arguments);try{if(o instanceof Blob)blobs[u]=o}catch(e){try{console.warn("[hesabno]",e)}catch(_){}}return u};
var oRevoke=URL.revokeObjectURL;URL.revokeObjectURL=function(u){try{delete blobs[u]}catch(e){try{console.warn("[hesabno]",e)}catch(_){}}return oRevoke.apply(URL,arguments)};
function isNative(){var C=window.Capacitor;return !!(C&&(C.isNativePlatform?C.isNativePlatform():C.isNative))}
function hasBridge(){try{return !!(window.HnBridge&&typeof window.HnBridge.saveBackup==='function')}catch(e){return false}}
function saveNative(a){
 var blob=blobs[a.href],name=a.getAttribute('download')||('hesabno-'+Date.now()+'.json');if(!blob)return false;
 var P=window.Capacitor?window.Capacitor.Plugins||{}:{},FS=P.Filesystem;
 delete blobs[a.href];
 var rd=new FileReader();
 rd.onload=function(){
 var data=String(rd.result).split(',')[1];
 if(hasBridge()){try{window.HnBridge.saveBackup(name,data);}catch(e){try{console.warn("[hesabno]",e)}catch(_){}}}
 else if(FS){
  FS.writeFile({path:name,data:data,directory:'DOCUMENTS',recursive:true}).then(function(res){
   if(P.Share&&res&&res.uri){P.Share.share({title:name,url:res.uri}).catch(function(){})}
   window.alert('فایل پشتیبان ذخیره شد:\nپوشهٔ Documents / '+name);
  }).catch(function(err){window.alert('ذخیرهٔ فایل پشتیبان انجام نشد. لطفاً دوباره تلاش کنید.\n'+(err&&err.message||''))});
 }else{window.alert('ذخیرهٔ فایل در این نسخه ممکن نیست.');}
 };
 rd.onerror=function(){window.alert('ذخیرهٔ فایل پشتیبان انجام نشد. لطفاً دوباره تلاش کنید.')};
 rd.readAsDataURL(blob);return true;
}
var oClick=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){if((isNative()||hasBridge())&&this.hasAttribute('download')&&/^blob:/.test(this.href)&&saveNative(this))return;return oClick.apply(this,arguments)};
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[download]');if(a&&(isNative()||hasBridge())&&/^blob:/.test(a.href)&&saveNative(a))e.preventDefault()},true);
})();
