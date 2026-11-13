/* CA Clover: left-top Clover always navigates to the My Community home. */
(function(){
  'use strict';
  const asset=document.currentScript;
  if(!asset||!asset.src)return;
  const home=new URL('index.html#my',asset.src);
  const page=window.location.pathname;
  const isHome=page===new URL('index.html',asset.src).pathname||page===new URL('.',asset.src).pathname;
  const href=isHome?'#my':home.href;
  const label='CA Cloverのトップ画面へ戻る';
  function mark(a){
    a.setAttribute('data-ca-home-link','true');
    a.setAttribute('aria-label',label);
    a.setAttribute('title',label);
    a.classList.add('ca-home-target');
    if(isHome)a.addEventListener('click',function(){
      if(window.location.hash==='#my'||!window.location.hash)window.scrollTo({top:0,behavior:'auto'});
    });
  }
  function link(cls){
    const a=document.createElement('a');
    a.href=href;a.className=cls;a.textContent='🍀';mark(a);return a;
  }
  function install(){
    if(document.querySelector('[data-ca-home-link]'))return;
    const emblem=document.querySelector('body > header .logo, body > header .mark, main > header .logo, main > header .mark');
    if(emblem){
      if(emblem.tagName.toLowerCase()==='a'){emblem.href=href;mark(emblem);}
      else{const a=link(emblem.className);a.innerHTML=emblem.innerHTML;emblem.replaceWith(a);}
      return;
    }
    const brand=document.querySelector('main > header > strong');
    if(brand&&brand.textContent.includes('🍀')){
      const a=link('ca-home-brand-link');a.textContent='';
      brand.parentNode.insertBefore(a,brand);a.appendChild(brand);return;
    }
    const headerBar=document.querySelector('body > header .topin, body > header .top, body > header .head');
    if(headerBar){headerBar.insertBefore(link('ca-home-icon'),headerBar.firstChild);return;}
    if(page.endsWith('/suzuki-pm-revolution.html')||document.body.dataset.caCloverGame==='true'){
      document.body.appendChild(link('ca-home-icon ca-home-game'));return;
    }
    const toolbar=document.querySelector('main .head, main .top');
    if(toolbar){toolbar.insertBefore(link('ca-home-icon'),toolbar.firstChild);return;}
    const main=document.querySelector('main');
    if(main){
      const row=document.createElement('div');row.className='ca-home-row';
      row.appendChild(link('ca-home-icon'));main.insertBefore(row,main.firstChild);return;
    }
    document.body.insertBefore(link('ca-home-icon ca-home-game'),document.body.firstChild);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();