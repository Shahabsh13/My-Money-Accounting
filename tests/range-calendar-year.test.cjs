const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js','utf8');
test('range year is display-only while previous/next month can still cross years',()=>{
 const a=source.indexOf('ul=({open:'),b=source.indexOf('data-hesabno-range-year',a);
 const prefix=source.slice(a,b);
 assert.ok(prefix.includes('j===1?(y(re=>re-1),k(12))'));
 assert.ok(prefix.includes('j===12?(y(re=>re+1),k(1))'));
 assert.ok(!source.includes('children:ce.map(re=>e.jsx("button",{type:"button",onClick:()=>{y(re),_(!1)}'));
 assert.ok(source.includes('e.jsx("span",{"data-hesabno-range-year":"true"'));
 const t=prefix.match(/T=\(\)=>\{(.+?)\},P=\(\)=>\{(.+?)\},I=rn/);assert.ok(t);
 function move(body,month,year){const ctx={j:month,year,month,y:fn=>{ctx.year=fn(ctx.year);},k:v=>{ctx.month=typeof v==='function'?v(ctx.month):v;}};vm.runInNewContext(body,ctx);return[ctx.year,ctx.month];}
 assert.deepEqual(move(t[1],1,1405),[1404,12]);assert.deepEqual(move(t[2],12,1405),[1406,1]);
 assert.deepEqual(move(t[1],7,1405),[1405,6]);assert.deepEqual(move(t[2],7,1405),[1405,8]);
});
