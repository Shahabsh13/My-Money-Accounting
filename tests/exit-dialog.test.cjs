const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
function setup(){
 const dom=new JSDOM('<!doctype html><html><body><button id="previous">previous</button></body></html>',{url:'https://app.test/',runScripts:'outside-only'});
 const w=dom.window;w.URL.createObjectURL=()=>'';w.URL.revokeObjectURL=()=>{};w.__hesabnoFlushAutoBackup=()=>true;
 w.eval(fs.readFileSync('app/src/main/assets/src/scripts/004-hesabno-apk-fixes.js','utf8'));return dom;
}
test('exit cancel dismisses; yes exits once without replaying the previous click',()=>{
 const dom=setup();try{
 const w=dom.window;let exits=0,replays=0;w.HnBridge={exitApp:()=>exits++};
 w.document.querySelector('#previous').onclick=()=>replays++;
 w.document.querySelector('#previous').click();
 w.__hesabnoConfirmExit();w.__hesabnoConfirmExit();
 assert.equal(w.document.querySelectorAll('[data-hn-dialog]').length,1);
 const brand=w.document.querySelector('[data-hn-exit-brand]');assert.equal(brand.textContent,'My Money');
 assert.ok(brand.querySelector('img').src.endsWith('assets/icon/apple-touch-icon.png'));
 const buttons=()=>w.document.querySelectorAll('[data-hn-dialog] button');
 buttons()[1].click();assert.equal(exits,0);assert.equal(w.document.querySelector('[data-hn-dialog]'),null);
 w.__hesabnoConfirmExit();buttons()[0].click();assert.equal(exits,1);assert.equal(replays,1);
 assert.equal(w.document.querySelector('[data-hn-dialog]'),null);
 }finally{dom.window.close();}
});
test('generic alert and confirmation buttons still receive click events',()=>{
 const dom=setup();try{
 const w=dom.window;w.alert('hello');w.document.querySelector('[data-hn-dialog] button').click();
 assert.equal(w.document.querySelector('[data-hn-dialog]'),null);
 let confirmed=0;const trigger=w.document.querySelector('#previous');trigger.onclick=()=>{if(w.confirm('confirm action'))confirmed++;};
 trigger.click();w.document.querySelector('[data-hn-dialog] button').click();assert.equal(confirmed,1);
 }finally{dom.window.close();}
});
test('hardware back dismisses exit confirmation before navigation and never exits',()=>{
 const dom=setup();try{
 const w=dom.window;let exits=0,handled=0,navigated=0;
 w.HnBridge={exitApp:()=>exits++,backHandled:()=>handled++};
 w.__hesabnoNavigateBack=()=>{navigated++;return true;};
 const java=fs.readFileSync('app/src/main/java/com/maymoney/app/MainActivity.java','utf8');
 const start=java.indexOf('private static final String BACK_JS ='),end=java.indexOf('\n\n    private WebView',start);
 const code=[...java.slice(start,end).matchAll(/"(?:\\.|[^"\\])*"/g)].map(m=>JSON.parse(m[0])).join('');
 w.__hesabnoConfirmExit();assert.ok(w.document.querySelector('[data-hn-exit-dialog]'));
 w.eval(code);
 assert.equal(w.document.querySelector('[data-hn-dialog]'),null);
 assert.equal(exits,0);assert.equal(navigated,0);assert.equal(handled,1);
 assert.equal(w.__hesabnoDismissExitDialog(),false);
 }finally{dom.window.close();}
});
test('exit backup defaults on, saves before exit, stays open on failure and can be unchecked',()=>{
 const dom=setup();try{
 const w=dom.window,events=[];
 w.HnBridge={exitApp:()=>events.push('exit')};
 w.__hesabnoFlushAutoBackup=force=>{assert.equal(force,true);events.push('backup');return false;};
 w.__hesabnoConfirmExit();
 const dialog=w.document.querySelector('[data-hn-exit-dialog]'),check=dialog.querySelector('[data-hn-exit-backup]');
 assert.equal(check.checked,true);
 assert.equal(dialog.querySelector('[data-hn-exit-brand]').nextElementSibling.tagName,'LABEL');
 const yes=dialog.querySelector('button');yes.click();
 assert.deepEqual(events,['backup']);assert.ok(w.document.contains(dialog));
 assert.ok(dialog.querySelector('[data-hn-exit-status]').textContent.includes('ذخیره نشد'));
 assert.equal(yes.disabled,false);
 w.__hesabnoFlushAutoBackup=()=>{events.push('backup');return true;};yes.click();
 assert.deepEqual(events,['backup','backup','exit']);assert.equal(w.document.querySelector('[data-hn-exit-dialog]'),null);
 w.__hesabnoConfirmExit();w.document.querySelector('[data-hn-exit-backup]').checked=false;
 w.document.querySelector('[data-hn-exit-dialog] button').click();
 assert.deepEqual(events,['backup','backup','exit','exit']);
 }finally{dom.window.close();}
});
test('exit backups use the app Downloads subfolder without changing ordinary export destinations',()=>{
 const java=fs.readFileSync('app/src/main/java/com/maymoney/app/MainActivity.java','utf8');
 assert.ok(java.includes('jsonPayload.getBytes("UTF-8"), true)'));
 assert.ok(java.includes('return saveToDownloads(name, data, false);'));
 assert.ok(java.includes('Environment.DIRECTORY_DOWNLOADS + (exitBackup ? "/My Money/Backups" : "")'));
 assert.ok(java.includes('if (exitBackup) dir = new File(dir, "My Money/Backups");'));
});
