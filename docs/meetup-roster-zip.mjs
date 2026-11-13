// Small ZIP STORE writer: preserves the existing CSV bytes without a CDN or third-party upload.
// Files are deliberately not compressed; the 8 MB CSV budget also bounds memory/ZIP size.
const encoder=new TextEncoder();
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function rosterFilename(meetup){
  const date=String(meetup.starts_at||'').slice(0,10).replace(/[^0-9-]/g,'')||'meetup';
  const title=Array.from(String(meetup.title||'Meetup').normalize('NFC').replace(/[\p{Cc}\p{Cf}<>:"/\\|?*]/gu,'_').replace(/^[.\s]+|[.\s]+$/g,'')).slice(0,60).join('')||'Meetup';
  return date+'_'+title+'_'+meetup.id+'.csv';
}
export function createRosterZip(files){
  if(!Array.isArray(files)||files.length<1||files.length>20)throw Error('INVALID_SELECTION');
  const names=new Set();let total=0,offset=0;const local=[],central=[];
  for(const {name,bytes} of files){
    if(typeof name!=='string'||!name.endsWith('.csv')||/[\p{Cc}\p{Cf}/\\]/u.test(name)||name.startsWith('.')||names.has(name)||!(bytes instanceof Uint8Array))throw Error('INVALID_FILE');
    names.add(name);total+=bytes.length;if(total>8000000)throw Error('BYTE_LIMIT');
    const n=encoder.encode(name);if(n.length>65535)throw Error('INVALID_FILE');const crc=crc32(bytes);
    const header=new Uint8Array(30+n.length),h=new DataView(header.buffer);
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,33,true);
    h.setUint32(14,crc,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,n.length,true);header.set(n,30);
    const c=new Uint8Array(46+n.length),v=new DataView(c.buffer);
    v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint16(14,33,true);
    v.setUint32(16,crc,true);v.setUint32(20,bytes.length,true);v.setUint32(24,bytes.length,true);v.setUint16(28,n.length,true);v.setUint32(42,offset,true);c.set(n,46);
    local.push(header,bytes);central.push(c);offset+=header.length+bytes.length;
  }
  const centralSize=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);
  v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
  return new Blob([...local,...central,end],{type:'application/zip'});
}
