const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const root='app/src/main/assets/';
test('first-run permissions have short copy, six accessible switches and no focus jump to the footer',()=>{
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
  assert.equal(view.querySelectorAll('[role="switch"]').length,6);
  for(const el of view.querySelectorAll('[role="switch"]'))assert.ok(el.getAttribute('aria-label'));
  for(const el of view.querySelectorAll('.hesabno-fr-perm-reason'))assert.ok(el.textContent.length<45);
  view.querySelector('[data-hesabno-fr-skip-perms]').click();
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
