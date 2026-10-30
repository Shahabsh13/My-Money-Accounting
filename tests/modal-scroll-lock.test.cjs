const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
function setup(){
 const dom=new JSDOM('<!doctype html><html><body><main id="page" style="overflow-y:auto; height:100px"><button>Open</button></main><div id="modal" role="dialog" style="position:fixed;z-index:100"><div id="scroller" style="overflow-y:auto;height:100px"><div id="horizontal" style="overflow-x:auto;width:100px"><span>Wide category row</span></div><p id="content">Dialog content</p></div></div></body></html>',{url:'https://app.test/',runScripts:'outside-only'});
 const w=dom.window;w.__hesabnoDom={watch(){}};
 const page=w.document.getElementById('page'),scroller=w.document.getElementById('scroller'),horizontal=w.document.getElementById('horizontal');
 for(const el of [page,scroller]){Object.defineProperty(el,'scrollHeight',{value:500});Object.defineProperty(el,'clientHeight',{value:100});}
 Object.defineProperty(horizontal,'scrollWidth',{value:300});Object.defineProperty(horizontal,'clientWidth',{value:100});
 page.scrollTop=123;
 w.eval(fs.readFileSync('app/src/main/assets/src/scripts/227-modal-scroll-lock.js','utf8'));
 const wheel=(el,deltaY,deltaX=0)=>{const e=new w.WheelEvent('wheel',{deltaX,deltaY,bubbles:true,cancelable:true});el.dispatchEvent(e);return e.defaultPrevented;};
 return{dom,w,page,scroller,horizontal,modal:w.document.getElementById('modal'),wheel};
}
test('modal locks document and nested background scroll, retaining the exact position and original overflow styles',()=>{
 const h=setup();try{
 assert.equal(h.w.document.body.style.overflow,'hidden');assert.equal(h.page.style.overflow,'hidden');
 assert.equal(h.wheel(h.page,50),true);assert.equal(h.page.scrollTop,123);
 h.modal.remove();h.w.__hesabnoSyncModalScrollLock();
 assert.equal(h.w.document.body.style.overflow,'');assert.equal(h.page.style.overflowY,'auto');
 assert.equal(h.page.scrollTop,123);assert.equal(h.wheel(h.page,50),false);
 }finally{h.dom.window.close();}
});
test('aria-hidden decorative full-screen ghosts never acquire the modal scroll lock',()=>{
 const h=setup();try{
 const ghost=h.w.document.createElement('div');
 ghost.className='fixed inset-0';ghost.setAttribute('aria-hidden','true');
 ghost.style.cssText='position:fixed;inset:0;z-index:999;opacity:0;pointer-events:none';
 h.w.document.body.appendChild(ghost);h.w.__hesabnoSyncModalScrollLock();
 assert.equal(h.wheel(h.page,50),true,'the real dialog remains active while the decorative ghost is present');
 h.modal.remove();h.w.__hesabnoSyncModalScrollLock();
 assert.equal(h.w.document.body.style.overflow,'','closing the real dialog should unlock the page');
 assert.equal(h.wheel(h.page,50),false,'an aria-hidden exit ghost must not relock the page');
 }finally{h.dom.window.close();}
});

test('dialog contents scroll normally but cannot chain through either edge into the background',()=>{
 const h=setup();try{
 h.scroller.scrollTop=50;assert.equal(h.wheel(h.scroller,40),false);assert.equal(h.wheel(h.scroller,-40),false);
 h.scroller.scrollTop=0;assert.equal(h.wheel(h.scroller,-40),true);
 h.scroller.scrollTop=400;assert.equal(h.wheel(h.scroller,40),true);
 assert.equal(h.wheel(h.modal,40),true);
 }finally{h.dom.window.close();}
});
test('horizontal nested controls stay swipeable while the modal blocks background scroll',()=>{
 const h=setup();try{
 assert.equal(h.wheel(h.horizontal,0,40),false,'horizontal wheel should scroll the category strip');
 assert.equal(h.wheel(h.scroller,0,40),true,'horizontal movement outside a horizontal scroller must not leak to the page');
 function touch(type,target,x,y){const e=new h.w.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:[{clientX:x,clientY:y}]});target.dispatchEvent(e);return e.defaultPrevented;}
 touch('touchstart',h.horizontal,180,100);
 assert.equal(touch('touchmove',h.horizontal,120,102),false,'horizontal touch swipes in the category strip must not be cancelled');
 }finally{h.dom.window.close();}
});
test('closing a nested dialog keeps the page locked until the last dialog is closed',()=>{
 const h=setup();try{
 const nested=h.w.document.createElement('div');nested.setAttribute('role','dialog');nested.style.zIndex='200';h.w.document.body.appendChild(nested);
 h.w.__hesabnoSyncModalScrollLock();assert.equal(h.wheel(h.scroller,40),true);
 nested.remove();h.w.__hesabnoSyncModalScrollLock();
 assert.equal(h.page.style.overflow,'hidden');assert.equal(h.wheel(h.scroller,40),false);
 h.modal.hidden=true;h.w.__hesabnoSyncModalScrollLock();assert.equal(h.page.style.overflowY,'auto');
 }finally{h.dom.window.close();}
});
test('touch swipes on the backdrop are cancelled while dialog scroll gestures are retained',()=>{
 const h=setup();try{
 function touch(type,target,x,y){const e=new h.w.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:[{clientX:x,clientY:y}]});target.dispatchEvent(e);return e.defaultPrevented;}
 touch('touchstart',h.page,100,100);assert.equal(touch('touchmove',h.page,100,70),true);
 h.scroller.scrollTop=30;touch('touchstart',h.scroller,100,100);assert.equal(touch('touchmove',h.scroller,100,70),false);
 }finally{h.dom.window.close();}
});
