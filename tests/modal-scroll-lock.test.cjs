const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
function setup(){
 const dom=new JSDOM('<!doctype html><html><body><main id="page" style="overflow-y:auto; height:100px"><button>Open</button></main><div id="modal" role="dialog" style="position:fixed;z-index:100"><div id="scroller" style="overflow-y:auto;height:100px"><p id="content">Dialog content</p></div></div></body></html>',{url:'https://app.test/',runScripts:'outside-only'});
 const w=dom.window;w.__hesabnoDom={watch(){}};
 const page=w.document.getElementById('page'),scroller=w.document.getElementById('scroller');
 for(const el of [page,scroller]){Object.defineProperty(el,'scrollHeight',{value:500});Object.defineProperty(el,'clientHeight',{value:100});}
 page.scrollTop=123;
 w.eval(fs.readFileSync('app/src/main/assets/src/scripts/227-modal-scroll-lock.js','utf8'));
 const wheel=(el,delta)=>{const e=new w.WheelEvent('wheel',{deltaY:delta,bubbles:true,cancelable:true});el.dispatchEvent(e);return e.defaultPrevented;};
 return{dom,w,page,scroller,modal:w.document.getElementById('modal'),wheel};
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
test('dialog contents scroll normally but cannot chain through either edge into the background',()=>{
 const h=setup();try{
 h.scroller.scrollTop=50;assert.equal(h.wheel(h.scroller,40),false);assert.equal(h.wheel(h.scroller,-40),false);
 h.scroller.scrollTop=0;assert.equal(h.wheel(h.scroller,-40),true);
 h.scroller.scrollTop=400;assert.equal(h.wheel(h.scroller,40),true);
 assert.equal(h.wheel(h.modal,40),true);
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
 function touch(type,target,y){const e=new h.w.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:[{clientY:y}]});target.dispatchEvent(e);return e.defaultPrevented;}
 touch('touchstart',h.page,100);assert.equal(touch('touchmove',h.page,70),true);
 h.scroller.scrollTop=30;touch('touchstart',h.scroller,100);assert.equal(touch('touchmove',h.scroller,70),false);
 }finally{h.dom.window.close();}
});
