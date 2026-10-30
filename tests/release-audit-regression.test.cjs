const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const base='app/src/main/assets/';
function sms(){const c={window:{}};vm.createContext(c);for(const p of ['src/data/bank-sms-samples.js','src/scripts/005c-bank-sms-library.js'])vm.runInContext(fs.readFileSync(base+p,'utf8'),c);const s=fs.readFileSync(base+'src/scripts/067-inline.js','utf8');c.vk=()=>[];c.C9=[];vm.runInContext(s.slice(s.indexOf('function T1('),s.indexOf('function smsBankMatches'))+';this.custom=T1',c);return {parse:c.window.HnBankSmsLibrary.parse,custom:c.custom};}
const user={id:'user',bankName:'بانک ملت',bankKeyword:'ملت',typeRule:'income',amountPrefix:'مبلغ'};
test('SMS: explicit amount takes priority over earlier transfer/card numbers',()=>{assert.equal(sms().parse('بانک ملت\nانتقال:6104331234567890\nبرداشت\nمبلغ:250000 ریال\nمانده:800000').amount,250000);});
test('SMS: fractional and overflowing amounts are not silently truncated',()=>{assert.equal(sms().parse('بانک ملت\nواریز مبلغ:1.5 ریال'),null);assert.equal(sms().parse('بانک ملت\nواریز:900719925474100 تومان'),null);});
test('SMS: trailing minus on balance is retained',()=>{assert.equal(sms().parse('بانک ملت\nبرداشت:1000 ریال\nمانده:2000-').balance,-2000);});
test('custom SMS: OTP and account-only messages cannot become transactions',()=>{const c=sms().custom;assert.equal(c('بانک ملت رمز پویا 123456',[user]),null);assert.equal(c('بانک ملت\nحساب:123456789\nمانده:500000',[user]),null);});
test('custom SMS: amount prefix is literal, not an executable regular expression',()=>{const result=sms().custom('بانک ملت\nمبلغ(: 250000 ریال',[{...user,amountPrefix:'مبلغ('}]);assert.equal(result.amount,250000);});
function notifications(raw='[]',failWrites=false){const store=new Map([['hesabno:notification-center:v1',raw]]),timers=[];const c={window:{addEventListener(){},dispatchEvent(){},__hesabnoOpenDashboardFromNotification:()=>true},document:{addEventListener(){}},localStorage:{getItem:k=>store.get(k),setItem(k,v){if(failWrites)throw Error('quota');store.set(k,v);}},Event:class{},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},console};vm.runInNewContext(fs.readFileSync(base+'src/scripts/000b-notification-center.js','utf8'),c);return {center:c.window.HnNotificationCenter,window:c.window,timers};}
test('notification inbox ignores malformed records without crashing the dashboard',()=>{const {center}=notifications('[null,4,{"title":"invalid"}]');assert.equal(center.list().length,0);});
test('notification write failures do not interrupt sending or claim success',()=>{const {center}=notifications('[]',true);assert.equal(center.add({title:'A'}),null);assert.equal(center.readAll(),false);});
test('one malformed native history record does not hide subsequent messages',()=>{const {center,window}=notifications();window.HnBridge={getNotificationHistoryJson:()=>JSON.stringify([{title:'bad',createdAt:'not-a-date'},{id:'good',title:'valid'}])};center.sync();assert.ok(center.list().some(n=>n.title==='valid'));});
test('multiple native IDs for the same logical notice all remain readable',()=>{const {center}=notifications();center.add({id:'a',title:'same'});center.add({id:'b',title:'same'});center.readNative('a');assert.equal(center.list()[0].read,true);});
test('failed or unknown destinations never mark notifications read',()=>{const {center}=notifications();const n=center.add({title:'unknown',target:'garbage'});assert.equal(center.open(n),false);assert.equal(center.list()[0].read,false);});
test('native cold-start taps retry routing and read only after navigation succeeds',()=>{const {center,window,timers}=notifications();center.add({id:'native',title:'A',target:'checks'});assert.equal(typeof center.handleNativeClick,'function');center.handleNativeClick('native','checks');assert.equal(center.list()[0].read,false);window.__hesabnoOpenChecksFromNotification=()=>true;while(timers.length)timers.shift()();assert.equal(center.list()[0].read,true);});
test('attachment identifiers include changes in bytes previously skipped by sampling',()=>{const s=fs.readFileSync(base+'src/scripts/000a-hesabno-storage-write-guard.js','utf8'),start=s.indexOf('    function computeAttachmentId('),end=s.indexOf('    function openAttIdb',start);const hash=vm.runInNewContext(s.slice(start,end)+';computeAttachmentId');const a='data:image/jpeg;base64,'+'A'.repeat(10000),chars=a.split('');chars[101]='B';assert.notEqual(hash(a),hash(chars.join('')));});
test('backup rollback restores a key whose storage adapter mutates then throws',()=>{
 const backup=require('../app/src/main/assets/src/domain/backup.js');
 for(const deletion of [false,true]){
  const store=new Map([['A','oldA'],['B','oldB']]);let fail=true;
  const storage={getItem:k=>store.get(k)??null,setItem(k,v){store.set(k,v);if(k==='B'&&fail){fail=false;throw Error('post-write failure');}},removeItem(k){store.delete(k);if(k==='B'&&fail){fail=false;throw Error('post-delete failure');}}};
  const result=backup.applyRestore(storage,{ok:true,writes:deletion?[{key:'A',value:'new'}]:[{key:'A',value:'new'},{key:'B',value:'new'}],deletes:deletion?['B']:[]});
  assert.equal(result.ok,false);assert.equal(store.get('B'),'oldB');assert.equal(store.get('A'),'oldA');
 }
});
test('live restore rolls back the failing current key as well as prior keys',()=>{
 const source=fs.readFileSync(base+'src/scripts/108-hesabno-complete-reset-flow.js','utf8');
 const core=source.slice(source.indexOf('var backupKeys = ['),source.indexOf('window.__hesabnoRestoreResetData = restoreResetData;')+'window.__hesabnoRestoreResetData = restoreResetData;'.length);
 const store=new Map([['hesabno:accounts_v5','old']]);let fail=true;
 const window={__safeGet:k=>store.get(k)??null,__safeSet(k,v){store.set(k,v);if(fail){fail=false;throw Error('adapter mutated before throwing');}},__safeRemove:k=>store.delete(k),setTimeout(){}};
 vm.runInNewContext(core,{window});const data=window.__hesabnoCaptureResetData();data['hesabno:accounts_v5']='new';assert.equal(window.__hesabnoRestoreResetData(data),false);assert.equal(store.get('hesabno:accounts_v5'),'old');
});
test('support reset clears first-run and lock state so the fresh-install intro can run again',()=>{
 const source=fs.readFileSync(base+'src/scripts/108-hesabno-complete-reset-flow.js','utf8');
 const start=source.indexOf('var clearKeys = backupKeys.slice();');
 const end=source.indexOf('    var defaultAccountsJson =',start);
 assert.ok(start>=0&&end>start);
 const resetState=source.slice(start,end);
 const removed=[];
 vm.runInNewContext(resetState+';resetOnboardingState();',{backupKeys:[],removeRaw:key=>removed.push(key)});
 assert.deepEqual(removed,[
  'hesabno:first_run_intro_done','hesabno:first_run_profile_done','hesabno:first_run_profile_in_progress',
  'hesabno:permissions','hesabno:lock','hesabno:pin','hesabno:biometric'
 ]);
 const clearStart=source.indexOf('var clearUserData = function () {');
 const clearEnd=source.indexOf('    var finishReset = function () {',clearStart);
 assert.ok(source.slice(clearStart,clearEnd).includes('resetOnboardingState();'),
  'the no-backup and backup-confirmed reset paths must clear onboarding state before reload');
 assert.ok(source.includes('window.__hesabnoSoftReload();'), 'reset must reload so the initial onboarding screens mount');
 const authStart=source.indexOf('var requestResetPin = function');
 const authEnd=source.indexOf('    var clean = function',authStart);
 const auth=source.slice(authStart,authEnd);
 assert.ok(auth.includes('readRaw("hesabno:lock") !== "true" || !/^\\d{4}$/.test(storedPin)'),
  'only an active lock with a valid four-digit PIN should require reauthorization');
 assert.ok(auth.includes('type="password"')&&auth.includes('data-hesabno-reset-pin-cancel'),
  'the reauthorization field is masked and can be cancelled back to the reset options');
 assert.ok(source.includes('requestResetPin(function () { finishReset(); }, action);'),
  'reset without backup must require PIN authorization before deleting data');
 assert.ok(source.includes('requestResetPin(function () {')&&source.includes('}, backup);'),
  'backup reset must require PIN authorization before starting backup');
});
test('browser system-notification tap marks only its matching inbox record read',()=>{
 const {center}=notifications();center.add({title:'A',body:'one',target:'home'});center.add({title:'B',body:'two',target:'home'});
 assert.equal(center.handleWebClick('A','one','home'),true);
 assert.equal(center.list().find(n=>n.title==='A').read,true);assert.equal(center.list().find(n=>n.title==='B').read,false);
});
test('deleted SMS notification cannot open an unrelated message or falsely become read',()=>{
 const s=fs.readFileSync(base+'src/scripts/067-inline.js','utf8');const start=s.indexOf('window.__hesabnoOpenSmsFromNotification=function'),end=s.indexOf(';function i$',start);
 let opened=0;const window={__hesabnoOpenAddFromSms:()=>{opened++;return true;}};
 vm.runInNewContext(s.slice(start,end),{window,ou:()=>[{id:'other',rawText:'another message'}]});
 assert.equal(window.__hesabnoOpenSmsFromNotification('deleted-id'),false);assert.equal(opened,0);
 assert.equal(window.__hesabnoOpenSmsFromNotification('other'),true);assert.equal(opened,1);
});
