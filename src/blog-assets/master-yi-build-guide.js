// Rune / shard tooltips
(function(){
  var tip=document.getElementById('rune-tooltip');
  var tipName=tip.querySelector('.tip-name');
  var tipDesc=tip.querySelector('.tip-desc');
  var PAD=14;

  function show(el,e){
    tipName.textContent=el.dataset.tipName||'';
    tipDesc.textContent=el.dataset.tipDesc||'';
    tip.classList.add('visible');
    move(e);
  }
  function move(e){
    var x=e.clientX+PAD, y=e.clientY+PAD;
    var tw=tip.offsetWidth, th=tip.offsetHeight;
    if(x+tw>window.innerWidth) x=e.clientX-tw-PAD;
    if(y+th>window.innerHeight) y=e.clientY-th-PAD;
    tip.style.left=x+'px';
    tip.style.top=y+'px';
  }
  function hide(){tip.classList.remove('visible');}

  document.querySelectorAll('[data-tip-name]').forEach(function(el){
    el.addEventListener('mouseenter',function(e){show(el,e);});
    el.addEventListener('mousemove',move);
    el.addEventListener('mouseleave',hide);
  });
})();


// Load all icons from Riot Data Dragon CDN
(function(){
  var RUNE='https://ddragon.leagueoflegends.com/cdn/img/';
  // v2: icons start loading once the page has loaded, so the hero image gets the bandwidth first
  // (they keep loading=lazy, so the browser still skips ones far below the screen)
  var queue=[], ready=document.readyState==='complete';
  function load(el,url){ if(!el) return; if(ready) el.src=url; else queue.push([el,url]); }
  if(!ready) addEventListener('load',function(){ ready=true; queue.forEach(function(q){ q[0].src=q[1]; }); queue=[]; });

  // Rune icons don't need a patch version
  document.querySelectorAll('[data-rune]').forEach(function(el){
    load(el,RUNE+el.dataset.rune);
    el.classList.remove('loading');
  });

  // Item/spell/passive icons need the current patch version
  fetch('https://ddragon.leagueoflegends.com/api/versions.json')
    .then(function(r){return r.json();})
    .then(function(versions){
      var v=versions[0];
      var BASE='https://ddragon.leagueoflegends.com/cdn/'+v+'/img/';
      document.querySelectorAll('[data-item]').forEach(function(el){
        load(el,BASE+'item/'+el.dataset.item+'.png');
      });
      document.querySelectorAll('[data-spell]').forEach(function(el){
        load(el,BASE+'spell/'+el.dataset.spell+'.png');
      });
      document.querySelectorAll('[data-passive]').forEach(function(el){
        load(el,BASE+'passive/'+el.dataset.passive);
      });
      // Matchup champion icons
      var champs=['Elise','Rammus','Shaco'];
      champs.forEach(function(c){
        var icon=document.getElementById('icon-'+c.toLowerCase());
        var splash=document.getElementById('splash-'+c.toLowerCase());
        load(icon,BASE+'champion/'+c+'.png');
        load(splash,'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/'+c+'_0.jpg');
      });
    })
    .catch(function(){});
})();
