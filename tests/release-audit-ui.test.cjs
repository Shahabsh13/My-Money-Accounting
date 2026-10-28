const {test}=require('node:test');
const assert=require('node:assert/strict');
const {bootApp,closeApp,buttonByText,wait,normalize}=require('./helpers/app-boot.cjs');
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

test('backup screen presents a compact reset action without the old description',async()=>{
 const dom=await bootApp({storage:{'hesabno:first_run_intro_done':'true','hesabno:first_run_profile_done':'true'}});
 try{
  const d=dom.window.document;
  const more=buttonByText(d,'بیشتر');assert.ok(more);more.click();await wait(250);
  const backup=[...d.querySelectorAll('button')].find(button=>normalize(button.textContent).includes('پشتیبان‌گیری و بازیابی داده‌ها'));
  assert.ok(backup);backup.click();await wait(350);
  const health=d.getElementById('hesabno-health-card');assert.ok(health);
  assert.equal(health.querySelector('p'),null,'توضیح بررسی سلامت نمایش داده نشود');
  assert.equal(normalize(health.querySelector('strong').textContent),'بررسی سلامت داده‌ها');
  const healthButton=health.querySelector('[data-health-check]');assert.ok(healthButton);
  const securityCopy=[...d.querySelectorAll('span')].find(node=>normalize(node.textContent).includes('اطلاعات کاملاً محلی و امن روی دستگاه شما نگهداری می‌شود') || normalize(node.textContent).includes('اگر این مرورگر را با دیگران مشترک استفاده می‌کنید'));
  assert.ok(securityCopy);assert.equal(dom.window.getComputedStyle(securityCopy.parentElement).display,'none','توضیح امنیتی در صفحه دیده نشود');
  const storage=dom.window.localStorage;
  storage.setItem('hesabno:local_snapshots','{invalid');
  healthButton.click();
  assert.equal(health.querySelector('[data-health-result]').getAttribute('data-health-state'),'invalid');
  assert.match(health.querySelector('[data-health-result]').textContent,/خطا در/);
  assert.equal(storage.getItem('hesabno:local_snapshots'),'{invalid','بررسی نباید داده را تغییر دهد');
  let issue=health.querySelector('[data-health-key="hesabno:local_snapshots"]');assert.ok(issue);
  assert.match(issue.textContent,/نسخه‌های محلی/);assert.match(issue.textContent,/hesabno:local_snapshots/);
  issue.querySelector('button').click();
  assert.match(issue.textContent,/تعمیر بدون احتمال از دست رفتن اطلاعات ممکن نیست/);
  assert.equal(storage.getItem('hesabno:local_snapshots'),'{invalid','داده مبهم نباید تغییر کند');
  const bom='\ufeff[{"id":1}]';storage.setItem('hesabno:local_snapshots',bom);healthButton.click();
  issue=health.querySelector('[data-health-key="hesabno:local_snapshots"]');assert.ok(issue);
  storage.setItem('hesabno:local_snapshots','[2]');issue.querySelector('button').click();
  assert.equal(storage.getItem('hesabno:local_snapshots'),'[2]','تغییر بعد از بررسی نباید بازنویسی شود');
  storage.setItem('hesabno:local_snapshots',bom);healthButton.click();
  issue=health.querySelector('[data-health-key="hesabno:local_snapshots"]');
  const proto=dom.window.Storage.prototype, originalAdapter=proto.__hesabnoSqlAdapterInstalled;
  proto.__hesabnoSqlAdapterInstalled=true;issue.querySelector('button').click();
  assert.equal(storage.getItem('hesabno:local_snapshots'),bom,'آداپتور بومی غیراتمی نباید تغییر کند');
  assert.match(issue.textContent,/ذخیره‌سازی بومی/);
  if(originalAdapter===undefined) delete proto.__hesabnoSqlAdapterInstalled; else proto.__hesabnoSqlAdapterInstalled=originalAdapter;
  issue.querySelector('button').click();
  assert.equal(storage.getItem('hesabno:local_snapshots'),'[{"id":1}]','تنها نشانگر اضافه حذف شود');
  assert.equal(health.querySelector('[data-health-key="hesabno:local_snapshots"]'),null);
  storage.setItem('hesabno:local_snapshots','[]');
  healthButton.click();
  assert.equal(health.querySelector('[data-health-result]').getAttribute('data-health-state'),'ok');
  assert.match(health.querySelector('[data-health-result]').textContent,/بخش سالم است/);
  assert.equal(storage.getItem('hesabno:local_snapshots'),'[]');
  const title=[...d.querySelectorAll('h4')].find(node=>normalize(node.textContent)==='ریست برنامه');
  assert.ok(title,'عنوان کارت باید «ریست برنامه» باشد');
  assert.equal(title.parentElement.querySelector('p'),null,'توضیح زیر عنوان کارت باید حذف شود');
  const reset=buttonByText(d,'ریست برنامه');assert.ok(reset,'برچسب دکمه باید «ریست برنامه» باشد');
  reset.click();await wait(350);
  assert.ok([...d.querySelectorAll('h3')].some(node=>normalize(node.textContent)==='ریست برنامه'));
  assert.ok(buttonByText(d,'پشتیبان‌گیری و ریست برنامه'));
  assert.ok(buttonByText(d,'ریست بدون پشتیبان'));
 }finally{closeApp(dom);}
});

test('manual backup waits for Android save confirmation before updating history and date',async()=>{
 const requests=[];
 const dom=await bootApp({storage:{'hesabno:first_run_intro_done':'true','hesabno:first_run_profile_done':'true'},stubs:w=>{
  w.HnBridge={saveManualBackup:(name,json,id)=>{requests.push({name,json,id});return true;},saveBackup:()=>{throw new Error('manual backup must not use automatic Downloads');}};
 }});
 try{
  const w=dom.window,d=w.document;
  buttonByText(d,'بیشتر').click();await wait(250);
  const backup=[...d.querySelectorAll('button')].find(button=>normalize(button.textContent).includes('پشتیبان‌گیری و بازیابی داده‌ها'));
  assert.ok(backup);backup.click();await wait(350);
  const download=buttonByText(d,'دانلود فایل پشتیبان (JSON)');assert.ok(download);
  const initialDate=w.localStorage.getItem('hesabno:last_backup_date');
  const initialHistory=w.localStorage.getItem('hesabno:exported_files');
  download.click();await wait(200);
  assert.equal(requests.length,1);assert.match(requests[0].name,/^My-Money-Backup-.*\.json$/);
  assert.ok(JSON.parse(requests[0].json).storageData);
  assert.equal(w.localStorage.getItem('hesabno:last_backup_date'),initialDate);
  assert.equal(w.localStorage.getItem('hesabno:exported_files'),initialHistory);
  w.__hesabnoOnManualBackupResult(requests[0].id,'cancelled');await wait(100);
  assert.equal(w.localStorage.getItem('hesabno:last_backup_date'),initialDate);
  assert.equal(w.localStorage.getItem('hesabno:exported_files'),initialHistory);
  download.click();await wait(200);assert.equal(requests.length,2);
  w.__hesabnoOnManualBackupResult(requests[1].id,'saved');await wait(100);
  assert.ok(w.localStorage.getItem('hesabno:last_backup_date'));
  assert.match(w.localStorage.getItem('hesabno:exported_files'),/My-Money-Backup/);
 }finally{closeApp(dom);}
});
