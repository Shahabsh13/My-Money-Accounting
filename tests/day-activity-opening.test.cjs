const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const base='app/src/main/assets/src/scripts/';
test('day line mirrors daily net only, never adds account opening balances and respects hidden amounts',async()=>{
 const dom=new JSDOM('<main><div><div class="sticky hesabno-transaction-day-header"><span class="hesabno-transaction-day-total">۰ ریال</span></div><article id="tx-card-1"></article></div></main>',{url:'https://app.test/',runScripts:'outside-only'});
 try{
 const w=dom.window;let rerun;w.__hesabnoDom={watch:(el,opts,fn)=>rerun=fn};
 w.localStorage.setItem('hesabno:accounts_v5',JSON.stringify([{name:'bank',initialBalance:2000000}]));
 w.eval(fs.readFileSync(base+'207-hesabno-day-line.js','utf8'));
 const total=w.document.querySelector('.hesabno-transaction-day-total'),display=w.document.querySelector('.hesabno-day-balance');
 assert.equal(display.textContent,'۰ ریال');
 for(const text of ['+۵۰۰ ریال','−۱۰۰ ریال','•••']){
  total.textContent=text;rerun(); await Promise.resolve();
  assert.equal(display.textContent,text);assert.equal(display.classList.contains('neg'),text.startsWith('−'));
 }
 dom.window.close();
 }catch(e){dom.window.close();throw e;}
});
test('editing a cash/non-bank account does not silently erase its opening balance',()=>{
 const s=fs.readFileSync(base+'067-inline.js','utf8'),wk=s.indexOf('wk=({open:'),start=s.indexOf('ce=()=>{var Q,he,ae,Z,ne;',wk),end=s.indexOf(';return e.jsxs(',start);
 const save=s.slice(start+3,end);assert.ok(save.startsWith('()=>'));
 for(const bank of [false,true]){
  let saved;
  const x={name:'bank',initialBalance:2000000,bankName:'ملت',accountNumber:'123456'};
  const context={x,P:bank,j:'2000000',S:'',_sas(){},T(){},u:value=>saved=value,Jd:()=>x.name};
  const fn=vm.runInNewContext('('+save+')',context);fn();assert.equal(saved.initialBalance,2000000);
 }
});
test('transaction search has only a short placeholder without changing its controlled search handler',()=>{
 const s=fs.readFileSync(base+'067-inline.js','utf8');
 assert.ok(s.includes('"data-hesabno-transaction-search":"true","aria-label":"جستجو",placeholder:"جستجو",value:f,onChange:Pe=>m(Pe.target.value)'));
 assert.ok(!s.includes('جستجو با عنوان، مبلغ، شماره چک یا شماره سند...'));
});
