// Download boundary: validate the actual roster bytes, not just the server's row-count header.
// Strict to CA Clover full-roster serializer: UTF-8 BOM, CRLF rows, quoted four-column CSV.
export function verifyFullRosterBytes(bytes,expectedCount) {
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<12||bytes.byteLength>8_000_000||
    !Number.isInteger(expectedCount)||expectedCount<1||expectedCount>5000)
    throw Error('ROSTER_INVALID_SIZE');
  if(bytes[0]!==0xef||bytes[1]!==0xbb||bytes[2]!==0xbf)throw Error('ROSTER_BOM_REQUIRED');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  const rows=[];let fields=[],value='',state='start';
  const pushField=()=>{fields.push(value);value='';if(fields.length>4)throw Error('ROSTER_COLUMNS');};
  const pushRow=()=>{if(fields.length!==4)throw Error('ROSTER_COLUMNS');rows.push(fields);fields=[];if(rows.length>5001)throw Error('ROSTER_ROW_LIMIT');};
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(state==='start'){if(c!=='"')throw Error('ROSTER_UNQUOTED');state='quoted';continue;}
    if(state==='quoted'){
      if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else state='after';}
      else value+=c;
      continue;
    }
    if(c===','){pushField();state='start';continue;}
    if(c==='\r'&&text[i+1]==='\n'){
      pushField();pushRow();i++;state='start';continue;
    }
    throw Error('ROSTER_DELIMITER');
  }
  if(state!=='start'||fields.length!==0||value!==''||rows.length!==expectedCount+1)
    throw Error('ROSTER_COUNT_MISMATCH');
  if(rows[0].join('\u001f')!==['username','display_name','rsvp_status','checked_in'].join('\u001f'))
    throw Error('ROSTER_HEADERS');
  const statuses=new Set(['CHECKED_IN','ACCEPTED','DECLINED','MAYBE','INVITED']);
  let checkedInCount=0;
  for(const [username,name,status,checked] of rows.slice(1)){
    if(!username.trim()||!name.trim()||!statuses.has(status)||
      checked!==(status==='CHECKED_IN'?'TRUE':'FALSE'))
      throw Error('ROSTER_RECORD');
    if(checked==='TRUE')checkedInCount++;
  }
  return Object.freeze({count:expectedCount,checkedInCount});
}
