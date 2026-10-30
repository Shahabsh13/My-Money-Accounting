const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const root='app/src/main/assets/';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const waitForStepMotion=()=>wait(280);
test('first-run intro offers Skip on all four slides while Next remains available',()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://app.test/',runScripts:'outside-only'});
 try{
  const w=dom.window;w.eval(fs.readFileSync(root+'src/scripts/217-hesabno-first-run-profile.js','utf8'));
  const intro=w.document.getElementById('hesabno-intro-tour');
  assert.ok(intro,'first launch begins with the intro pages');
  assert.ok(intro.querySelector('[data-intro-skip]'),'first launch must offer a Skip control alongside Next');
  assert.deepEqual([...intro.querySelector('.intro-actions').children].map(button=>button.textContent),['رد کردن','بعدی ←'],
   'in the RTL action row, Skip is the right-hand action and Next is the left-hand action');
  assert.equal(w.localStorage.getItem('hesabno:first_run_profile_in_progress'),'onboarding');
  assert.equal(w.localStorage.getItem('hesabno:first_run_profile_done'),null,'intro completion alone must not enter the app');
  const next=intro.querySelector('[data-intro-next]');
  assert.equal(next.textContent,'بعدی ←');
  for(let page=1;page<4;page++){
   next.click();
   assert.ok(w.document.getElementById('hesabno-intro-tour'),'Next advances within the intro until the final page');
   assert.ok(w.document.querySelector('#hesabno-intro-tour [data-intro-skip]'),'Skip remains available on each of the four intro slides');
   assert.equal(w.document.getElementById('hesabno-first-run'),null);
  }
  next.click();
  assert.equal(w.document.getElementById('hesabno-intro-tour'),null);
  assert.ok(w.document.getElementById('hesabno-first-run'),'only the final Next opens the mandatory profile setup');
  assert.equal(w.localStorage.getItem('hesabno:first_run_profile_done'),null,'setup is still required after the intro');
 }finally{dom.window.close();}
});
test('Skip from any of the four intro slides opens mandatory setup without entering the app',()=>{
 for(let slide=0;slide<4;slide++){
  const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://app.test/',runScripts:'outside-only'});
  try{
   const w=dom.window;w.eval(fs.readFileSync(root+'src/scripts/217-hesabno-first-run-profile.js','utf8'));
   let intro=w.document.getElementById('hesabno-intro-tour');
   for(let page=0;page<slide;page++)intro.querySelector('[data-intro-next]').click();
   assert.ok(intro.querySelector('[data-intro-skip]'),`slide ${slide+1} must have Skip`);
   intro.querySelector('[data-intro-skip]').click();
   assert.equal(w.document.getElementById('hesabno-intro-tour'),null);
   const setup=w.document.getElementById('hesabno-first-run');
   assert.ok(setup,`Skip on slide ${slide+1} should continue to mandatory setup`);
   assert.equal(setup.querySelector('.hesabno-fr-card').getAttribute('data-hesabno-fr-active-step'),'restore');
   assert.equal(w.localStorage.getItem('hesabno:first_run_intro_done'),'1');
   assert.equal(w.localStorage.getItem('hesabno:first_run_profile_done'),null,'Skip must not bypass profile setup');
  }finally{dom.window.close();}
 }
});
test('backup restore still requires Next through profile, permissions and preferences before app entry',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://app.test/',runScripts:'outside-only'});
 try{
  const w=dom.window;w.localStorage.setItem('hesabno:first_run_intro_done','1');
  w.eval(fs.readFileSync(root+'src/scripts/217-hesabno-first-run-profile.js','utf8'));
  const overlay=w.document.getElementById('hesabno-first-run'),card=overlay.querySelector('.hesabno-fr-card');
  const profile=JSON.stringify({firstName:'مریم',lastName:'موسوی'});
  const backup={storageData:{'hesabno:user_profile':profile,'hesabno:first_run_profile_done':'1'}};
  assert.equal(w.__hesabnoFirstRunApplyBackup(JSON.stringify(backup)),true);
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'restore','restoring data does not skip the restore page Next');
  assert.equal(w.localStorage.getItem('hesabno:first_run_profile_done'),null,'a backup cannot mark onboarding complete');
  overlay.querySelector('[data-hesabno-fr-go-profile]').click();
  await waitForStepMotion();
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'profile');
  assert.equal(overlay.querySelector('#hesabno-fr-first').value,'مریم');
  assert.equal(overlay.querySelector('#hesabno-fr-last').value,'موسوی');
  card.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await waitForStepMotion();
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'permissions');
  assert.equal(overlay.querySelector('[data-hesabno-fr-next-from-perms]').textContent,'بعدی');
  overlay.querySelector('[data-hesabno-fr-next-from-perms]').click();
  await waitForStepMotion();
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'preferences','permissions Next cannot bypass preferences');
  assert.equal(w.document.getElementById('hesabno-first-run'),overlay,'the app remains blocked until final confirmation');
  assert.equal(w.localStorage.getItem('hesabno:first_run_profile_done'),null);
  overlay.querySelector('[data-hesabno-fr-finish]').click();
  assert.equal(w.document.getElementById('hesabno-first-run'),null);
  assert.equal(w.localStorage.getItem('hesabno:first_run_profile_done'),'1');
  assert.equal(w.localStorage.getItem('hesabno:first_run_profile_in_progress'),null);
 }finally{dom.window.close();}
});
test('a rapid second Next tap cannot skip the permission step',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://app.test/',runScripts:'outside-only'});
 try{
  const w=dom.window;w.localStorage.setItem('hesabno:first_run_profile_done','1');
  w.eval(fs.readFileSync(root+'src/scripts/217-hesabno-first-run-profile.js','utf8'));
  const overlay=w.__hesabnoOpenFirstRunWizard('restore'),card=overlay.querySelector('.hesabno-fr-card');
  overlay.querySelector('[data-hesabno-fr-go-profile]').click();
  await waitForStepMotion();
  overlay.querySelector('#hesabno-fr-first').value='علی';
  overlay.querySelector('#hesabno-fr-last').value='رضایی';
  card.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'permissions');
  const next=overlay.querySelector('[data-hesabno-fr-next-from-perms]');
  next.click();
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'permissions','an accidental second tap during the transition is ignored');
  assert.equal(card.getAttribute('aria-busy'),'true');
  await waitForStepMotion();
  assert.equal(card.hasAttribute('aria-busy'),false);
  next.click();
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'preferences','Next works again after the short transition guard');
 }finally{dom.window.close();}
});
test('first-run onboarding fades incoming steps without horizontal movement',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://app.test/',runScripts:'outside-only'});
 try{
  const w=dom.window;w.localStorage.setItem('hesabno:first_run_profile_done','1');
  w.eval(fs.readFileSync(root+'src/scripts/217-hesabno-first-run-profile.js','utf8'));
  const overlay=w.__hesabnoOpenFirstRunWizard('restore'),card=overlay.querySelector('.hesabno-fr-card');
  const view=step=>overlay.querySelector(`[data-hesabno-fr-view="${step}"]`);
  overlay.querySelector('[data-hesabno-fr-go-profile]').click();
  await wait(25);
  assert.ok(view('profile').classList.contains('hesabno-fr-view-fade-in'));
  assert.equal(w.document.activeElement,view('profile').querySelector('h1'),'keep the first input from opening the native keyboard during the transition');
  await waitForStepMotion();
  overlay.querySelector('[data-hesabno-fr-back-restore]').click();
  await wait(25);
  assert.ok(view('restore').classList.contains('hesabno-fr-view-fade-in'));
  await waitForStepMotion();
  overlay.querySelector('[data-hesabno-fr-go-profile]').click();
  await waitForStepMotion();
  overlay.querySelector('#hesabno-fr-first').value='علی';
  overlay.querySelector('#hesabno-fr-last').value='رضایی';
  card.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'permissions');
  await wait(25);
  assert.ok(view('permissions').classList.contains('hesabno-fr-view-fade-in'));
  await waitForStepMotion();
  overlay.querySelector('[data-hesabno-fr-back-profile]').click();
  await wait(25);
  assert.ok(view('profile').classList.contains('hesabno-fr-view-fade-in'));
  await waitForStepMotion();
  card.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await waitForStepMotion();
  overlay.querySelector('[data-hesabno-fr-next-from-perms]').click();
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'preferences');
  await wait(25);
  assert.ok(view('preferences').classList.contains('hesabno-fr-view-fade-in'));
  await waitForStepMotion();
  overlay.querySelector('[data-hesabno-fr-back-perms]').click();
  await wait(25);
  assert.ok(view('permissions').classList.contains('hesabno-fr-view-fade-in'));
 }finally{dom.window.close();}
});
test('first-run permissions have short copy, four accessible switches and no focus jump to the footer',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://app.test/',runScripts:'outside-only'});
 try{
  const w=dom.window;w.localStorage.setItem('hesabno:first_run_profile_done','1');
  w.eval(fs.readFileSync(root+'src/scripts/217-hesabno-first-run-profile.js','utf8'));
  const overlay=w.__hesabnoOpenFirstRunWizard('restore'),card=overlay.querySelector('form');
  overlay.querySelector('[data-hesabno-fr-go-profile]').click();
  await waitForStepMotion();
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
  assert.equal(previous.textContent,'قبلی');
  await waitForStepMotion();
  previous.click();
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'profile');
  await waitForStepMotion();
  card.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await waitForStepMotion();
  assert.equal(view.querySelector('[data-hesabno-fr-next-from-perms]').textContent,'بعدی');
  view.querySelector('[data-hesabno-fr-next-from-perms]').click();
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'preferences');
 }finally{dom.window.close();}
});
test('first-run step transition is brief and visually apparent',()=>{
 const script=fs.readFileSync(root+'src/scripts/217-hesabno-first-run-profile.js','utf8');
 const css=fs.readFileSync(root+'src/styles/235-hesabno-text-root-and-display-stability.css','utf8');
 assert.match(script,/ONBOARDING_MOTION_MS = 140/);
 assert.match(script,/ONBOARDING_NAV_GUARD_MS = 210/);
 assert.match(css,/@keyframes hesabno-onboarding-step-fade \{\s*from \{ opacity: \.94; \}\s*to \{ opacity: 1; \}\s*\}/);
 assert.match(css,/animation: hesabno-onboarding-step-fade 140ms/);
 assert.match(css,/will-change: opacity/);
 assert.doesNotMatch(css,/hesabno-fr-view-fade-in \{[^}]*transform/);
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
test('fresh-install and support-reset account defaults begin with no pinned accounts',()=>{
 const dom=new JSDOM('',{url:'https://app.test/',runScripts:'outside-only'});
 try{
  const w=dom.window;
  w.eval(fs.readFileSync(root+'src/scripts/000-default-accounts.js','utf8'));
  const freshAccounts=JSON.parse(w.localStorage.getItem('hesabno:accounts_v5'));
  assert.ok(freshAccounts.length>0,'the fresh-install chart of accounts is initialized');
  assert.ok(freshAccounts.every(account=>account.pinned!==true),'fresh-install defaults must not pin any account');
 }finally{dom.window.close();}
 const resetSource=fs.readFileSync(root+'src/scripts/108-hesabno-complete-reset-flow.js','utf8');
 const match=resetSource.match(/var defaultAccountsJson = ("(?:\\.|[^"\\])*");/);
 assert.ok(match,'support reset exposes its account defaults');
 const resetAccounts=JSON.parse(JSON.parse(match[1]));
 assert.ok(resetAccounts.every(account=>account.pinned!==true),'support reset must return to an unpinned default account list');
});
test('default cash unpin migration preserves other pins and allows later manual repinning',()=>{
 const dom=new JSDOM('',{url:'https://app.test/',runScripts:'outside-only'});
 try{
 const w=dom.window,code=fs.readFileSync(root+'src/scripts/000c-unpin-default-cash.js','utf8');
 const accounts=[{id:201,group:'cash',code:'11001',pinned:true},{id:202,group:'cash',code:'11002',pinned:true},{id:203,group:'bank',code:'12001',pinned:true}];
 w.localStorage.setItem('hesabno:default_cash_unpinned_v1','1');
 w.localStorage.setItem('hesabno:accounts_v5',JSON.stringify(accounts));
 w.localStorage.setItem('hesabno:accounts',JSON.stringify(accounts));
 w.eval(code);
 const result=JSON.parse(w.localStorage.getItem('hesabno:accounts_v5'));
 assert.deepEqual(result.map(a=>a.pinned),[false,true,true]);
 assert.deepEqual(JSON.parse(w.localStorage.getItem('hesabno:accounts')).map(a=>a.pinned),[false,true,true]);
 assert.equal(w.localStorage.getItem('hesabno:default_cash_unpinned_v1'),null,'the old migration marker is cleaned');
 assert.equal(w.localStorage.getItem('hesabno:default_cash_unpinned_v2'),'1');
 result[0].pinned=true;w.localStorage.setItem('hesabno:accounts_v5',JSON.stringify(result));w.eval(code);
 assert.equal(JSON.parse(w.localStorage.getItem('hesabno:accounts_v5'))[0].pinned,true,'manual repinning remains allowed after migration');
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

test('first-run step animation is in place before the view becomes visible, without waiting for a frame',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://app.test/',runScripts:'outside-only'});
 try{
  const w=dom.window;w.localStorage.setItem('hesabno:first_run_profile_done','1');
  let frameRequests=0;w.requestAnimationFrame=()=>{frameRequests++;return 1;};
  w.matchMedia=()=>({matches:false});
  w.eval(fs.readFileSync(root+'src/scripts/217-hesabno-first-run-profile.js','utf8'));
  const overlay=w.__hesabnoOpenFirstRunWizard('restore'),card=overlay.querySelector('.hesabno-fr-card');
  const profile=overlay.querySelector('[data-hesabno-fr-view="profile"]');
  const nativeSet=card.setAttribute.bind(card);let classBeforeActivation=false;
  card.setAttribute=(name,value)=>{
   if(name==='data-hesabno-fr-active-step'&&value==='profile') classBeforeActivation=profile.classList.contains('hesabno-fr-view-fade-in');
   return nativeSet(name,value);
  };
  overlay.querySelector('[data-hesabno-fr-go-profile]').click();
  assert.equal(classBeforeActivation,true,'install entry motion before changing the active step');
  assert.equal(frameRequests,0,'the entry class does not wait for requestAnimationFrame');
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'profile');
  assert.ok(profile.classList.contains('hesabno-fr-view-fade-in'));
  assert.equal(w.document.activeElement,profile.querySelector('h1'));
  const unrelated=new w.Event('animationend',{bubbles:true});unrelated.animationName='unrelated';profile.dispatchEvent(unrelated);
  assert.ok(profile.classList.contains('hesabno-fr-view-fade-in'),'unrelated animations do not interrupt the transition');
  const ended=new w.Event('animationend',{bubbles:true});ended.animationName='hesabno-onboarding-step-fade';profile.dispatchEvent(ended);
  assert.equal(profile.classList.contains('hesabno-fr-view-fade-in'),false,'temporary animation class is cleaned up at animation end');
  await waitForStepMotion();
  overlay.querySelector('[data-hesabno-fr-back-restore]').click();
  assert.ok(overlay.querySelector('[data-hesabno-fr-view="restore"]').classList.contains('hesabno-fr-view-fade-in'));
 }finally{dom.window.close();}
});

test('reduced motion skips the step animation while keeping navigation safeguards',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://app.test/',runScripts:'outside-only'});
 try{
  const w=dom.window;w.localStorage.setItem('hesabno:first_run_profile_done','1');
  w.matchMedia=query=>({matches:query==='(prefers-reduced-motion: reduce)'});
  w.eval(fs.readFileSync(root+'src/scripts/217-hesabno-first-run-profile.js','utf8'));
  const overlay=w.__hesabnoOpenFirstRunWizard('restore'),card=overlay.querySelector('.hesabno-fr-card');
  overlay.querySelector('[data-hesabno-fr-go-profile]').click();
  const profile=overlay.querySelector('[data-hesabno-fr-view="profile"]');
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'profile');
  assert.equal(profile.classList.contains('hesabno-fr-view-fade-in'),false);
  assert.equal(card.getAttribute('aria-busy'),'true');
  overlay.querySelector('[data-hesabno-fr-back-restore]').click();
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'profile','guard still prevents accidental extra navigation');
  await waitForStepMotion();
  overlay.querySelector('[data-hesabno-fr-back-restore]').click();
  assert.equal(card.getAttribute('data-hesabno-fr-active-step'),'restore');
 }finally{dom.window.close();}
});

test('returning to a step cancels its old cleanup; interrupted motion has a timeout fallback',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://app.test/',runScripts:'outside-only'});
 try{
  const w=dom.window;w.localStorage.setItem('hesabno:first_run_profile_done','1');
  w.eval(fs.readFileSync(root+'src/scripts/217-hesabno-first-run-profile.js','utf8'));
  const overlay=w.__hesabnoOpenFirstRunWizard('restore'),profile=overlay.querySelector('[data-hesabno-fr-view="profile"]');
  overlay.querySelector('[data-hesabno-fr-go-profile]').click();await waitForStepMotion();
  overlay.querySelector('[data-hesabno-fr-back-restore]').click();await waitForStepMotion();
  overlay.querySelector('[data-hesabno-fr-go-profile]').click();
  assert.ok(profile.classList.contains('hesabno-fr-view-fade-in'));
  await wait(650);
  assert.ok(profile.classList.contains('hesabno-fr-view-fade-in'),'old timer must not clean up a new transition');
  await wait(550);
  assert.equal(profile.classList.contains('hesabno-fr-view-fade-in'),false,'fallback cleans up if animationend never arrives');
 }finally{dom.window.close();}
});
