/* Offline SMS format library. Amounts returned in rials; no network or inbox writes. */
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
    // Body identity wins (Blu is a distinct account from Saman).
    var byName=banks.filter(function(b){return b.keywords.some(function(k){return body.includes(normalize(k));});});
    if(byName.length===1)return byName[0];
    if(byName.length>1)return byName.find(function(b){return b.id==='blu';})||null;
    var bySender=banks.filter(function(b){return address&&b.senders.some(function(s){return s.replace(/\s/g,'').toLowerCase()===address;});});
    return bySender.length===1?bySender[0]:null;
  }
  function parse(text,sender) {
    var bank=identify(text,sender), body=normalize(text);
    if(!bank||/رمز|کد ورود|یکبار مصرف/.test(body))return null;
    var lines=body.split(/\r?\n/).map(function(l){return l.trim();});
    var movement=lines.map(function(l){return l.split(/مانده|موجودی/)[0].trim();}).filter(Boolean);
    var value=null, direction=null;
    // Prefer an explicit amount, never a card/account/date/remaining balance.
    for(var line of movement){
      var m=line.match(/(?:مبلغ|واریز(?:\s+(?:حقوق|مبلغ))?|برداشت(?:\s+مبلغ)?|انتقال|پایا|خریداینترنتی)\s*[:：]?\s*([+-]?\d+[+-]?)/);
      if(!m)m=line.match(/([+-]?\d+[+-]?)\s*ریال/);
      if(!m)m=line.match(/^([+-]\d+|\d+[+-])$/);
      if(m){value=m[1];direction=/^-|-$/.test(value)?'expense':/^\+|\+$/.test(value)?'income':null;break;}
    }
    if(value===null)return null;
    if(!direction){var incoming=/واریز|بستانکار|حقوق|نشست|سود/.test(body),outgoing=/برداشت|خرید|بدهکار|کسر|پرید|پرداخت/.test(body);if(incoming===outgoing)return null;direction=incoming?'income':'expense';}
    var amount=Number(value.replace(/[+-]/g,''));if(!Number.isSafeInteger(amount)||amount<=0)return null;
    var balanceMatch=body.match(/(?:مانده|موجودی)(?:\s+کارت)?\s*[:：]?\s*(-?\d+)/);
    var balance=balanceMatch?Number(balanceMatch[1]):undefined;
    if(/تومان/.test(body)&&!/ریال/.test(body)){amount*=10;if(balance!==undefined)balance*=10;}
    var account=body.match(/حساب\s*[:：]?\s*([\d./-]+)/),card=body.match(/کارت\s*[:：]?\s*([\d*]+)/);
    return {id:'sms-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),rawText:text,type:direction,amount:amount,bankName:bank.name,balance:balance,accountNumber:account?account[1]:undefined,cardNumber:card?card[1]:undefined,description:bank.name+' - '+(direction==='income'?'واریز':'برداشت'),isCustomPattern:false,matchedPatternId:'builtin-'+bank.id,receivedAt:'امروز',isRegistered:false};
  }
  root.HnBankSmsLibrary={normalize:normalize,identify:identify,parse:parse,names:function(){return (root.HnBankSmsSamples||[]).map(function(b){return b.name;});}};
})(typeof window!=='undefined'?window:globalThis);
