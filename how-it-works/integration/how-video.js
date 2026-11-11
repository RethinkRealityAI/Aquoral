
/* How it works loops.
   - Videos are fetched as blobs so iOS/WebKit can play them even where the host does not answer byte-range requests.
   - Autoplay is muted + inline; if the browser refuses (Low Power Mode, data saver, reduced motion) a play button appears. */
(function(){
  var vids=[].slice.call(document.querySelectorAll('video[data-src]'));
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  function source(v){
    if(v._src) return v._src;
    v.muted=true; v.defaultMuted=true; v.setAttribute('muted',''); v.playsInline=true;
    v._src=fetch(v.dataset.src).then(function(r){ if(!r.ok) throw 0; return r.blob(); })
      .then(function(b){ v.src=URL.createObjectURL(b.type?b:new Blob([b],{type:'video/mp4'})); })
      .catch(function(){ v.src=v.dataset.src; });
    v.addEventListener('error',function(){ if(v.src.indexOf('blob:')===0){ v.src=v.dataset.src; } });
    return v._src;
  }
  function btn(v){ return v.parentNode.querySelector('.play'); }
  function play(v,user){
    return source(v).then(function(){ var p=v.play(); return p&&p.then?p:Promise.resolve(); })
      .then(function(){ v.parentNode.classList.add('is-playing'); if(user) v._user=true; })
      .catch(function(){ v.parentNode.classList.remove('is-playing'); btn(v).hidden=false; });
  }
  vids.forEach(function(v){
    var b=document.createElement('button'); b.type='button'; b.className='play'; b.hidden=!reduce;
    b.setAttribute('aria-label','Play animation');
    b.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
    b.addEventListener('click',function(){ b.hidden=true; play(v,true); });
    v.parentNode.appendChild(b);
  });
  if(reduce) return; // poster stays as the still until the visitor taps play
  if(!('IntersectionObserver' in window)){ vids.forEach(function(v){ play(v); }); return; }
  var io=new IntersectionObserver(function(es){ es.forEach(function(e){ var v=e.target;
    if(e.isIntersecting){ play(v); } else if(!v.paused){ v.pause(); } }); },{rootMargin:'200px 0px',threshold:0.15});
  vids.forEach(function(v){ io.observe(v); });
})();
