(function(){
"use strict";
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);}
function url(client,community){
  if(!community)return"";
  if(community.avatar_thumbnail_path){
    const data=client.storage.from("community-icon-thumbs").getPublicUrl(community.avatar_thumbnail_path).data;
    return data.publicUrl+(community.avatar_last_changed_at?"?v="+encodeURIComponent(community.avatar_last_changed_at):"");
  }
  return community.avatar_url||"";
}
function img(client,community,attrs){
  const src=url(client,community),original=community&&community.avatar_url||"";
  if(!src)return"";
  return '<img data-ca-community-icon="1" data-original="'+esc(original)+'" src="'+esc(src)+'" '+(attrs||"")+'>';
}
function bind(root){
  (root||document).querySelectorAll('img[data-ca-community-icon="1"]').forEach(image=>{
    if(image.dataset.caBound==="1")return;
    image.dataset.caBound="1";
    image.addEventListener("error",()=>{
      const original=image.dataset.original||"";
      if(original&&image.dataset.caOriginalTried!=="1"&&image.src!==original){image.dataset.caOriginalTried="1";image.src=original;return;}
      image.style.display="none";
    });
  });
}
window.CACommunityIcon={url,img,bind};
})();

(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;

const SUZUKI_NAME="suzukipm";
const ASSET_VERSION="20260923-1820";
const EMBLEM_SRC="./suzuki-special/é‡‘è‰²ç«œã®ç´‹ç« ç›¾.png?v="+ASSET_VERSION;

let phase="idle";
let tapCount=0;
let bypassNext=false;
let targetButton=null;
let root=null;
let currentScale=.84;
let audioContext=null;
const timers=[];

const emblemPreload=new Image();
emblemPreload.src=EMBLEM_SRC;

function schedule(fn,ms){
  const id=setTimeout(()=>{const i=timers.indexOf(id);if(i>=0)timers.splice(i,1);fn();},ms);
  timers.push(id);return id;
}
function clearTimers(){while(timers.length)clearTimeout(timers.pop());}

function ensureAudio(userGesture){
  const Ctor=window.AudioContext||window.webkitAudioContext;
  if(!Ctor)return null;
  if(audioContext&&audioContext.state==="closed")audioContext=null;
  if(!audioContext)audioContext=new Ctor();
  if(audioContext.state==="suspended"){
    try{const p=audioContext.resume();if(p&&p.catch)p.catch(()=>{});}catch(_){}
  }
  if(userGesture){
    try{
      const now=audioContext.currentTime;
      const osc=audioContext.createOscillator(),gain=audioContext.createGain();
      gain.gain.setValueAtTime(.00001,now);gain.gain.setValueAtTime(.00001,now+.03);
      osc.connect(gain).connect(audioContext.destination);osc.start(now);osc.stop(now+.035);
    }catch(_){}
  }
  return audioContext;
}

function heartbeat(strength){
  const context=ensureAudio(false);if(!context||context.state!=="running")return;
  const now=context.currentTime;
  [[0,.19*strength,68],[.105,.105*strength,54]].forEach(([offset,volume,freq])=>{
    const osc=context.createOscillator(),gain=context.createGain();
    osc.type="sine";osc.frequency.setValueAtTime(freq,now+offset);osc.frequency.exponentialRampToValueAtTime(34,now+offset+.17);
    gain.gain.setValueAtTime(.0001,now+offset);gain.gain.exponentialRampToValueAtTime(volume,now+offset+.024);gain.gain.exponentialRampToValueAtTime(.0001,now+offset+.2);
    osc.connect(gain).connect(context.destination);osc.start(now+offset);osc.stop(now+offset+.23);
  });
}

function footstep(near){
  const context=ensureAudio(true);if(!context)return;
  const now=context.currentTime;
  const duration=near?.62:.72;
  const len=Math.max(1,Math.floor(context.sampleRate*duration));
  const buffer=context.createBuffer(1,len,context.sampleRate),data=buffer.getChannelData(0);
  let seed=near?7717:3121,low=0,phase=0;
  for(let i=0;i<len;i++){
    seed=(seed*1664525+1013904223)>>>0;
    const n=(seed/0xffffffff)*2-1,t=i/context.sampleRate;
    low=low*.965+n*.035;
    phase+=Math.PI*2*(near?62:45)/context.sampleRate;
    const env=Math.min(1,t/.018)*Math.exp(-t*(near?6.2:4.2));
    data[i]=(Math.sin(phase)*.66+low*1.15)*env;
  }
  const source=context.createBufferSource();source.buffer=buffer;
  const lowpass=context.createBiquadFilter();lowpass.type="lowpass";lowpass.frequency.value=near?2500:850;
  const bass=context.createBiquadFilter();bass.type="lowshelf";bass.frequency.value=150;bass.gain.value=near?5:3;
  const gain=context.createGain();gain.gain.value=near?.95:.7;
  source.connect(lowpass).connect(bass).connect(gain).connect(context.destination);source.start(now);
}

function dragonRoar(){
  const context=ensureAudio(true);if(!context)return;
  const now=context.currentTime,duration=1.45,len=Math.floor(context.sampleRate*duration);
  const buffer=context.createBuffer(1,len,context.sampleRate),data=buffer.getChannelData(0);
  let seed=9031,low=0,phase=0;
  for(let i=0;i<len;i++){
    seed=(seed*1664525+1013904223)>>>0;
    const n=(seed/0xffffffff)*2-1,t=i/context.sampleRate;
    low=low*.93+n*.07;
    const f=115+45*Math.sin(Math.PI*2*1.8*t)+85*Math.exp(-t*1.7);
    phase+=Math.PI*2*f/context.sampleRate;
    const env=Math.min(1,t/.08)*Math.pow(Math.max(0,1-t/duration),.33);
    data[i]=(Math.sin(phase)*.32+Math.sin(phase*.51)*.22+low*.72)*env;
  }
  const source=context.createBufferSource();source.buffer=buffer;
  const filter=context.createBiquadFilter();filter.type="bandpass";filter.frequency.value=165;filter.Q.value=.55;
  const gain=context.createGain();gain.gain.value=.88;
  source.connect(filter).connect(gain).connect(context.destination);source.start(now);
}

function fireBreath(){
  const context=ensureAudio(false);if(!context)return;
  if(context.state==="suspended"){try{context.resume().catch(()=>{});}catch(_){}}
  const now=context.currentTime,duration=3.0,len=Math.floor(context.sampleRate*duration);
  const buffer=context.createBuffer(1,len,context.sampleRate),data=buffer.getChannelData(0);
  let seed=18181,smooth=0,prev=0;
  for(let i=0;i<len;i++){
    seed=(seed*1664525+1013904223)>>>0;
    const raw=(seed/0xffffffff)*2-1,t=i/context.sampleRate;
    const high=raw-prev;prev=raw;smooth=smooth*.956+raw*.044;
    const fadeIn=Math.min(1,t/.12),fadeOut=Math.min(1,(duration-t)/.5),flutter=.72+.28*Math.sin(Math.PI*2*6.5*t);
    data[i]=(smooth*.88+high*.12)*fadeIn*fadeOut*flutter;
  }
  const source=context.createBufferSource();source.buffer=buffer;
  const filter=context.createBiquadFilter();filter.type="lowpass";filter.frequency.value=2300;
  const gain=context.createGain();gain.gain.value=.58;
  source.connect(filter).connect(gain).connect(context.destination);source.start(now);
}

function isSuzukiButton(button){
  const raw=button&&button.textContent||"",text=raw.replace(/\s+/g," ").trim();
  if(!text.toLowerCase().includes(SUZUKI_NAME))return false;
  if(/ãƒ»\s*SuzukiPM/i.test(text))return true;
  const markers=(raw.match(/[â—â—‹]/g)||[]).length;
  return markers===1&&/[â—â—‹]\s*SuzukiPM/i.test(raw);
}

function shieldFallback(){
 return '<svg viewBox="0 0 300 340" aria-hidden="true"><defs><linearGradient id="szg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe98a"/><stop offset=".45" stop-color="#c78b27"/><stop offset="1" stop-color="#63300f"/></linearGradient></defs><path d="M150 10 270 52v106c0 79-46 138-120 172C76 296 30 237 30 158V52Z" fill="url(#szg)" stroke="#f2ca58" stroke-width="5"/><path d="M184 62c-43 6-76 31-84 66 28-13 51-10 66 4-47 4-77 27-83 66 25-19 50-24 73-14-31 18-43 46-33 76 14-25 36-39 65-42-15 21-16 43-3 66 4-30 20-52 46-65 2²È="25±…Ñ” À¥ôÄÈ•íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ” áÁà°ÄÁÁà¥ôÈĞ•íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ” ´áÁà°´İÁà¥ôÌØ•íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ” İÁà°´åÁà¥ôĞà•íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ” ´ÙÁà°áÁà¥ôØÀ•íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ” ÕÁà°´ÕÁà¥ôÜÈ•íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ” ´ÑÁà°ÕÁà¥õõ­•å™É…µ•ÌÍé¥É•	…­ìÀ•íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d äÔ”¤Í…±” ¸ä¤í½Á…¥ÑäèÁôÈÔ•í½Á…¥Ñäè¸ÜÉôØÀ•íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d à”¤Í…±” Ä¸ÄÔ¤í½Á…¥Ñäè¸àÉôÄÀÀ•íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ´ÌÀ”¤Í…±” ¸äØ¤í½Á…¥ÑäèÁõõ­•å™É…µ•ÌÍé¥É•É½¹ÑìÀ•íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ÄÀÔ”¤Í…±•` ¸à¤í½Á…¥ÑäèÁôÄØ•í½Á…¥Ñäè¸àáôĞÔ•íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ÄÈ”¤Í…±•` Ä¸Àà¤í½Á…¥ÑäèÅôÜà•í½Á…¥Ñäè¸ÜÉôÄÀÀ•íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ´ÈÈ”¤Í…±•` ¸ä¤í½Á…¥ÑäèÁõõ­•å™É…µ•ÌÍéMÁ…É­ìÀ•íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ”Í À°À°À¤Í…±” ¸ÔÔ¤í½Á…¥ÑäèÁôÄà•í½Á…¥ÑäèÅôÄÀÀ•íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ”Í¡Ù…È ´µà¤±Ù…È ´µä¤°À¤Í…±” ¸ÀÔ¤í½Á…¥ÑäèÁõõ­•å™É…µ•ÌÍéMµ½­•ìÀ•íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ÄÙÁà¤Í…±” ¸ÜÔ¤í½Á…¥ÑäèÁôÈÔ•í½Á…¥Ñäè¸ÌÑôÄÀÀ•íÑÉ…¹Í™½É´éÑÉ…¹Í±…Ñ•d ´äÕÁà¤Í…±” Ä¸ĞÔ¤í½Á…¥ÑäèÁõô(€€í‘½Õµ•¹Ğ¹¡•…¹…ÁÁ•¹‘¡¥±¡ÍÑå±”¤ì(€É½½Ğõ‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ ‰‘¥Øˆ¤íÉ½½Ğ¹¥ô‰ÍÕéÕ­¥MÁ•¥…±A…•ÌˆíÉ½½Ğ¹ÍÑå±”¹‘¥ÍÁ±…äô‰¹½¹”ˆí‘½Õµ•¹Ğ¹‰½‘ä¹…ÁÁ•¹‘¡¥±¡É½½Ğ¤íÉ•ÑÕÉ¸É½½Ğì)ô()™Õ¹Ñ¥½¸Í•Ñ±…Í ¡ÑåÁ”¥í¥˜ …É½½Ğ¥É•ÑÕÉ¸í½¹ÍĞ˜õÉ½½Ğ¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Íèµ™±…Í ˆ¤í¥˜ …˜¥É•ÑÕÉ¸í˜¹±…ÍÍ9…µ”ô‰Íèµ™±…Í ˆ¬¡ÑåÁ”üˆ½¸ˆèˆˆ¤í˜¹ÍÑå±”¹‰…­É½Õ¹õÑåÁ”ôôô‰İ¡¥Ñ”ˆü‰É‰„ ÈÔÔ°ÈÌà°ÈÄÔ°¸äÈ¤ˆéÑåÁ”ôôô‰‘…É­É•ˆü‰É‰„ Øà°À°À°¸àØ¤ˆè‰É‰„ ÄÜĞ°ÄÈ°Ô°¸Ğà¤ˆí˜¹ÍÑå±”¹µ¥á	±•¹‘5½‘”õÑåÁ”ôôô‰İ¡¥Ñ”ˆü‰ÍÉ••¸ˆè‰¹½Éµ…°ˆíô)™Õ¹Ñ¥½¸ÕÁ‘…Ñ•É…½¸¡Í…±”±‰É¥¡Ñ¹•ÍÌ±½Á…¥Ñä±±½Ü¥í¥˜ …É½½Ğ¥É•ÑÕÉ¸í½¹ÍĞ”õÉ½½Ğ¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Íèµ•µ‰±•´ˆ¤í¥˜ …”¥É•ÑÕÉ¸í”¹ÍÑå±”¹ÑÉ…¹Í™½É´õÍ…±” ‘íÍ…±•ô¥€í”¹ÍÑå±”¹½Á…¥ÑäõMÑÉ¥¹œ¡½Á…¥Ñä¤í”¹ÍÑå±”¹™¥±Ñ•Èõ‰É¥¡Ñ¹•ÍÌ ‘í‰É¥¡Ñ¹•ÍÍô¤‘É½ÀµÍ¡…‘½Ü À€À€‘ìÄà­±½Ü¨ÔÑõÁàÉ‰„ ÄØĞ°ÈÀ°ÄÀ°‘ì¸Äà­±½Ü¨¸ĞÕô¤¥€íô)™Õ¹Ñ¥½¸Í•ÑM¡…­”¡±•Ù•°¥í¥˜ …É½½Ğ¥É•ÑÕÉ¸í½¹ÍĞ¸õÉ½½Ğ¹™¥ÉÍÑ±•µ•¹Ñ¡¥±‘ññÉ½½Ğí¸¹±…ÍÍ1¥ÍĞ¹É•µ½Ù” ‰ÍèµÍ¡…­”Äˆ°‰ÍèµÍ¡…­”Èˆ°‰ÍèµÍ¡…­”Ìˆ¤íÙ½¥¸¹½™™Í•Ñ]¥‘Ñ í¥˜¡±•Ù•°¥¸¹±…ÍÍ1¥ÍĞ¹…‘ ‰ÍèµÍ¡…­”ˆ­±•Ù•°¤íô()™Õ¹Ñ¥½¸É•¹‘•ÉI¥ÑÕ…° ¥ì(€½¹ÍĞ•°õ•¹ÍÕÉ•I½½Ğ ¤í•°¹ÍÑå±”¹‘¥ÍÁ±…äô‰‰±½¬ˆí•°¹ÍÑå±”¹½Á…¥ÑäôˆÄˆí•°¹ÍÑå±”¹Á½¥¹Ñ•ÉÙ•¹ÑÌô‰…ÕÑ¼ˆì(€•°¹¥¹¹•É!Q50ôœñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÌô‰Íèµ‰±…¬ˆ…É¥„µ±…‰•°ô‰MÕéÕ­¥A4ÍÁ•¥…°É¥ÑÕ…°ˆøñ‘¥Ø±…ÍÌô‰Íèµ‰œˆøğ½‘¥Øøñ‘¥Ø±…ÍÌô‰Íèµ•¹Ñ•Èˆøñ‘¥Ø±…ÍÌô‰Íèµ¥¹¹•Èˆøñ‘¥Ø±…ÍÌô‰Íèµ•µ‰±•´ˆøñ¥µœÍÉŒôˆœ­5	15}MI¬œˆ…±Ğôˆˆøğ½‘¥Øøñ‘¥Ø±…ÍÌô‰ÍèµÑ•áĞˆÍÑå±”ô‰½Á…¥ÑäèÀˆøğ½‘¥Øøğ½‘¥Øøğ½‘¥Øøñ‘¥Ø±…ÍÌô‰Íèµ™±…Í ˆøğ½‘¥Øøğ½‰ÕÑÑ½¸øœì(€½¹ÍĞ¥µ…”õ•°¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Íèµ•µ‰±•´¥µœˆ¤í¥µ…”¹½¹•ÉÉ½Èô ¤ôùí¥µ…”¹Á…É•¹Ñ±•µ•¹Ğ¹¥¹¹•É!Q50õÍ¡¥•±‘…±±‰…¬ ¤íôì(€•°¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Íèµ‰±…¬ˆ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±½¹Q…À¤ì(€ÕÁ‘…Ñ•É…½¸ ¸àĞ°¸Üà°¸Ìà°¸ÄÌ¤ì)ô()™Õ¹Ñ¥½¸ÍÑ…ÉÑM•ÅÕ•¹”¡‰ÕÑÑ½¸¥ì(€±•…ÉQ¥µ•ÉÌ ¤íÁ¡…Í”ô‰¡•…ÉÑ‰•…Ñ}¥¹ÑÉ¼ˆíÑ…Á½Õ¹ĞôÀíÑ…É•Ñ	ÕÑÑ½¸õ‰ÕÑÑ½¸íÕÉÉ•¹ÑM…±”ô¸àĞí•¹ÍÕÉ•Õ‘¥¼¡ÑÉÕ”¤íÉ•¹‘•ÉI¥ÑÕ…° ¤ì(€Í¡•‘Õ±”  ¤ôùÕÁ‘…Ñ•É…½¸ ¸àĞÔ°¸àà°¸ĞĞ°¸ÄØ¤°ÄÈÀ¤ì(€lÈàÀ°ÄÀÔÀ°ÄàĞÀ°ÈØÔÀ°ÌĞàÁt¹™½É…  ¡½™™Í•Ğ±¥¹‘•à¤ôùÍ¡•‘Õ±”  ¤ôùì(€€€½¹ÍĞÍÑÉ•¹Ñ ô¸äÔ­¥¹‘•à¨¸ÀàíÕÉÉ•¹ÑM…±”¬ô¸ÀÄÈí¡•…ÉÑ‰•…Ğ¡ÍÑÉ•¹Ñ ¤ì(€€€ÕÁ‘…Ñ•É…½¸¡ÕÉÉ•¹ÑM…±”¬¸ÀÄà©ÍÑÉ•¹Ñ °Ä¬¸ÈĞ©ÍÑÉ•¹Ñ ±5…Ñ ¹µ¥¸ ¸àà°¸Ğà­¥¹‘•à¨¸ÀäÔ¤±5…Ñ ¹µ¥¸ ¸ÜÈ°¸ÈÈ¬¸ÌÀ©ÍÑÉ•¹Ñ ¤¤ì(€€€Í¡•‘Õ±”  ¤ôùÕÁ‘…Ñ•É…½¸¡ÕÉÉ•¹ÑM…±”´¸ÀÀØ°¸ä±5…Ñ ¹µ¥¸ ¸à°¸ĞÈ­¥¹‘•à¨¸ÀàÔ¤°¸Äà­¥¹‘•à¨¸ÀĞÔ¤°ÄÈÀ¤ì(€ô±½™™Í•Ğ¤¤ì(€Í¡•‘Õ±”  ¤ôùÕÁ‘…Ñ•É…½¸¡ÕÉÉ•¹ÑM…±”°¸ØÈ°¸ÜÈ°¸ÄÔ¤°ĞÀÔÀ¤ì(€Í¡•‘Õ±”  ¤ôùíÁ¡…Í”ô‰Ñ•áÑ}É•Ù•…°ˆí½¹ÍĞÑ•áĞõÉ½½Ğ¹ÅÕ•ÉåM•±•Ñ½È ˆ¹ÍèµÑ•áĞˆ¤íÑ•áĞ¹ÍÑå±”¹½Á…¥ÑäôˆÄˆíÑ•áĞ¹¥¹¹•É!Q50ôœñ‘¥Ø±…ÍÌô‰Íèµ±¥¹”Äˆû¢šk¢
#
#?7ğ½‘¥Øøœíô°ĞÔÔÀ¤ì(€Í¡•‘Õ±”  ¤ôùí½¹ÍĞÑ•áĞõÉ½½Ğ¹ÅÕ•ÉåM•±•Ñ½È ˆ¹ÍèµÑ•áĞˆ¤íÑ•áĞ¹¥¹¹•É!Q50¬ôœñ‘¥Ø±…ÍÌô‰Íèµ±¥¹”Èˆû+–&7»–ş¢O£–òW7š>o#¯ñ‰ÈûO»Ò/®ƒ
Kš:#G
#ğ½‘¥Øøœíô°ÔäÔÀ¤ì(€Í¡•‘Õ±”  ¤ôùí½¹ÍĞÑ•áĞõÉ½½Ğ¹ÅÕ•ÉåM•±•Ñ½È ˆ¹ÍèµÑ•áĞˆ¤íÑ•áĞ¹ÍÑå±”¹½Á…¥ÑäôˆÀˆíô°àÄÔÀ¤ì(€Í¡•‘Õ±”  ¤ôùíÁ¡…Í”ô‰Ñ…Á}İ…¥Ğˆí½¹ÍĞÑ•áĞõÉ½½Ğ¹ÅÕ•ÉåM•±•Ñ½È ˆ¹ÍèµÑ•áĞˆ¤íÑ•áĞ¹¥¹¹•É!Q50ôˆˆí•¹ÍÕÉ•Õ‘¥¼¡™…±Í”¤íô°äÀÔÀ¤ì)ô()™Õ¹Ñ¥½¸½¹Q…À ¥ì(€¥˜¡Á¡…Í”„ôô‰Ñ…Á}İ…¥Ğˆ¥É•ÑÕÉ¸ì(€•¹ÍÕÉ•Õ‘¥¼¡ÑÉÕ”¤íÑ…Á½Õ¹Ğ¬¬ì(€¥˜¡Ñ…Á½Õ¹ĞôôôÄ¥í™½½ÑÍÑ•À¡™…±Í”¤íÍ•ÑM¡…­” Ä¤íÕÁ‘…Ñ•É…½¸¡ÕÉÉ•¹ÑM…±”¨Ä¸ÀÀà°Ä¸ÀØ°¸Üà°¸ÈÈ¤íÍ¡•‘Õ±”  ¤ôùÍ•ÑM¡…­” À¤°ĞÔÀ¤íÉ•ÑÕÉ¸íô(€¥˜¡Ñ…Á½Õ¹ĞôôôÈ¥í™½½ÑÍÑ•À¡ÑÉÕ”¤íÍ•ÑM¡…­” È¤íÕÁ‘…Ñ•É…½¸¡ÕÉÉ•¹ÑM…±”¨Ä¸ÀÈÔ°Ä¸ÈÈ°¸àØ°¸ĞÈ¤íÍ¡•‘Õ±”  ¤ôùÍ•ÑM¡…­” À¤°ÔÔÀ¤íÉ•ÑÕÉ¸íô(€¥˜¡Ñ…Á½Õ¹ĞôôôÌ¥É½…ÉQÉ…¹Í¥Ñ¥½¸ ¤ì)ô()™Õ¹Ñ¥½¸É½…ÉQÉ…¹Í¥Ñ¥½¸ ¥ì(€Á¡…Í”ô‰É½…Èˆí‘É…½¹I½…È ¤íÍ•ÑM¡…­” Ì¤íÕÁ‘…Ñ•É…½¸¡ÕÉÉ•¹ÑM…±”¨Ä¸Àà°Ä¸à°Ä°¸äà¤íÍ•Ñ±…Í  ‰É•ˆ¤ì(€Í¡•‘Õ±”  ¤ôùÍ•Ñ±…Í  ‰‘…É­É•ˆ¤°ĞÔÀ¤íÍ¡•‘Õ±”  ¤ôùÍ•Ñ±…Í  ˆˆ¤°ÜÀÀ¤íÍ¡•‘Õ±”  ¤ôùÍ•ÑM¡…­” À¤°äÀÀ¤íÍ¡•‘Õ±”  ¤ôùÍ•Ñ±…Í  ‰İ¡¥Ñ”ˆ¤°äÔÀ¤íÍ¡•‘Õ±”  ¤ôùíÍ•Ñ±…Í  ˆˆ¤í½Á•¹	…‘•9½Éµ…° ¤íô°ÄÈÔÀ¤ì)ô)™Õ¹Ñ¥½¸½Á•¹=É¥¥¹…° ¥í¥˜ …Ñ…É•Ñ	ÕÑÑ½¹ñğ…‘½Õµ•¹Ğ¹½¹Ñ…¥¹Ì¡Ñ…É•Ñ	ÕÑÑ½¸¤¥É•ÑÕÉ¸í‰åÁ…ÍÍ9•áĞõÑÉÕ”íÑ…É•Ñ	ÕÑÑ½¸¹±¥¬ ¤íô)™Õ¹Ñ¥½¸É•¹‘•É	…‘•9½Éµ…° ¥ì(€½¹ÍĞ•°õ•¹ÍÕÉ•I½½Ğ ¤í•°¹ÍÑå±”¹‘¥ÍÁ±…äô‰‰±½¬ˆí•°¹ÍÑå±”¹½Á…¥ÑäôˆÄˆí•°¹ÍÑå±”¹Á½¥¹Ñ•ÉÙ•¹ÑÌô‰…ÕÑ¼ˆì(€½¹ÍĞÍÁ…É­ÌõÉÉ…ä¹™É½´¡í±•¹Ñ èÈÉô°¡|±¤¤ôøœñ¤±…ÍÌô‰ÍèµÍÁ…É¬ˆÍÑå±”ô‰±•™Ğèœ¬ ÄÈ¬¡¤¨ÌÜ¤”Üà¤¬œ”ì´µàèœ¬  ¡¤”Ü¤´Ì¤¨ÄØ¤¬Áàì´µäèœ¬ ´ äÀ¬¡¤¨ÌÄ¤”ÄÜÀ¤¤¬Áàì´µ‘ÕÈèœ¬ ÜÈÀ¬¡¤”Ô¤¨ÄÌÀ¤¬µÌì´µ‘•±…äèœ¬ ÄÈÀ¬¡¤”à¤¨äÔ¤¬µÌˆøğ½¤øœ¤¹©½¥¸ ˆˆ¤ì(€½¹ÍĞÍµ½­”õÉÉ…ä¹™É½´¡í±•¹Ñ èÙô°¡|±¤¤ôøœñ¤±…ÍÌô‰ÍèµÍµ½­”ˆÍÑå±”ô‰±•™Ğèœ¬ à­¤¨ÄØ¤¬œ”ì´µ‘ÕÈèœ¬ ÄàÀÀ­¤¨ÄÌÀ¤¬µÌì´µ‘•±…äèœ¬ ØÔÀ­¤¨ÄÄÀ¤¬µÌˆøğ½¤øœ¤¹©½¥¸ ˆˆ¤ì(€•°¹¥¹¹•É!Q50ôœñ‘¥Ø±…ÍÌô‰Íèµ‰…‘•‰…¬ˆøñ‘¥Ø±…ÍÌô‰Íèµ‰…‘•İÉ…ÀˆøñÍ•Ñ¥½¸±…ÍÌô‰Íèµ…Éˆøñ‘¥ØÍÑå±”ô‰¡•¥¡ĞèÌÙÁàˆøğ½‘¥Øøñ‘¥Ø±…ÍÌô‰Íèµµ•‘…±İÉ…Àˆøñ‘¥Ø±…ÍÌô‰Íèµ¹½Éµ…±µ•‘…°ˆøñ‘¥Ø±…ÍÌô‰Íèµ•¹É…Ù”ˆøñÍÁ…¸ùMÕéÕ­¥A4ğ½ÍÁ…¸øñÍÁ…¸øÅÍĞğ½ÍÁ…¸øñÍÁ…¸ù¡¥‰„°)…Á…¸ğ½ÍÁ…¸øñÍÁ…¸øÈÀÈØ¸Àä¸ÈÈğ½ÍÁ…¸øğ½‘¥Øøğ½‘¥Øøğ½‘¥Øøñ È±…ÍÌô‰ÍèµÑ¥Ñ±”ˆùMÕéÕ­¥A4ğ½ Èøñ‘¥Ø±…ÍÌô‰Íèµ…É•„ˆû–6¢F'r0ğ½‘¥Øøñ‘¥Ø±…ÍÌô‰Íèµ™¥É•‰…¬ˆøğ½‘¥Øøñ‘¥Ø±…ÍÌô‰Íèµ™¥É•™É½¹Ğˆøğ½‘¥Øøœ­ÍÁ…É­Ì­Íµ½­”¬œğ½Í•Ñ¥½¸øğ½‘¥Øøñ‘¥Ø±…ÍÌô‰Íèµ™±…Í ˆøğ½‘¥Øøğ½‘¥Øøœì)ô)™Õ¹Ñ¥½¸½Á•¹	…‘•9½Éµ…° ¥í½Á•¹=É¥¥¹…° ¤íÁ¡…Í”ô‰‰…‘•}¹½Éµ…°ˆíÉ•¹‘•É	…‘•9½Éµ…° ¤íÍ¡•‘Õ±”¡ÍÑ…ÉÑ¥É”°ÈÀÀÀ¤íô)™Õ¹Ñ¥½¸ÍÑ…ÉÑ¥É” ¥ì(€Á¡…Í”ô‰™¥É”ˆí™¥É•	É•…Ñ  ¤í½¹ÍĞ…ÉõÉ½½Ğ¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Íèµ…Éˆ¤í¥˜¡…É¥…É¹±…ÍÍ1¥ÍĞ¹…‘ ‰Íèµ™¥É”ˆ¤ì(€Í¡•‘Õ±”  ¤ôùÍ•Ñ±…Í  ‰É•ˆ¤°ÜÈÀ¤íÍ¡•‘Õ±”  ¤ôùÍ•Ñ±…Í  ‰İ¡¥Ñ”ˆ¤°ÄÄÈÀ¤íÍ¡•‘Õ±”  ¤ôùÍ•Ñ±…Í  ˆˆ¤°ÄÈØÀ¤ì(€Í¡•‘Õ±”  ¤ôùí½¹ÍĞµ•‘…°õÉ½½Ğ¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Íèµ¹½Éµ…±µ•‘…°ˆ¤í¥˜¡µ•‘…°¥µ•‘…°¹ÍÑå±”¹™¥±Ñ•Èô‰‰É¥¡Ñ¹•ÍÌ Ä¸Èà¤Í•Á¥„ ¸Ğà¤Í…ÑÕÉ…Ñ” Ä¸à¤ˆíô°ÄÔÀÀ¤ì(€Í¡•‘Õ±”  ¤ôùí½¹ÍĞµ•‘…°õÉ½½Ğ¹ÅÕ•ÉåM•±•Ñ½È ˆ¹Íèµ¹½Éµ…±µ•‘…°ˆ¤í¥˜¡µ•‘…°¥íµ•‘…°¹ÍÑå±”¹™¥±Ñ•Èô‰‰É¥¡Ñ¹•ÍÌ ¸ä¤Í•Á¥„ ¸ØÔ¤Í…ÑÕÉ…Ñ” Ä¸Ô¤½¹ÑÉ…ÍĞ Ä¸ÄÈ¤ˆíµ•‘…°¹ÍÑå±”¹½Á…¥Ñäôˆ¸äÈˆíõô°ÈÌÀÀ¤ì(€Í¡•‘Õ±”  ¤ôùíÁ¡…Í”ô‰‰ÕÉ¹•ˆíÍ•Ñ±…Í  ‰İ¡¥Ñ”ˆ¤íô°ÈÜÀÀ¤ì(€Í¡•‘Õ±”  ¤ôùíÍ•Ñ±…Í  ˆˆ¤í¥˜¡É½½Ğ¥íÉ½½Ğ¹ÍÑå±”¹ÑÉ…¹Í¥Ñ¥½¸ô‰½Á…¥Ñä€¸àÕÌ•…Í”ˆíÉ½½Ğ¹ÍÑå±”¹½Á…¥ÑäôˆÀˆíÉ½½Ğ¹ÍÑå±”¹Á½¥¹Ñ•ÉÙ•¹ÑÌô‰¹½¹”ˆíõô°ÌÌÀÀ¤ì(€Í¡•‘Õ±”  ¤ôùí¥˜¡É½½Ğ¥íÉ½½Ğ¹ÍÑå±”¹‘¥ÍÁ±…äô‰¹½¹”ˆíÉ½½Ğ¹ÍÑå±”¹½Á…¥ÑäôˆÄˆíÉ½½Ğ¹ÍÑå±”¹ÑÉ…¹Í¥Ñ¥½¸ôˆˆíõÁ¡…Í”ô‰¥‘±”ˆíÑ…Á½Õ¹ĞôÀíÑ…É•Ñ	ÕÑÑ½¸õ¹Õ±°íô°ĞÈÀÀ¤ì)ô()™Õ¹Ñ¥½¸…ÁÑÕÉ”¡•Ù•¹Ğ¥ì(€¥˜¡‰åÁ…ÍÍ9•áĞ¥í‰åÁ…ÍÍ9•áĞõ™…±Í”íÉ•ÑÕÉ¸íô(€¥˜¡Á¡…Í”„ôô‰¥‘±”ˆ¥É•ÑÕÉ¸ì(€½¹ÍĞÑ…É•Ğõ•Ù•¹Ğ¹Ñ…É•Ğí¥˜ „¡Ñ…É•Ğ¥¹ÍÑ…¹•½˜±•µ•¹Ğ¥ññÑ…É•Ğ¹±½Í•ÍĞ ˆÍÕéÕ­¥MÁ•¥…±A…•Ìˆ¤¥É•ÑÕÉ¸ì(€½¹ÍĞ‰ÕÑÑ½¸õÑ…É•Ğ¹±½Í•ÍĞ ‰‰ÕÑÑ½¸ˆ¤í¥˜ „¡‰ÕÑÑ½¸¥¹ÍÑ…¹•½˜!Q51	ÕÑÑ½¹±•µ•¹Ğ¥ñğ…¥ÍMÕéÕ­¥	ÕÑÑ½¸¡‰ÕÑÑ½¸¤¥É•ÑÕÉ¸ì(€•Ù•¹Ğ¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤í•Ù•¹Ğ¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¤í•Ù•¹Ğ¹ÍÑ½Á%µµ•‘¥…Ñ•AÉ½Á……Ñ¥½¸ ¤í•¹ÍÕÉ•Õ‘¥¼¡ÑÉÕ”¤íÍÑ…ÉÑM•ÅÕ•¹”¡‰ÕÑÑ½¸¤ì)ô)™Õ¹Ñ¥½¸İ…­•Õ‘¥¼ ¥í¥˜¡Á¡…Í”„ôô‰¥‘±”ˆ¥•¹ÍÕÉ•Õ‘¥¼¡ÑÉÕ”¤íô)™Õ¹Ñ¥½¸¥¹¥Ğ ¥í‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰±¥¬ˆ±…ÁÑÕÉ”±ÑÉÕ”¤í‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Ñ½Õ¡ÍÑ…ÉĞˆ±İ…­•Õ‘¥¼±í…ÁÑÕÉ”éÑÉÕ”±Á…ÍÍ¥Ù”éÑÉÕ•ô¤í‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•É‘½İ¸ˆ±İ…­•Õ‘¥¼±ÑÉÕ”¤íô)¥˜¡‘½Õµ•¹Ğ¹É•…‘åMÑ…Ñ”ôôô‰±½…‘¥¹œˆ¥‘½Õµ•¹Ğ¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰=5½¹Ñ•¹Ñ1½…‘•ˆ±¥¹¥Ğ±í½¹”éÑÉÕ•ô¤í•±Í”¥¹¥Ğ ¤ì)ô¤ ¤ì(