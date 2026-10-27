const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const shell=fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js','utf8');
test('account picker pins follow the selected group, active status and excluded account',()=>{
 const match=shell.match(/ne=M\.useMemo\(\(\)=>(a\.filter\(Ce=>Ce\.active&&Ce\.pinned[^;]+?)\),\[a,U,f\]\)/);
 assert.ok(match,'pins must recompute when the active group changes');
 const select=new Function('a','U','f','return '+match[1]+')');
 const accounts=[
  {id:1,group:'bank',active:true,pinned:true},
  {id:2,group:'cash',active:true,pinned:true},
  {id:3,group:'expense',active:true,pinned:true,parentId:10},
  {id:4,group:'income',active:true,pinned:true,parentId:20},
  {id:5,group:'bank',active:false,pinned:true},
  {id:6,group:'bank',active:true,pinned:false},
  {id:7,group:'expense',active:true,pinned:true,parentId:null}
 ];
 for(const [group,id] of [['bank',1],['cash',2],['expense',3],['income',4]]){
  assert.deepEqual(select(accounts,group,undefined).map(a=>a.id),[id]);
  assert.deepEqual(select(accounts,group,id),[]);
 }
 assert.deepEqual(select(accounts,'asset',undefined),[]);
});
test('account management pins remain scoped to the current tab and keep their quick-access section',()=>{
 assert.ok(shell.includes('T=M.useMemo(()=>t.filter(K=>K.group===l),[t,l])'));
 assert.ok(shell.includes('re=T.filter(K=>K.pinned&&(!z||K.parentId!==null))'));
 assert.ok(shell.includes('سنجاق‌شده‌ها (دسترسی سریع)'));
 assert.ok(!shell.includes('کد ریشه'));
});
test('last detail action menu opens upward and lifts its parent account card above following cards',()=>{
 assert.ok(shell.includes('Q.some(ae=>ae.id===y)?"z-40":"z-10"'),
  'the expanded parent card must rise in the stacking order while a child menu is open');
 assert.ok(shell.includes('${ae.id===Q[Q.length-1].id?"bottom-9":"top-9"}'),
  'the last visible detail menu must open above its row instead of underneath the next card');
});

test('creating an account from a picker saves it and stays in the current account section',()=>{
 const start=shell.indexOf('Mr=({open:');
 const end=shell.indexOf(',W4=(',start);
 assert.ok(start>=0&&end>start,'the shared full-screen account picker is present');
 const picker=shell.slice(start,end);
 const createStart=picker.indexOf('ke=xe=>{');
 const createEnd=picker.indexOf(',Ee=(xe,Ce)=>',createStart);
 assert.ok(createStart>=0&&createEnd>createStart,'the add-account confirmation handler is present');
 const createHandler=picker.slice(createStart+'ke='.length,createEnd);
 const calls=[];
 const context={
  g:account=>calls.push(['save',account.id]),
  ee:update=>calls.push(['expand',update(['already-open'])]),
  E:group=>calls.push(['group',group]),
  X:query=>calls.push(['search',query]),
  W:form=>calls.push(['create-form',form]),
 };
 vm.runInNewContext(`globalThis.createAccount=${createHandler};`,context);
 context.createAccount({id:'created',group:'bank',parentId:'bank-parent'});
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
  ['save','created'],
  ['expand',['already-open','bank-parent']],
  ['group','bank'],
  ['search',''],
  ['create-form',null],
 ]);
 assert.ok(!createHandler.includes('m(xe)'),'saving does not auto-select the new account and close the picker');
 assert.ok(!createHandler.includes('p()'),'saving does not return to the transaction form');
 assert.ok(picker.includes('},[t]),M.useEffect(()=>{if(!t)return;const xe=Ce=>'),
  'account-list updates do not reset the picker group/search while it stays open');
});

test('account-list updates do not reinitialize a transaction draft',()=>{
 const start=shell.indexOf('Vq=({open:');
 const end=shell.indexOf(',W4=(',start);
 assert.ok(start>=0&&end>start,'the transaction form component is present');
 const transaction=shell.slice(start,end);
 const resetStart=transaction.indexOf('M.useEffect(()=>{if(!t)return;');
 const resetEnd=transaction.indexOf('const Xt=',resetStart);
 assert.ok(resetStart>=0&&resetEnd>resetStart,'the transaction form initialization effect is present');
 const resetEffect=transaction.slice(resetStart,resetEnd);
 assert.ok(resetEffect.includes('},[t,s,n,f]);'),'draft initialization only follows opening/type/shortcut/edit changes');
 assert.ok(!resetEffect.includes('[t,s,n,a,f]'),'an added account must not erase typed transaction values');
});
