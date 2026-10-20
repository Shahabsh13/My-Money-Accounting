/* Offline SMS parser. Returns integer rials; never guesses an amount from an account/date. */
(function (root) {
  'use strict';
  function normalize(value) {
    return String(value || '').replace(/[۰-۹]/g, function(c){return '۰۱۲۳۴۵۶۷۸۹'.indexOf(c);})
      .replace(/[٠-٩]/g, function(c){return '٠١٢٣٤٥٦٧٨٩'.indexOf(c);})
      .replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200e\u200f\u202a-\u202e]/g,'')
      .replace(/[٬،,]/g,'').replace(/\u200c/g,' ').trim();
  }
  function identify(text, sender) {
    var body=normalize(text), address=String(sender||'').replace(/\s/g,'').toLowerCase();
    var banks=root.HnBankSmsSamples||[];
    var byName=banks.filter(function(b){return b.keywords.some(function(k){return body.includes(normalize(k));});});
    if(byName.length===1)return byName[0];
    if(byName.length>1)return byName.find(function(b){return b.id==='blu';})||null;
    var bySender=banks.filter(function(b){return address&&b.senders.some(function(s){return s.replace(/\s/g,'').toLowerCase()===address;});});
    return bySender.length===1?bySender[0]:null;
  }
  function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  var NUMBER='([+-]?\\d+(?:\\.\\d+)?[+-]?)';
  function readNumber(value) {
    if(!/^[+-]?\d+[+-]?$/.test(value)||(/^[+-]/.test(value)&&/[+-]$/.test(value)))return null;
    var n=Number(value.replace(/[+-]/g,''));
    if(!Number.isSafeInteger(n))return null;
    return /^-|-$/.test(value)?-n:n;
  }
  function extract(text,template) {
    var body=normalize(text);
    if(/رمز|کد ورود|یکبار مصرف|یک بار مصرف/.test(body))return null;
    var lines=body.split(/\r?\n/).map(function(l){return l.trim();});
    var movement=lines.map(function(l){return l.split(/مانده|موجودی/)[0].trim();}).filter(Boolean);
    // Priority is across the whole message, not simply the first numeric-looking line.
    var prefix=normalize(template&&template.amountPrefix||'مبلغ');
    var rules=[new RegExp(escapeRegex(prefix)+'\\s*[:：]?\\s*'+NUMBER),
      new RegExp(NUMBER+'\\s*(?:ریال|تومان)'),
      new RegExp('(?:واریز(?:\\s+(?:حقوق|مبلغ))?|برداشت(?:\\s+مبلغ)?|انتقال|پایا|خریداینترنتی)\\s*[:：]?\\s*'+NUMBER),
      new RegExp('^'+NUMBER+'$')];
    var value=null, amountLine='';
    outer:for(var rule of rules)for(var line of movement){var match=line.match(rule);if(match){
      if(rule===rules[3]&&!/[+-]/.test(match[1]))continue;
      value=match[1];amountLine=line;break outer;
    }}
    if(value===null)return null;
    var signed=readNumber(value);if(signed===null||signed===0)return null;
    var direction=/^-|-$/.test(value)?'expense':/^\+|\+$/.test(value)?'income':null;
    if(template&&['income','expense'].indexOf(template.typeRule)!==-1)direction=template.typeRule;
    if(!direction){
      var incoming,outgoing;
      if(template&&(template.incomeKeywords||template.expenseKeywords)){
        var contains=function(words){return String(words||'').split(',').map(normalize).filter(Boolean).some(function(word){return body.includes(word);});};
        incoming=contains(template.incomeKeywords);outgoing=contains(template.expenseKeywords);
      }else{incoming=/واریز|بستانکار|حقوق|نشست|سود/.test(body);outgoing=/برداشت|خرید|بدهکار|کسر|پرید|پرداخت/.test(body);}
      if(incoming===outgoing)return null;
      direction=incoming?'income':'expense';
    }
    var amount=Math.abs(signed),balanceMatch=body.match(new RegExp('(?:مانده|موجودی)(?:\\s+کارت)?\\s*[:：]?\\s*'+NUMBER));
    var balance=balanceMatch?readNumber(balanceMatch[1]):undefined;
    if(balance===null)return null;
    var unitText=/ریال|تومان/.test(amountLine)?amountLine:body;
    if(/تومان/.test(unitText)&&!/ریال/.test(unitText)){amount*=10;if(balance!==undefined)balance*=10;}
    if(!Number.isSafeInteger(amount)||(balance!==undefined&&!Number.isSafeInteger(balance)))return null;
    var account=body.match(/حساب\s*[:：]?\s*([\d./-]+)/),card=body.match(/کارت\s*[:：]?\s*([\d*]+)/);
    return {type:direction,amount:amount,balance:balance,accountNumber:account?account[1]:undefined,cardNumber:card?card[1]:undefined};
  }
  function result(text,values,name,id,custom){
    if(!values)return null;
    return Object.assign({id:'sms-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),rawText:text,bankName:name,
      description:name+' - '+(values.type==='income'?'واریز':'برداشت'),isCustomPattern:custom,
      matchedPatternId:id,receivedAt:'امروز',isRegistered:false},values);
  }
  function parse(text,sender) {var bank=identify(text,sender);return bank?result(text,extract(text,null),bank.name,'builtin-'+bank.id,false):null;}
  function parseCustom(text,template) {return result(text,extract(text,template),template.bankName,template.id,true);}
  root.HnBankSmsLibrary={normalize:normalize,identify:identify,parse:parse,parseCustom:parseCustom,names:function(){return (root.HnBankSmsSamples||[]).map(function(b){return b.name;});}};
})(typeof window!=='undefined'?window:globalThis);
