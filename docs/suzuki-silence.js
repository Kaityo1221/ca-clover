(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;

// TEMP: SuzukiPM-only hard mute guard.
// Keep the audio graph untouched on iOS Safari. We silence only playback starts.
const NAME="suzukipm";
let muteActive=false;
let releaseTimer=null;

function isSuzukiButton(button){
 const raw=button&&button.textContent||"";
 const text=raw.replace(/\s+/g," ").trim().toLowerCase();
 if(!text.includes(NAME))return false;
 // The stamp card itself is the primary trigger. Keep the old patterns as fallback.
 if(button.matches&&button.matches("button.stamp[data-community]"))return true;
 if(/・\s*SuzukiPM/i.test(raw))return true;
 return /[●○]\s*SuzukiPM/i.test(raw);
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

// Block only Suzuki audio media. Dragon-fire MP4 is muted video and remains visual.
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

// Safer iOS strategy: do NOT replace AudioNode.connect().
// Suzuki WebAudio uses OscillatorNode (heartbeat) and AudioBufferSourceNode
// (footsteps, roar, fire). Prevent only their start while Suzuki is active.
if(window.OscillatorNode&&window.OscillatorNode.prototype){
 const oscillatorStart=window.OscillatorNode.prototype.start;
 window.OscillatorNode.prototype.start=function(){
  if(muteActive){try{this.stop()}catch(_){};return;}
  return oscillatorStart.apply(this,arguments);
 };
}
if(window.AudioBufferSourceNode&&window.AudioBufferSourceNode.prototype){
 const bufferStart=window.AudioBufferSourceNode.prototype.start;
 window.AudioBufferSourceNode.prototype.start=function(){
  if(muteActive){try{this.stop()}catch(_){};return;}
  return bufferStart.apply(this,arguments);
 };
}

function specialVisible(){
 const root=document.getElementById("szReal");
 let rootVisible=false;
 if(root){
  const style=getComputedStyle(root);
  rootVisible=style.display!=="none"&&Number(style.opacity||1)>0.01;
 }
 return rootVisible;
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
 version:"hard-mute-ios-safe-20260923-2343",
 get active(){return muteActive;},
 activate:activateMute,
 reset(){
  if(releaseTimer){clearTimeout(releaseTimer);releaseTimer=null;}
  silenceLegacyHeartbeat();
  muteActive=false;
 }
};
})();