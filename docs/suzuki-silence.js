(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;

// TEMP: SuzukiPM-only hard mute guard.
// This file exists so the joke sequence can be removed cleanly later.
const NAME="suzukipm";
let muteActive=false;
let releaseTimer=null;

function isSuzukiButton(button){
 const raw=button&&button.textContent||"";
 const text=raw.replace(/\s+/g," ").trim();
 if(!text.toLowerCase().includes(NAME))return false;
 if(/・\s*SuzukiPM/i.test(text))return true;
 return (raw.match(/[●○]/g)||[]).length===1&&/[●○]\s*SuzukiPM/i.test(raw);
}

function silenceLegacyHeartbeat(){
 const audio=document.getElementById("suzukiHeartbeatAudio");
 if(!audio)return;
 try{
  audio.muted=true;
  audio.volume=0;
  audio.pause();
  audio.currentTime=0;
 }catch(_){ }
}

function activateMute(){
 muteActive=true;
 if(releaseTimer){clearTimeout(releaseTimer);releaseTimer=null;}
 silenceLegacyHeartbeat();
}

function maybeActivate(event){
 const target=event.target;
 if(!(target instanceof Element))return;
 const button=target.closest("button");
 if(button instanceof HTMLButtonElement&&isSuzukiButton(button))activateMute();
}

document.addEventListener("pointerdown",maybeActivate,true);
document.addEventListener("touchstart",maybeActivate,{capture:true,passive:true});
document.addEventListener("click",maybeActivate,true);

// Block only Suzuki audio media. The dragon-fire MP4 remains visual and keeps playing.
const mediaPlay=HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play=function(){
 const src=String(this.currentSrc||this.src||"").toLowerCase();
 const isSuzukiAudio=this.id==="suzukiHeartbeatAudio"||/suzuki-special\/[^?#]+\.mp3(?:[?#]|$)/i.test(src);
 if(muteActive&&isSuzukiAudio){
  try{this.muted=true;this.volume=0;this.pause();}catch(_){ }
  return Promise.resolve();
 }
 return mediaPlay.apply(this,arguments);
};

// Suzuki's Web Audio sounds (heartbeat oscillator / footsteps / roar / fire)
// eventually connect to AudioDestinationNode. While the Suzuki sequence is active,
// drop only that final connection so absolutely no sound reaches the speaker.
if(window.AudioNode&&window.AudioNode.prototype&&window.AudioNode.prototype.connect){
 const audioConnect=window.AudioNode.prototype.connect;
 window.AudioNode.prototype.connect=function(destination){
  const isDestination=destination&&(
   (window.AudioDestinationNode&&destination instanceof window.AudioDestinationNode)||
   destination.constructor?.name==="AudioDestinationNode"
  );
  if(muteActive&&isDestination)return destination;
  return audioConnect.apply(this,arguments);
 };
}

function specialVisible(){
 const root=document.getElementById("szReal");
 const cleanup=document.getElementById("szCleanStage");
 let rootVisible=false;
 if(root){
  const style=getComputedStyle(root);
  rootVisible=style.display!=="none"&&Number(style.opacity||1)>0.01;
 }
 const cleanupVisible=!!(cleanup&&cleanup.classList.contains("on"));
 return rootVisible||cleanupVisible;
}

function scheduleRelease(){
 if(!muteActive||releaseTimer)return;
 releaseTimer=setTimeout(()=>{
  releaseTimer=null;
  if(specialVisible())return;
  silenceLegacyHeartbeat();
  muteActive=false;
 },1800);
}

const observer=new MutationObserver(()=>{
 if(!muteActive)return;
 silenceLegacyHeartbeat();
 if(!specialVisible())scheduleRelease();
 else if(releaseTimer){clearTimeout(releaseTimer);releaseTimer=null;}
});
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","style"]});

window.CASuzukiSilence={
 version:"hard-mute-20260923-2306",
 get active(){return muteActive;},
 activate:activateMute,
 reset(){
  if(releaseTimer){clearTimeout(releaseTimer);releaseTimer=null;}
  silenceLegacyHeartbeat();
  muteActive=false;
 }
};
})();
