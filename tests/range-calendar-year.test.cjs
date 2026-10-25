const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {loadFromPrefix}=require('./helpers/production-slices.cjs');
const source=fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js','utf8');
test('annual ranges include Esfand 30 in leap years across reports and fiscal-year defaults',()=>{
 const isJalaliLeapYear=loadFromPrefix('f9=t=>',',rn=');
 const monthLength=loadFromPrefix('rn=(t,s)=>',',x9=',{f9:isJalaliLeapYear});
 const yearEnd=year=>`${year}/12/${String(monthLength(year,12)).padStart(2,'0')}`;
 assert.equal(yearEnd(1403),'1403/12/30');
 assert.equal(yearEnd(1404),'1404/12/29');
 assert.equal(yearEnd(1399),'1399/12/30');

 for (const marker of [
  'L=`${fe}/12/${String(rn(re,12)).padStart(2,"0")}`',
  'Ue=`${re-1}/12/${String(rn(re-1,12)).padStart(2,"0")}`',
  'L=`${We}/12/${String(rn(We,12)).padStart(2,"0")}`',
  'Ue=`${We-1}/12/${String(rn(We-1,12)).padStart(2,"0")}`',
  'Ce=`${ke}/12/${String(rn(parseInt(ke,10),12)).padStart(2,"0")}`',
  'xe=`${H}/12/${String(rn(parseInt(H,10),12)).padStart(2,"0")}`',
  'Te=`${R}/12/${String(rn(parseInt(R,10),12)).padStart(2,"0")}`',
  'We=`${me}/12/${String(rn(parseInt(me,10),12)).padStart(2,"0")}`',
  'endDate:`${t}/12/${String(rn(t,12)).padStart(2,"0")}`',
  'newFiscalYearEndDate:`${l}/12/${String(rn(l,12)).padStart(2,"0")}`',
  'Ce(`${nextYear}/12/${String(rn(nextYear,12)).padStart(2,"0")}`)',
  'Ee(`${nextYear}/01/01`)',
  '[V,X]=M.useState(f.endDate||`${I2(Rt())}/12/${String(rn(I2(Rt()),12)).padStart(2,"0")}`)',
 ]) assert.ok(source.includes(marker),`annual end date should be leap-aware: ${marker}`);
 assert.ok(source.includes('me=365+rn(re,12)-29'));
 assert.ok(source.includes('me=365+rn(We,12)-29'));
 assert.ok(!source.includes('}/12/29`'),'no annual range or fiscal-year default should hard-code Esfand 29');
});

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
