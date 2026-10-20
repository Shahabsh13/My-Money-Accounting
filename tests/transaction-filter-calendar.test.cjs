const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js','utf8');
const start=source.indexOf('yb={types:'),end=source.indexOf('},lN=fs.map',start)+1;
const component=source.slice(start,end);
function setup(mode){
 let cursor=0;const state=[],ctx={};
 const jsx=(type,props)=>({type,props});
 for(const m of component.matchAll(/e\.jsx[s]?\(([A-Za-z_$][\w$]*),/g))ctx[m[1]]=m[1];
 ctx.e={jsx,jsxs:jsx};ctx.M={useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},useEffect(){},useMemo:fn=>fn()};
 vm.createContext(ctx);vm.runInContext('var '+component+';',ctx);
 let applied=null,closed=0;
 const initial=JSON.parse(JSON.stringify(ctx.yb));
 const props={isOpen:true,initialMode:mode,filterState:initial,transactions:[],onApplyFilter:v=>applied=v,onClose:()=>closed++};
 const render=()=>{cursor=0;return ctx.F9(props);};
 function nodes(node){if(!node||typeof node!=='object')return[];return[node,...[node.props?.children].flat(Infinity).flatMap(nodes)];}
 return{render,nodes,get applied(){return applied;},get closed(){return closed;},initial};
}
for(const mode of ['basic','advanced'])test(`${mode}: both date fields open a mounted calendar and persist selection only on Apply`,()=>{
 const h=setup(mode);
 for(const [label,value] of [['از تاریخ','1405/07/01'],['تا تاریخ','1405/07/28']]){
  let tree=h.render(),nodes=h.nodes(tree),input=nodes.find(n=>n.type==='input'&&n.props['aria-label']===label);
  assert.ok(input);assert.equal(input.props.readOnly,true);
  const parent=nodes.find(n=>[n.props?.children].flat(Infinity).includes(input));
  assert.equal(typeof parent.props.onClick,'function');parent.props.onClick();
  nodes=h.nodes(h.render());let picker=nodes.find(n=>n.type==='Nk');
  assert.ok(picker,'calendar must be mounted in both modes');assert.equal(picker.props.open,true);
  picker.props.onChange(value);picker.props.onClose();
  nodes=h.nodes(h.render());picker=nodes.find(n=>n.type==='Nk');assert.equal(picker.props.open,false);
  assert.equal(nodes.find(n=>n.type==='input'&&n.props['aria-label']===label).props.value,value);
  assert.equal(h.applied,null);
 }
 assert.equal(h.initial.startDate,'');assert.equal(h.initial.endDate,'');
 const apply=h.nodes(h.render()).find(n=>n.type==='button'&&n.props.children==='اعمال فیلتر');
 apply.props.onClick();assert.equal(h.applied.startDate,'1405/07/01');assert.equal(h.applied.endDate,'1405/07/28');assert.equal(h.closed,1);
});
for(const mode of ['basic','advanced'])test(`${mode}: keyboard opens calendar and dismissing does not change dates`,()=>{
 const h=setup(mode);let nodes=h.nodes(h.render());
 const input=nodes.find(n=>n.type==='input'&&n.props['aria-label']==='از تاریخ');let prevented=false;
 input.props.onKeyDown({key:'Enter',preventDefault(){prevented=true;}});assert.equal(prevented,true);
 const picker=h.nodes(h.render()).find(n=>n.type==='Nk');assert.equal(picker.props.open,true);picker.props.onClose();
 nodes=h.nodes(h.render());assert.equal(nodes.find(n=>n.type==='input'&&n.props['aria-label']==='از تاریخ').props.value,'');
 assert.equal(h.applied,null);
});
