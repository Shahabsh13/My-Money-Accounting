const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
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
