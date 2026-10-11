(function(){
  var MO=window.MutationObserver; if(!MO||MO.__hnGuard)return;
  function Guarded(cb){
    var self=this, queue=[], timer=0, running=false, inner, last=0, burst=0;
    function flush(){
      timer=0; if(!queue.length)return; var now=Date.now(); burst=(now-last<100)?burst+1:0; last=now;
      var recs=queue; queue=[]; running=true;
      try{cb.call(self,recs,self);}catch(e){console.error('[hesabno observer]',e);}
      finally{ try{inner.takeRecords();}catch(e){} running=false; }
    }
    inner=new MO(function(recs){
      if(running)return;
      for(var i=0;i<recs.length;i++)queue.push(recs[i]);
      if(queue.length>500)queue=queue.slice(-500);
      if(!timer){ if(burst<8){timer=1;queueMicrotask(flush);} else timer=setTimeout(flush,80); }
    });
    this.observe=function(t,o){return inner.observe(t,o);};
    this.disconnect=function(){queue=[];if(timer){clearTimeout(timer);timer=0;}return inner.disconnect();};
    this.takeRecords=function(){var r=queue.concat(inner.takeRecords());queue=[];return r;};
  }
  Guarded.prototype=MO.prototype; Guarded.__hnGuard=true;
  window.MutationObserver=Guarded;
  var SI=window.setInterval;
  window.setInterval=function(fn,ms){
    var a=[].slice.call(arguments,2);
    if(typeof fn!=='function')return SI.apply(window,arguments);
    return SI.call(window,function(){ if(document.hidden)return; fn.apply(window,a); },Math.max(ms||0,250));
  };
})();
