(function(){
var LBL='بازیابی و معادل‌سازی';
function J(k,d){try{var v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}}
var GM={expense:'expense',income:'income',cash:'cash',bank:'bank',debtor:'person',creditor:'person',person:'person',asset:'asset',liability:'liability',capital:'equity',other:'asset'};
function importData(out){
 var accs=J('hesabno:accounts_v5',[]);if(!Array.isArray(accs))accs=[];
 var txs=J('hesabno:transactions',[]);if(!Array.isArray(txs))txs=[];
 var hById={};accs.forEach(function(a){hById[String(a.id)]=a});
 var pById={};(out.accounts||[]).forEach(function(a){pById[String(a.id)]=a});
 var names={};accs.forEach(function(a){names[(a.name||'').trim()]=a});
 var seq=Date.now(),code=9000,newA=0,newT=0,skip=0;
 function resolve(id){
  if(id==null)return null;var s=String(id);
  if(s.indexOf('h:')===0){var h=hById[s.slice(2)];return h?{name:h.name,group:h.group}:null}
  var p=pById[s];if(!p)return null;var g=GM[p.group]||'asset',nm=(p.title||'حساب پارمیس').trim();
  if(!names[nm]){var a={id:++seq,group:g,code:String(++code),name:nm,picture:g==='bank'?'Landmark':g==='cash'?'Banknote':g==='income'?'TrendingUp':g==='person'?'User':'TrendingDown',parentId:null,active:true,pinned:false,system:false};accs.push(a);names[nm]=a;newA++}
  return {name:nm,group:names[nm].group};
 }
 var seen={};txs.forEach(function(t){if(t&&t.importRef)seen[t.importRef]=1});
 (out.transactions||[]).forEach(function(t,i){
  var ref='parmis:'+(out.meta&&out.meta.importId||'')+':'+t.id;if(seen[ref]){skip++;return}
  var f=resolve(t.fromAccountId),to=resolve(t.toAccountId);if(!f&&!to||!(t.amount>0))return;
  var type=t.type==='expense'||t.type==='income'||t.type==='transfer'?t.type:(to&&to.group==='expense'?'expense':f&&f.group==='income'?'income':'transfer');
  var account,cat,dest;
  if(type==='expense'){account=f&&f.name;cat=to&&to.name}else if(type==='income'){account=to&&to.name;cat=f&&f.name}else{account=f&&f.name;dest=to&&to.name;cat=dest}
  var title=(t.description||'').trim()||((type==='expense'?'هزینه ':type==='income'?'درآمد ':'انتقال ')+(cat||''));
  txs.push({id:seq+1000+i,documentNumber:Number(t.serial)||i+1,title:title,category:cat||'متفرقه',amount:Number(t.amount),date:t.date,type:type,account:account||'حساب اصلی',destinationAccount:type==='transfer'?dest:undefined,notes:t.status==='pending'?'در انتظار (پارمیس)':undefined,importRef:ref});
  newT++;
 });
 localStorage.setItem('hesabno:accounts_v5',JSON.stringify(accs));
 localStorage.setItem('hesabno:transactions',JSON.stringify(txs));
 return {newA:newA,newT:newT,skip:skip};
}
function openImporter(){
 if(document.getElementById('hn-parmis-ov'))return;
 var ov=document.createElement('div');ov.id='hn-parmis-ov';ov.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#0c0a09;display:flex;flex-direction:column;direction:rtl;font-family:Vazirmatn,Tahoma,sans-serif';
 var bar=document.createElement('div');bar.style.cssText='display:flex;align-items:center;gap:10px;padding:10px 14px;background:#1c1917;color:#fff;border-bottom:1px solid #292524';
 var back=document.createElement('button');back.textContent='→ بازگشت';back.style.cssText='min-height:40px;padding:0 14px;border-radius:12px;border:0;background:#7c3aed;color:#fff;font-family:inherit;font-size:15px';back.onclick=function(){ov.remove()};
 var t=document.createElement('b');t.textContent='ورود اطلاعات از پارمیس';bar.appendChild(back);bar.appendChild(t);
 var wrap=document.createElement('div');wrap.style.cssText='flex:1;overflow-y:auto;padding:16px';
 var card=document.createElement('div');card.style.cssText='max-width:560px;margin:0 auto';
 card.innerHTML='<div style="font-weight:800;font-size:14px;margin-bottom:6px">فایل پشتیبان پارمیس</div><div style="font-size:12px;opacity:.8;line-height:1.9;margin-bottom:12px">فایل پشتیبان پارمیس به فرمت JSON را انتخاب کنید؛ حساب‌ها بر اساس نام با حساب‌های My Money معادل‌سازی و همه‌ی تراکنش‌ها منتقل می‌شوند.</div>';
 var status=document.createElement('div');status.style.cssText='min-height:1.6em;font-size:12px;color:#fca5a5;margin-bottom:10px';
 var pick=document.createElement('button');pick.type='button';pick.textContent='انتخاب فایل پشتیبان (JSON)';pick.style.cssText='width:100%;min-height:48px;border-radius:14px;border:0;background:#7c3aed;color:#fff;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer';
 var input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.style.display='none';
 input.addEventListener('change',function(){
  var f=input.files&&input.files[0];if(!f)return;
  status.textContent='';
  var reader=new FileReader();
  reader.onload=function(){
   var out=null;
   try{out=JSON.parse(String(reader.result));}catch(e){status.textContent='خطا: فایل JSON معتبر نیست.';return}
   var r=importData(out);
   ov.remove();
   alert('ورود اطلاعات پارمیس انجام شد.\n'+r.newT+' تراکنش و '+r.newA+' حساب جدید ثبت شد.'+(r.skip?'\n'+r.skip+' تراکنش تکراری نادیده گرفته شد.':''));
   setTimeout(function(){location.reload()},1500);
  };
  reader.onerror=function(){status.textContent='خطا در خواندن فایل.';};
  reader.readAsText(f);
 });
 pick.addEventListener('click',function(){input.click();});
 var note=document.createElement('div');note.style.cssText='font-size:11px;opacity:.75;line-height:1.9;border-top:1px solid #7c3aed33;padding-top:10px;margin-top:12px';
 note.textContent='فایل‌های .par با فرمت SQLite را از ابزار «ورود از فایل پشتیبان» خود برنامه (بخش «بیشتر») وارد کنید؛ آن ابزار از همین پایگاه داده پشتیبانی می‌کند.';
 card.appendChild(status);card.appendChild(pick);card.appendChild(input);card.appendChild(note);
 wrap.appendChild(card);
 ov.appendChild(bar);ov.appendChild(wrap);document.body.appendChild(ov);
}
window.hesabnoOpenParmisImporter=openImporter;
function tick(){
 var btn=null,bs=document.querySelectorAll('button');for(var i=0;i<bs.length;i++){if(bs[i].textContent.trim()===LBL){btn=bs[i];break}}
 var card=document.getElementById('hn-parmis-card');
 var active=btn&&btn.className.indexOf('bg-purple-600')>-1;
 if(!active){if(card)card.remove();return}
 if(card)return;
 var bar=btn.parentElement;if(!bar||!bar.parentElement)return;
 var sc=null,root=bar;for(var _i=0;_i<4&&!sc&&root;_i++){root=root.parentElement;if(!root)break;try{sc=root.querySelector('div[class*="overflow-y-auto"]')}catch(e){try{console.warn("[hesabno]",e)}catch(_){}}}
 if(!sc)return;
 card=document.createElement('div');card.id='hn-parmis-card';card.style.cssText='margin:12px 0;padding:14px;border-radius:16px;border:1px solid #7c3aed55;background:#7c3aed1a;direction:rtl;font-family:inherit';
 card.innerHTML='<div style="font-weight:800;font-size:14px;margin-bottom:6px">ورود از فایل پشتیبان پارمیس (.par)</div><div style="font-size:12px;opacity:.8;line-height:1.9;margin-bottom:10px">فایل پشتیبان پارمیس را انتخاب کنید، حساب‌ها را با حساب‌های My Money معادل‌سازی کنید و همه تراکنش‌ها را منتقل کنید.</div>';
 var b=document.createElement('button');b.type='button';b.textContent='باز کردن ابزار ورود پارمیس';b.style.cssText='width:100%;min-height:44px;border-radius:12px;border:0;background:#7c3aed;color:#fff;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer';b.onclick=openImporter;card.appendChild(b);
 sc.insertBefore(card,sc.firstChild);
}
function start(){window.__hesabnoDom.watch(document.body, {childList:true,subtree:true,attributes:true,attributeFilter:['class']}, tick);tick()}
if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();
