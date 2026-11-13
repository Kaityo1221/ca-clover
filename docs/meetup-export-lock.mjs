// Shared by individual CSV and batch CSV. Server audit quotas remain authoritative.
let owner=null,nextAt=0;
const listeners=new Set();
const emit=()=>listeners.forEach(fn=>fn());
export function onExportChange(fn){listeners.add(fn);return ()=>listeners.delete(fn);}
export const exportLocked=()=>owner!==null;
export const nextExportAt=()=>nextAt;
export function acquireExport(token){if(owner!==null)return false;owner=token;emit();return true;}
export function releaseExport(token){if(owner===token){owner=null;emit();}}
export function noteExportAttempt(){nextAt=Math.max(nextAt,Date.now()+15000);emit();}
