const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {parseCss}=require('../tools/bench/css-parser.cjs');
function luminance(hex){const c=hex.match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];}
test('transaction amount colors are saturated, readable and not applied to transfers/reversals',()=>{
 const {rules}=parseCss(fs.readFileSync('app/src/main/assets/src/styles/235-hesabno-text-root-and-display-stability.css','utf8'));
 for(const [tone,color] of [['income','00752b'],['expense','c90025']]){
  const rule=rules.find(r=>r.selector.includes('[data-hesabno-transaction-amount]')&&r.selector.includes(`[data-hesabno-amount-tone="${tone}"]`));
  assert.ok(rule);assert.ok(rule.body.includes(`#${color} !important`));
  assert.doesNotMatch(rule.body,/font-size\s*:/,'light-theme color overrides must not change the class-defined amount size');
  assert.doesNotMatch(rule.body,/line-height\s*:/,'light-theme color overrides must not change the class-defined amount line height');
  for(const bg of ['e2e8f0','e4eef4','ffffff'])assert.ok((luminance(bg)+.05)/(luminance(color)+.05)>=4.5,`${tone} on ${bg}`);
 }
 const shell=fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js','utf8');
 assert.ok(shell.includes('"data-hesabno-amount-tone":A.isReversal?"reversal":A.type'));
 assert.ok(shell.includes('className:`text-[12px] sm:text-[13px] font-black tracking-tight leading-none'),
  'transaction amounts must retain their shared responsive text size in both themes');
 const contrast=fs.readFileSync('app/src/main/assets/src/scripts/901-light-theme-contrast.js','utf8');
 assert.ok(contrast.includes('[data-hesabno-transaction-amount][data-hesabno-amount-tone="income"]'));
 assert.ok(contrast.includes('[data-hesabno-transaction-amount][data-hesabno-amount-tone="expense"]'));
});
