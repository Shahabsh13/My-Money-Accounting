const path=require('path');
const {JSDOM,VirtualConsole}=require('jsdom');
const ASSETS=path.join(path.resolve(__dirname,'..','..'),'app/src/main/assets');
(async()=>{
  const dom=await JSDOM.fromFile(path.join(ASSETS,'index.html'),{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:new VirtualConsole(),url:'http://127.0.0.1:8080/index.html'});
  const w=dom.window;
  await new Promise(res=>{const iv=setInterval(()=>{const r=w.document.getElementById('root');if(r&&r.innerHTML.length>2000){clearInterval(iv);res();}},25);});
  const mo=new w.MutationObserver(()=>{mo.n++;});
  let mut=0; mo.n=0;
  const obs=new w.MutationObserver(list=>{mut+=list.length;});
  obs.observe(w.document.getElementById('root')||w.document.body,{childList:true,subtree:true,attributes:true});
  let raf=0; const real=w.requestAnimationFrame.bind(w); w.requestAnimationFrame=cb=>{raf++;return real(cb);};
  const win=async(ms)=>{mut=0;raf=0;await new Promise(r=>setTimeout(r,ms));return {mutations:mut,raf,ms};};
  const first=await win(3000);
  await new Promise(r=>setTimeout(r,2000));
  const second=await win(3000);
  // تعداد observerهای زنده‌ی برنامه (تقریبی): با شمارش نمونه‌سازی‌ها
  const srcs=require('fs').readdirSync(path.join(ASSETS,'src/scripts'));
  let moCount=0; for(const f of srcs) moCount += (require('fs').readFileSync(path.join(ASSETS,'src/scripts',f),'utf8').match(/new MutationObserver/g)||[]).length;
  console.log(JSON.stringify({duringStartup:{mutationsPerSec:+(first.mutations/3).toFixed(1),rafPerSec:+(first.raf/3).toFixed(1)},
    duringIdle:{mutationsPerSec:+(second.mutations/3).toFixed(1),rafPerSec:+(second.raf/3).toFixed(1)},
    mutationObserversDeclaredInCode:moCount},null,2));
  process.exit(0);
})();
