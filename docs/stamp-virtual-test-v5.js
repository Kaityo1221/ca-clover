// Retired production guard: virtual Stamp Rally test mode is disabled.
(function(){
"use strict";
try{
 const prefix="ca-clover-virtual-stamps-v1:";
 const keys=[];
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i)||"";
  if(key.startsWith(prefix))keys.push(key);
 }
 keys.forEach(key=>localStorage.removeItem(key));
}catch(_){}
})();
