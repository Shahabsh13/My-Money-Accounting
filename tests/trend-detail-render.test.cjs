const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js','utf8');
function render(hidden=false,empty=false){
 const a=source.indexOf('y9=({transactions:'),b=source.indexOf(',j9=({transactions:',a);
 const days=[{date:'1405/07/28',shortLabel:'1405/07/28',income:0,expense:0,txCount:0},{date:'1405/07/29',shortLabel:'1405/07/29',income:empty?0:20,expense:empty?0:20,txCount:empty?0:2}];
 const jsx=(type,props)=>({type,props});const ctx={M:{useState:()=>[null,()=>{}],useMemo:fn=>fn()},e:{jsx,jsxs:jsx},bg:()=>({currentMonthName:'مهر',dailyData:days,periodIncome:20,periodExpense:20,periodNet:0}),Ze:v=>`${v} ریال`,te:String,window:{__hesabnoDateLabel:()=> 'امروز، ۲۹ مهر ۱۴۰۵'}};
 for(const icon of ['kE','xa','no','zn','gg','fc'])ctx[icon]=icon;
 const fn=vm.runInNewContext('('+source.slice(a+3,b)+')',ctx);
 return fn({hidden,currency:'ریال'});
}
function nodes(tree){const out=[];function walk(n){if(!n||typeof n!=='object')return;if(n.props)out.push(n);const c=n.props&&n.props.children;(Array.isArray(c)?c:[c]).flat(Infinity).forEach(walk)}walk(tree);return out;}
test('equal income/expense use adjacent bars, and details contain one formatted date',()=>{
 const all=nodes(render());const bars=all.filter(n=>n.props['data-hesabno-trend-bar']);assert.equal(bars.length,4);
 assert.notEqual(bars[2].props.x,bars[3].props.x);assert.equal(bars[2].props.height,bars[3].props.height);
 const detail=all.find(n=>n.props['data-hesabno-trend-detail']);const text=JSON.stringify(detail);assert.equal((text.match(/امروز، ۲۹ مهر ۱۴۰۵/g)||[]).length,1);assert.ok(text.includes('خالص روز'));
});
test('hidden chart details do not disclose amounts and empty days show a plain message',()=>{
 const detail=nodes(render(true)).find(n=>n.props['data-hesabno-trend-detail']);assert.ok(JSON.stringify(detail).includes('••••••'));assert.ok(!JSON.stringify(detail).includes('20 ریال'));
 const empty=nodes(render(false,true)).find(n=>n.props['data-hesabno-trend-detail']);assert.ok(JSON.stringify(empty).includes('تراکنشی ثبت نشده'));
});
