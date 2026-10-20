const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('transaction filter dates use short placeholders and attachment checkbox has explicit checked state',()=>{
 const source=fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js','utf8');
 const start=source.indexOf('نشان دادن گزارش با بازه زمانی :'),end=source.indexOf('فیلتر پیشرفته',start),filter=source.slice(start,end);
 assert.ok(filter.includes('hesabno-filter-date-range'));
 assert.ok(!filter.includes('۱۴۰۵/۰۶/'));
 assert.ok(filter.includes('placeholder:"از تاریخ"'));assert.ok(filter.includes('placeholder:"تا تاریخ"'));
 assert.ok(filter.includes('type:"checkbox",checked:x.hasAttachmentOnly,onChange:()=>f(T=>({...T,hasAttachmentOnly:!T.hasAttachmentOnly}))'));
 assert.ok(!filter.includes('onClick:()=>f(T=>({...T,hasAttachmentOnly:!T.hasAttachmentOnly}))'));
});
test('advanced filter has only back/reset header actions and compact date placeholders',()=>{
 const s=fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js','utf8');
 const start=s.indexOf('return c==="advanced"?'),end=s.indexOf('نشان دادن گزارش با بازه زمانی :',start),advanced=s.slice(start,end);
 const header=advanced.slice(advanced.indexOf('e.jsxs("header",'),advanced.indexOf('e.jsxs("div",{className:"grow overflow-y-auto'));
 assert.equal((header.match(/e\.jsxs\("button"/g)||[]).length,2);
 assert.ok(header.includes('children:"بازگشت"'));assert.ok(header.includes('children:"ریست"'));
 assert.ok(header.includes('onClick:()=>u("basic")'));assert.ok(header.includes('onClick:_'));
 assert.ok(!header.includes('"h1"'));assert.ok(!header.includes('bg-purple-800'));
 assert.ok(!advanced.includes('۱۴۰۵/۰۶/'));assert.ok(advanced.includes('hesabno-filter-category-field'));
});
test('advanced Apply shares transaction-submit positioning and reserves scroll space',()=>{
 const s=fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js','utf8');
 const start=s.indexOf('return c==="advanced"?'),end=s.indexOf('نشان دادن گزارش با بازه زمانی :',start),advanced=s.slice(start,end);
 assert.ok(advanced.includes('className:"hesabno-sticky-page-submit w-full'));
 assert.ok(advanced.includes('className:"hesabno-filter-submit-footer"'));
 const css=fs.readFileSync('app/src/main/assets/src/styles/235-hesabno-text-root-and-display-stability.css','utf8');
 assert.match(css,/\.hesabno-advanced-filter > \.grow\s*\{\s*padding-bottom: calc\(96px/);
 assert.ok(css.includes('body:has(.hesabno-advanced-filter) nav.fixed'));
});
