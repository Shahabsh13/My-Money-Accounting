const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
test('financial snapshot filters inactive items, syncs changed data and clears removed entries',()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://app.test/',runScripts:'outside-only'});
 try{
 const w=dom.window;let observer,plans=[];
 w.HnBridge={saveFinancialReminderPlan:p=>{plans.push(JSON.parse(p));return true;}};
 w.__hesabnoStorageGuard={onWrite:cb=>{observer=cb;}};
 w.__hesabnoReminderDueDay=()=>21000;
 w.__hesabnoBuildCheckNotification=t=>t.check.status==='issued'?{checkId:t.id,body:'check'}:null;
 w.__hesabnoBuildInstallmentNotification=(i,l)=>i.status==='pending'&&(!l||l.status!=='completed')?{installmentId:i.id,body:'loan'}:null;
 w.localStorage.setItem('hesabno:transactions',JSON.stringify([{id:1,method:'check',check:{status:'issued',dueDate:'1405/07/28'}},{id:2,check:{status:'cleared'}}]));
 w.localStorage.setItem('hesabno:installments',JSON.stringify([{id:3,loanId:4,status:'pending'},{id:5,status:'paid'},{id:6,loanId:7,status:'pending'}]));
 w.localStorage.setItem('hesabno:loans',JSON.stringify([{id:4,status:'active'},{id:7,status:'completed'}]));
 w.eval(fs.readFileSync('app/src/main/assets/src/scripts/218-native-financial-reminders.js','utf8'));
 assert.deepEqual(plans.at(-1).entries.map(e=>e.id),['checks:1','loans:3']);
 const count=plans.length;observer();assert.equal(plans.length,count);
 w.localStorage.setItem('hesabno:reminderTime','20:20');observer();assert.equal(plans.at(-1).time,'20:20');
 w.localStorage.setItem('hesabno:permissions','{"notifications":false}');observer();assert.equal(plans.at(-1).enabled,false);
 w.localStorage.clear();w.__hesabnoSyncNativeFinancialReminders();assert.equal(plans.at(-1).entries.length,0);
 }finally{dom.window.close();}
});
test('native financial delivery checks daily stages, deduplicates successful posts and reschedules',()=>{
 const java=fs.readFileSync('app/src/main/java/com/maymoney/app/MainActivity.java','utf8');
 assert.ok(java.includes('public boolean saveFinancialReminderPlan(String payload)'));
 assert.ok(java.includes('deliverFinancialReminders(context);'));
 assert.ok(java.includes('(-diff - 1) % 3 == 0'));
 assert.ok(java.includes('delivered.optBoolean(id, false)'));
 assert.ok(java.includes('putString("financial_reminder_delivered"'));
 assert.ok(java.includes('if (!prefs.getBoolean("daily_reminder_enabled", false) && !financial) return;'));
});
