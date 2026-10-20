const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},console};vm.createContext(context);
for(const path of ['src/data/bank-sms-samples.js','src/scripts/005c-bank-sms-library.js'])vm.runInContext(fs.readFileSync('app/src/main/assets/'+path,'utf8'),context);
const {HnBankSmsSamples:banks,HnBankSmsLibrary:library}=context.window;
for(const bank of banks)for(const [index,sample]of bank.samples.entries())test(bank.name+' sample '+index,()=>{
 const actual=library.parse(sample.text,sample.sender);assert.ok(actual,'must identify a movement');assert.equal(actual.bankName,bank.name);assert.equal(actual.type,sample.type);assert.equal(actual.amount,sample.amount);if(sample.balance!==undefined)assert.equal(actual.balance,sample.balance);assert.ok(sample.source.startsWith('https://github.com/'));
});
test('ambiguous senderless shapes and OTP messages are not guessed',()=>{assert.equal(library.parse('رمز پویا 123456 بانک ملی'),null);assert.equal(library.parse('30101540968603\nمبلغ:397500-\nمانده:81294045'),null);});
test('user template overrides built-in for same bank, including changed bank keyword',()=>{
 const s=fs.readFileSync('app/src/main/assets/src/scripts/067-inline.js','utf8');const start=s.indexOf('function T1('),end=s.indexOf('function smsBankMatches',start);
 context.vk=()=>[];context.C9=[];vm.runInContext(s.slice(start,end)+';this.parseWithUser=T1;',context);
 const result=context.parseWithUser('بانک ملت\nمبلغ: 650000 ریال',[{id:'user-1',bankName:'بانک ملت',bankKeyword:'کلید ویژه',typeRule:'income',amountPrefix:'مبلغ'}]);assert.equal(result.matchedPatternId,'user-1');assert.equal(result.isCustomPattern,true);assert.equal(result.type,'income');assert.equal(result.amount,650000);
});
