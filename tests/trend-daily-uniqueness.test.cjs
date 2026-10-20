const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js','utf8');
const start=source.indexOf('function bg('),end=source.indexOf('const gg=',start);
function compute(transactions,period='7days'){
 const context={Rt:()=> '1405/07/29',us:()=> 'مهر',ns:(_,offset)=>`1405/07/${29+offset}`,
 Cs:t=>({income:t.type==='income'?t.amount:0,expense:t.type==='expense'?t.amount:0,fee:0}),
 E1:Array.from({length:8},(_,i)=>({label:`${i*3}:00`}))};
 vm.runInNewContext(source.slice(start,end),context);
 return context.bg(transactions,[],period);
}
test('one equal income and expense on the same day produce one nonzero point, not two peaks',()=>{
 const result=compute([{date:'1405/07/28',type:'income',amount:20000000},{date:'1405/07/28',type:'expense',amount:20000000}]);
 assert.equal(result.dailyData.length,7);
 assert.equal(new Set(result.dailyData.map(row=>row.date)).size,7);
 const active=result.dailyData.filter(row=>row.txCount);
 assert.equal(active.length,1);assert.equal(active[0].txCount,2);
 assert.equal(active[0].income,20000000);assert.equal(active[0].expense,20000000);
 assert.equal(result.periodNet,0);
 assert.equal(result.dailyData.reduce((sum,row)=>sum+row.income,0),result.periodIncome);
 assert.equal(result.dailyData.reduce((sum,row)=>sum+row.expense,0),result.periodExpense);
});
test('empty daily and today-hourly series retain expected point counts',()=>{
 assert.equal(compute([]).dailyData.length,7);
 assert.equal(compute([],'today').dailyData.length,8);
});
