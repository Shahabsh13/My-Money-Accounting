const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const root='app/src/main/assets/';
test('first-run permissions have short copy, four accessible switches and no focus jump to the footer',()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://app.test/',runScripts:'outside-only'});
 try{
  const w=dom.window;w.localStorage.setItem('hesabno:first_run_profile_done','1');
  w.eval(fs.readFileSync(root+'src/scripts/217-hesabno-first-run-profile.js','utf8'));
  const overlay=w.__hesabnoOpenFirstRunWizard('restore'),card=overlay.querySelector('form');
  overlay.querySelector('[data-hesabno-fr-go-profile]').click();
  overlay.querySelector('#hesabno-fr-first').value='علی';overlay.querySelector('#hesabno-fr-last').value='رضایی';
  card.scrollTop=300;
  card.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'permissions');
  assert.equal(card.scrollTop,0);assert.equal(w.document.activeElement.textContent,'دسترسی‌های برنامه');
  const view=overlay.querySelector('[data-hesabno-fr-view="permissions"]');
  assert.ok(view.querySelector('.hesabno-fr-sub').textContent.length<45);
  assert.equal(view.querySelectorAll('[role="switch"]').length,4);
  for(const key of ['biometrics','clipboard']) assert.equal(view.querySelector(`[data-hesabno-fr-perm-key="${key}"]`),null);
  for(const el of view.querySelectorAll('[role="switch"]'))assert.ok(el.getAttribute('aria-label'));
  for(const el of view.querySelectorAll('.hesabno-fr-perm-reason'))assert.ok(el.textContent.length<45);
  assert.equal(view.querySelectorAll('.hesabno-fr-permissions-nav button').length,2);
  assert.equal(view.querySelector('[data-hesabno-fr-skip-perms]'),null);
  assert.equal(view.querySelector('[data-hesabno-fr-grant-all]'),null);
  const previous=view.querySelector('[data-hesabno-fr-back-profile]');
  assert.equal(previous.textContent,'قبلی');previous.click();
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'profile');
  card.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(view.querySelector('[data-hesabno-fr-next-from-perms]').textContent,'بعدی');
  view.querySelector('[data-hesabno-fr-next-from-perms]').click();
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'preferences');
 }finally{dom.window.close();}
});
test('compact onboarding uses a viewport-bounded card and a single scroll container',()=>{
 const {parseCss}=require('../tools/bench/css-parser.cjs');
 const {rules}=parseCss(fs.readFileSync(root+'src/styles/235-hesabno-text-root-and-display-stability.css','utf8'));
 const rule=selector=>rules.find(r=>r.selector===selector).body;
 assert.match(rule('#hesabno-first-run .hesabno-fr-card'),/overflow-y:\s*auto/);
 assert.match(rule('#hesabno-first-run .hesabno-fr-card'),/max-height:\s*100%/);
 assert.match(rule('#hesabno-first-run .hesabno-fr-perms-list'),/max-height:\s*none/);
 assert.match(rule('#hesabno-first-run .hesabno-fr-perms-list'),/overflow:\s*visible/);
});
test('shared application shell does not render a duplicate mock phone status bar',()=>{
 const shell=fs.readFileSync(root+'src/scripts/067-inline.js','utf8');
 assert.ok(!shell.includes('children:"۱۰:۴۵"'),'no hard-coded mock clock');
 assert.ok(!shell.includes('children:"۹۸٪"'),'no hard-coded mock battery');
 assert.ok(!shell.includes('children:"5G"'),'no hard-coded mock network');
 assert.ok(!shell.includes('w-16 h-4 rounded-full bg-stone-950 mx-auto'),'no mock camera cutout');
});
test('light-theme income and expense colors stay vivid and readable on pale backgrounds',()=>{
 const css=fs.readFileSync(root+'src/styles/020-core-fixes.css','utf8');
 const luminance=hex=>{const c=hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
 for(const [name,color] of [['emerald','007b40'],['rose','c91c36']]){
  assert.ok(css.includes(`.text-${name}-300 { color: #${color} !important; }`));
  assert.ok((luminance('e4eef4')+.05)/(luminance(color)+.05)>=4.5,'small amounts retain 4.5:1 contrast');
 }
});
test('Drive fallback explains website download instead of silently opening local files',()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://app.test/',runScripts:'outside-only'});
 try{
 const w=dom.window;w.localStorage.setItem('hesabno:first_run_profile_done','1');
 w.eval(fs.readFileSync(root+'src/scripts/217-hesabno-first-run-profile.js','utf8'));
 const overlay=w.__hesabnoOpenFirstRunWizard('restore');let fileClicks=0,opened='';
 overlay.querySelector('input[type="file"]').click=()=>fileClicks++;
 w.confirm=()=>true;w.open=url=>{opened=url;};
 overlay.querySelector('[data-hesabno-fr-gdrive-btn]').click();
 assert.equal(fileClicks,0);assert.equal(opened,'https://drive.google.com/');
 overlay.querySelector('[data-hesabno-fr-file-btn]').click();assert.equal(fileClicks,1);
 }finally{dom.window.close();}
});
test('native Drive picker is visible to Android and uses an explained web fallback',()=>{
 const java=fs.readFileSync('app/src/main/java/com/maymoney/app/MainActivity.java','utf8');
 const method=java.slice(java.indexOf('public boolean pickCloudBackupToRestore()'),java.indexOf('private void showCloudDriveWebsiteFallback()'));
 assert.ok(method.includes('driveIntent.setPackage("com.google.android.apps.docs")'));
 assert.ok(!method.includes('ACTION_OPEN_DOCUMENT'));
 assert.ok(method.includes('showCloudDriveWebsiteFallback()'));
 assert.match(fs.readFileSync('app/src/main/AndroidManifest.xml','utf8'),/<queries>[\s\S]*com.google.android.apps.docs[\s\S]*<\/queries>/);
});
test('daily reminders schedule natively on save, resume and after delivery, boot or clock changes',()=>{
 const java=fs.readFileSync('app/src/main/java/com/maymoney/app/MainActivity.java','utf8');
 const save=java.slice(java.indexOf('public boolean saveDailyReminderConfig'),java.indexOf('public boolean scheduleInactivityReminder'));
 assert.ok(save.includes('scheduleDailyReminder(MainActivity.this)'));
 const scheduling=java.slice(java.indexOf('public static void scheduleDailyReminder'),java.indexOf('public static final String ACTION_INACTIVITY_REMINDER'));
 assert.ok(scheduling.includes('alarms.cancel(pending)'));
 assert.ok(scheduling.includes('next.add(java.util.Calendar.DATE, 1)'));
 assert.ok(scheduling.includes('alarms.setAndAllowWhileIdle'));
 assert.ok(scheduling.includes('postStaticNotification(context,'));
 for(const action of ['ACTION_BOOT_COMPLETED','ACTION_TIME_CHANGED','ACTION_TIMEZONE_CHANGED','ACTION_MY_PACKAGE_REPLACED'])assert.ok(scheduling.includes(action));
 assert.match(fs.readFileSync('app/src/main/AndroidManifest.xml','utf8'),/DailyReminderReceiver" android:exported="false"/);
});
test('account lists keep pinned quick-access panels but omit root-code labels',()=>{
 const shell=fs.readFileSync(root+'src/scripts/067-inline.js','utf8');
 assert.ok(!shell.includes('کد ریشه'));
 assert.ok(shell.includes('سنجاق‌شده‌ها (دسترسی سریع)'));
 assert.ok(shell.includes('افزودن حساب جدید'),'account creation remains available');
});
test('default cash unpin migration preserves other pins and allows later manual repinning',()=>{
 const dom=new JSDOM('',{url:'https://app.test/',runScripts:'outside-only'});
 try{
 const w=dom.window,code=fs.readFileSync(root+'src/scripts/000c-unpin-default-cash.js','utf8');
 const accounts=[{id:201,group:'cash',code:'11001',pinned:true},{id:202,group:'cash',code:'11002',pinned:true},{id:203,group:'bank',code:'12001',pinned:true}];
 w.localStorage.setItem('hesabno:accounts_v5',JSON.stringify(accounts));w.eval(code);
 const result=JSON.parse(w.localStorage.getItem('hesabno:accounts_v5'));
 assert.deepEqual(result.map(a=>a.pinned),[false,true,true]);
 result[0].pinned=true;w.localStorage.setItem('hesabno:accounts_v5',JSON.stringify(result));w.eval(code);
 assert.equal(JSON.parse(w.localStorage.getItem('hesabno:accounts_v5'))[0].pinned,true);
 }finally{dom.window.close();}
});
test('profile onboarding has one short heading, no branding or progress copy, and two navigation actions',()=>{
 const dom=new JSDOM('',{url:'https://app.test/',runScripts:'outside-only'});
 try{
  const w=dom.window;w.localStorage.setItem('hesabno:first_run_profile_done','1');
  w.eval(fs.readFileSync(root+'src/scripts/217-hesabno-first-run-profile.js','utf8'));
  const overlay=w.__hesabnoOpenFirstRunWizard('profile'),profile=overlay.querySelector('[data-hesabno-fr-view="profile"]');
  assert.equal(overlay.querySelector('.hesabno-fr-brand'),null);assert.equal(overlay.querySelector('.hesabno-fr-glow'),null);
  assert.equal(overlay.querySelector('.hesabno-fr-step'),null);assert.equal(profile.querySelector('h1').textContent,'مشخصات شما');
  assert.equal(profile.querySelector('.hesabno-fr-sub').textContent,'');
  assert.deepEqual([...profile.querySelectorAll('.hesabno-fr-permissions-nav button')].map(el=>el.textContent),['قبلی','بعدی']);
  assert.equal(profile.querySelectorAll('input').length,3);
 }finally{dom.window.close();}
});
