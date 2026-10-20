const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js','utf8');
test('loan/installment header stays compact in create and edit, without subtitle or record-name expansion',()=>{
 const start=source.indexOf('children:m==="purchases"?p==="lottery"?"قرعه‌کشی و صندوق"');
 assert.ok(start>0);
 const expression=source.slice(start+9,source.indexOf('})',start));
 for(const a of [null,{name:'نام طولانی وام قبلی'}]){
  for(const [m,p,want] of [['loans','bank','وام بانکی'],['purchases','purchase','اقساط'],['loans','org_loan','وام سازمانی'],['loans','personal','قرض شخصی'],['purchases','lottery','قرعه‌کشی و صندوق'],['purchases','other_installment','سایر اقساط']]){
   assert.equal(vm.runInNewContext(expression,{a,m,p}),want);
  }
 }
 assert.ok(!source.includes('تسهیلات بانکی، قرض‌الحسنه سازمانی، کارمزد و زمان‌بندی اقساط وام'));
 assert.ok(!source.includes('بیمه خودرو، دیجی‌کالا، اسنپ‌پی، قرعه‌کشی، شهریه و اقساط متفرقه'));
 assert.ok(source.includes('type:"text","data-hesabno-amount-keyboard-field":"false",value:g,onChange:Ge=>N(Ge.target.value),placeholder:p==="purchase"'));
});
