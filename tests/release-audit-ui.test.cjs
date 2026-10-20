const {test}=require('node:test');
const assert=require('node:assert/strict');
const {bootApp,closeApp,buttonByText,wait}=require('./helpers/app-boot.cjs');
test('live notification UI preserves unread when merely opened and read-all clears the bell',async()=>{
 const dom=await bootApp({storage:{'hesabno:first_run_intro_done':'true','hesabno:first_run_profile_done':'true'}});
 try{
  const w=dom.window,d=w.document;
  const n=w.HnNotificationCenter.add({title:'اعلان بررسی انتشار',body:'آزمون خواندن',target:'home'});
  await wait(150);
  let bell=d.querySelector('button[aria-label="مرکز اعلان‌ها و یادآوری‌ها"]');assert.ok(bell);assert.ok(bell.querySelector('.animate-pulse'));
  bell.click();await wait(100);
  assert.equal(w.HnNotificationCenter.list().find(x=>x.id===n.id).read,false);
  const all=buttonByText(d,'خواندن همه');assert.ok(all);all.click();await wait(100);
  assert.equal(w.HnNotificationCenter.list().find(x=>x.id===n.id).read,true);
  bell=d.querySelector('button[aria-label="مرکز اعلان‌ها و یادآوری‌ها"]');assert.equal(bell.querySelector('.animate-pulse'),null);
 }finally{closeApp(dom);}
});
