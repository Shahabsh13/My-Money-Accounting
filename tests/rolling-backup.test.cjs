const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const base='app/src/main/assets/src/scripts/';
test('rolling backup runs every minute only while visible, without stacked timers or UI',()=>{
 const dom=new JSDOM('',{url:'https://app.test/',runScripts:'outside-only'});
 try{
  const w=dom.window;let hidden=false,next=0,calls=[];const timers=new Map();
  Object.defineProperty(w.document,'visibilityState',{get:()=>hidden?'hidden':'visible'});
  w.HnBridge={saveRollingBackup(){}};
  w.__hesabnoFlushAutoBackup=mode=>calls.push(mode);
  w.setInterval=(fn,delay)=>{assert.equal(delay,60000);timers.set(++next,fn);return next;};
  w.clearInterval=id=>timers.delete(id);
  w.alert=w.confirm=()=>{throw Error('must stay silent');};
  w.eval(fs.readFileSync(base+'226-silent-rolling-backup.js','utf8'));
  assert.equal(calls.length,0);assert.equal(timers.size,1);
  [...timers.values()][0]();assert.deepEqual(calls,['rolling']);
  hidden=true;w.document.dispatchEvent(new w.Event('visibilitychange'));assert.equal(timers.size,0);
  hidden=false;w.document.dispatchEvent(new w.Event('visibilitychange'));
  w.document.dispatchEvent(new w.Event('visibilitychange'));assert.equal(timers.size,1);
  [...timers.values()][0]();assert.deepEqual(calls,['rolling','rolling']);
  w.dispatchEvent(new w.Event('pagehide'));assert.equal(timers.size,0);
 }finally{dom.window.close();}
});
test('rolling snapshot contains real data and attachments even when internal backup is unchanged',()=>{
 const source=fs.readFileSync(base+'000a-hesabno-storage-write-guard.js','utf8');
 const start=source.indexOf('    function flushAutoBackup('),end=source.indexOf('    function scheduleAutoBackup()',start);
 const calls=[],entries={'hesabno:accounts_v5':'[{"id":1}]','hesabno:transactions':'[{"id":2}]','hesabno:loans':'[{"id":3}]'};
 let local=0;const bridge={saveAutoBackup:()=>{local++;return true;},saveRollingBackup:payload=>{calls.push(JSON.parse(payload));return true;}};
 const context={window:{clearTimeout(){}},syncTimer:42,restoringFromNative:false,getBridge:()=>bridge,
  collectAllEntries:()=>entries,exportAttachmentsMap:()=>({receipt:'data:image/png;base64,AAA'}),lastSerializedEntries:''};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 assert.equal(context.flushAutoBackup(),true);assert.equal(local,1);
 context.syncTimer=43;
 assert.equal(context.flushAutoBackup('rolling'),true);assert.equal(context.syncTimer,43,'rolling does not cancel pending private backup');
 assert.equal(context.flushAutoBackup('rolling'),true);assert.equal(calls.length,2);
 assert.equal(calls[0].accounts[0].id,1);assert.equal(calls[0].transactions[0].id,2);
 assert.equal(JSON.parse(calls[0].entries['hesabno:loans'])[0].id,3);
 assert.equal(calls[0].attachments.receipt,'data:image/png;base64,AAA');
 assert.equal(context.flushAutoBackup(),true);assert.equal(local,1,'rolling does not change private-backup dedup state');
 bridge.saveRollingBackup=()=>false;assert.equal(context.flushAutoBackup('rolling'),false);
});
test('native rolling writer is silent, bounded and publishes the replacement before deleting the prior file',()=>{
 const source=fs.readFileSync('app/src/main/java/com/maymoney/app/MainActivity.java','utf8');
 const queue=source.slice(source.indexOf('public boolean saveRollingBackup('),source.indexOf('public boolean saveExitBackup('));
 assert.ok(queue.includes('rollingBackupBusy.compareAndSet(false, true)'));
 assert.ok(queue.includes('!appInForeground'));
 assert.ok(source.includes('appInForeground = false;'));
 assert.ok(source.includes('appInForeground = true;'));
 assert.ok(queue.includes('rollingBackupExecutor.execute('));
 assert.ok(queue.includes('rollingBackupBusy.set(false)'));
 const writer=source.slice(source.indexOf('private boolean writeRollingBackup('),source.indexOf('private boolean saveToDownloads('));
 assert.ok(writer.includes('"/My Money/Backups"'));
 assert.ok(!writer.includes('toast('));assert.ok(!writer.includes('requestPermissions('));
 assert.ok(writer.indexOf('out.write(bytes)')<writer.indexOf('getContentResolver().delete(Uri.parse(previous)'));
 assert.ok(writer.indexOf('KEY_ROLLING_BACKUP_URI, staged.toString()')<writer.indexOf('getContentResolver().delete(Uri.parse(previous)'));
 assert.ok(writer.includes('android.util.AtomicFile'));
 assert.ok(source.includes('ROLLING_BACKUP_NAME = "MyMoney-AutoBackup.json"'));
});
