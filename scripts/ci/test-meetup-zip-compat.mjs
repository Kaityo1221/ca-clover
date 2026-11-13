// Synthetic compatibility fixture: does not access Campfire, credentials or production DB.
import {writeFile,mkdir} from 'node:fs/promises';
import {createRosterZip,rosterFilename} from '../../docs/meetup-roster-zip.mjs';
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const csv='\uFEFF"username","display_name","rsvp_status"\r\n"abc","東京・合成参加者🍀","CHECKED_IN"\r\n';
const content=new TextEncoder().encode(csv),files=[];
for(let i=1;i<=20;i++){
 const meetup={id:id(i),title:'コミュニティデイ・日本語🌸 '+i,starts_at:'2026-11-14T09:00:00Z'};
 files.push({name:rosterFilename(meetup),bytes:content});
}
const zip=createRosterZip(files);
await mkdir('qa-artifacts/meetup-mobile',{recursive:true});
const output='qa-artifacts/meetup-mobile/zip-compat-20.csv.zip';
await writeFile(output,new Uint8Array(await zip.arrayBuffer()));
console.log('SYNTHETIC_ZIP_FILE='+output+' FILES='+files.length+' CSV_BYTES='+content.length*files.length+' ZIP_BYTES='+zip.size);
