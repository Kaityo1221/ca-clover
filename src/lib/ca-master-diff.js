/**
 * CA master source comparison, READ ONLY.
 * This never authorizes CA users or modifies any master/community records.
 * Preserve original roster statuses and avoid inferring deletions.
 */
export const SOURCE_SHEET = Object.freeze({
  spreadsheetId:"1BtPjOxNX4JhttKKJa_-qrIXdVmK5UsbAX-RcLmLTuwk",
  gid:"633821294",
  title:"[APAC] CA in Japan",
  tab:"[new]CA List 20260828",
  backupId:"1r2EoVF6AXFITFgmLCeV5dB_xDxEjN9n4zJ8Yp0hnBpw",
});
export const normalizeKey = value => String(value ?? "").normalize("NFKC").trim().toLowerCase();
export function parseCsv(csv) {
  if (typeof csv !== "string" || csv.length > 8_000_000) throw Error("SOURCE_OVERSIZE");
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<csv.length;i++){
    const c=csv[i];
    if(quoted){
      if(c==='"' && csv[i+1]==='"'){cell+='"';i++;}
      else if(c==='"')quoted=false;
      else cell+=c;
    }else if(c==='"'){if(cell.trim())throw Error("SOURCE_CSV_INVALID");quoted=true;}
    else if(c===","){row.push(cell);cell="";}
    else if(c==="\n"){row.push(cell);rows.push(row);row=[];cell="";}
    else if(c!=="\r")cell+=c;
  }
  if(quoted)throw Error("SOURCE_CSV_UNCLOSED_QUOTE");
  if(cell.length||row.length){row.push(cell);rows.push(row);}
  return rows.filter(r=>r.some(c=>String(c).trim()));
}
const required = ["status","pgo trainer name","2nd ca","discord name","campfire group name","campfire url","primary city","ca join date"];
export function parseMasterRows(rows) {
  if(!Array.isArray(rows)||rows.length<100||rows.length>500)throw Error("SOURCE_ROW_COUNT_INVALID");
  const names=rows[0].map(x=>normalizeKey(x));
  const positions=Object.fromEntries(required.map(name=>[name,names.indexOf(name)]));
  if(Object.values(positions).some(x=>x<0)||new Set(Object.values(positions)).size!==required.length)
    throw Error("SOURCE_SCHEMA_CHANGED");
  const result=[],seen=new Set(),issues=[];
  for(let n=1;n<rows.length;n++){
    const line=rows[n];const name=String(line[positions["pgo trainer name"]]||"").trim();
    if(!name)continue;
    const key=normalizeKey(name);
    if(!/^[\p{L}\p{N}_.-]{2,80}$/u.test(name)){issues.push("INVALID_NAME_ROW");continue;}
    if(seen.has(key)){issues.push("DUPLICATE_NAME");continue;}seen.add(key);
    const flag=String(line[positions["status"]]||"").trim();
    const inactive=/inactive|retired|suspended|休止|停止|卒業|退任|終了/i.test(flag);
    const second=String(line[positions["2nd ca"]]||"").trim();
    const level=second ? "2nd":"1st";
    const community=String(line[positions["campfire group name"]]||"").trim();
    const campfireUrl=String(line[positions["campfire url"]]||"").trim();
    const city=String(line[positions["primary city"]]||"").trim();
    if(!community||!city||!/^https:\/\/(?:campfire\.onelink\.me|campfire\.scopely\.com)\//i.test(campfireUrl))
      issues.push("INCOMPLETE_ROW");
    result.push({key,name,level,status:inactive?"inactive":"active",statusRaw:flag,community,city,discordName:String(line[positions["discord name"]]||"").trim(),joinDate:String(line[positions["ca join date"]]||"").trim()});
  }
  if(result.length<100)throw Error("SOURCE_TOO_FEW_CA_ROWS");
  // Important: suspicious source files never become eligible for ANY writes.
  return {rows:result,issues:[...new Set(issues)]};
}
export function compareMaster(source, database){
  if(!Array.isArray(database))throw Error("MASTER_READ_FAILED");
  const byKey=new Map(),dbDuplicates=[];
  for(const row of database){
    const k=normalizeKey(row.source_key);
    if(!k||byKey.has(k)){dbDuplicates.push(k);continue;}byKey.set(k,row);
  }
  const sourceKeys=new Set(source.rows.map(row=>row.key));
  const added=[],changed=[],absent=[];
  for(const row of source.rows){
    const existing=byKey.get(row.key);
    if(!existing){added.push(row);continue;}
    const fields=[];
    if(normalizeKey(existing.trainer_name)!==row.key)fields.push("trainer_name");
    if(String(existing.ca_level)!==row.level)fields.push("ca_level");
    if(String(existing.status)!==row.status)fields.push("status");
    if(fields.length)changed.push({name:row.name,key:row.key,fields,previous:{trainerName:existing.trainer_name,level:existing.ca_level,status:existing.status},current:{level:row.level,status:row.status,statusRaw:row.statusRaw}});
  }
  for(const row of database){
    if(!sourceKeys.has(normalizeKey(row.source_key)))absent.push({name:row.trainer_name,key:row.source_key});
  }
  return {registered:database.length,active:database.filter(r=>r.status==="active").length,sourceCount:source.rows.length,
    added,changed,absent,issues:[...source.issues,...(dbDuplicates.length?["DUPLICATE_DB_KEY"]:[])],
    // Explicitly disable automatic master insertions until a tested trusted writer exists.
    writeAllowed:false};
}
