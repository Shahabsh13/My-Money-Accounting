const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js','utf8');
const start=source.indexOf('function _0('),end=source.indexOf('const _firedSmsNotifs',start);
const match=vm.runInNewContext(source.slice(start,end)+';_0');
test('SMS bank matching rejects unrelated, non-bank and ambiguous accounts',()=>{
 assert.equal(match('بلوبانک',[{name:'دکون بلوبانک و داداش‌ها',group:'bank'}]),undefined);
 assert.equal(match('بلوبانک',[{name:'بلوبانک',group:'expense'}]),undefined);
 assert.equal(match('بلوبانک',[{name:'بلو',group:'bank'},{name:'بلو',group:'bank'}]),undefined);
 const account={name:'حساب شخصی',bankName:'بلوبانک',group:'bank'};
 assert.equal(match('بلوبانک',[account]),account);
 assert.equal(match('بانک شتاب',[{name:'شتاب',group:'bank'}]),undefined);
});
test('SMS analyzer exposes clear and clipboard fallback controls',()=>{
 assert.ok(source.includes('پاک کردن متن و نتیجه'));
 assert.ok(source.includes('j("");S(null);setPasteStatus("")'));
 assert.ok(source.includes('داخل کادر نگه دارید'));
 assert.ok(source.includes('role:"status"'));
});
test('analyzer clear is conditional and pattern bank picker uses existing logos',()=>{
 assert.ok(source.includes('y.length>0&&e.jsx("button",{type:"button",onClick:()=>{j("");S(null);setPasteStatus("")}'));
 assert.ok(source.includes('aria-haspopup":"dialog"'));
 assert.ok(source.includes('children:fs.filter(bank=>smsBankMatches(bank,bankSearch)).map(bank=>'));
 assert.ok(!source.includes('placeholder:"مثلاً: بانک گردشگری، بانک سینا، آینده"'));
 assert.ok(source.includes('e.jsx(Pa,{bankName:bank.name,size:28})'));
 assert.ok(source.includes('P(bank.name);U(bank.shortName);setBankPickerOpen(!1)'));
});

test('bank search normalizes Persian letters and whitespace',()=>{
 const start=source.indexOf('function smsBankMatches(');
 const match=vm.runInNewContext(source.slice(start,source.indexOf('function _0(',start))+';smsBankMatches');
 assert.equal(match({name:'بانک ملی ایران',shortName:'ملی'},'ملي'),true);
 assert.equal(match({name:'بلوبانک',shortName:'بلو'},'بلو بانک'),true);
 assert.equal(match({name:'بانک ملت',shortName:'ملت'},'رفاه'),false);
 assert.equal(match({name:'بانک ملت'},''),true);
});

test('permissions heading has no badge and stays beside the RTL back button',()=>{
 assert.ok(!source.includes('children:"مجوزهای سیستم"'));
 assert.ok(source.includes('justify-start gap-3 border-b border-stone-800 pb-3 flex-shrink-0",dir:"rtl"'));
 assert.ok(source.includes('aria-label":"بازگشت از مدیریت دسترسی‌ها"'));
});
