// Gate at most one Clover DB read per Japan calendar day.
// Published payload contains only prefecture names, total HP and group counts.
import fs from 'node:fs';

const [command, arg1, arg2] = process.argv.slice(2);
const tokyoDate = date => new Intl.DateTimeFormat('en-CA', {
  timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'
}).format(date);
const readJson = name => JSON.parse(fs.readFileSync(name,'utf8'));
const PREFECTURES=new Set([
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
  '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
  '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
  '熊本県','大分県','宮崎県','鹿児島県','沖縄県'
]);

if (command === 'should-query') {
  let prev;
  try { prev=readJson(arg1); } catch { prev=null; }
  const isCurrentDay=prev?.snapshotReady===true && prev?.generatedAt &&
    tokyoDate(new Date(prev.generatedAt))===tokyoDate(new Date());
  process.stdout.write(isCurrentDay?'SKIP':'RUN');
} else if (command === 'apply') {
  if (!arg1 || !arg2) throw new Error('Usage: apply AGGREGATE_RESULT.json DOCS_TARGET.json');
  const raw=fs.readFileSync(arg1,'utf8').trim();
  if (!raw || raw === 'null') {
    throw new Error('Empty SQL result: refusing to publish or silently accept an invalid daily read');
  }
  const data=JSON.parse(raw);
  const items=Object.entries(data.prefectures||{});
  if (data.version!==1 || data.snapshotReady!==true ||
      !Number.isFinite(Date.parse(data.generatedAt)) ||
      items.length<35 || items.length>47 ||
      !items.some(([pref])=>pref==='東京都')) throw new Error('Invalid prefecture aggregate');
  const cleaned=Object.create(null);
  for (const [pref,record] of items) {
    if (!PREFECTURES.has(pref) ||
        !Number.isSafeInteger(record.hp) || record.hp<1 ||
        !Number.isSafeInteger(record.communities) || record.communities<1) {
      throw new Error('Invalid HP record');
    }
    cleaned[pref]={hp:record.hp,communities:record.communities};
  }
  let previous;
  try { previous=readJson(arg2); } catch { previous=null; }
  const canon=d=>JSON.stringify(Object.keys(d.prefectures).sort().map(pref=>
    [pref,d.prefectures[pref].hp,d.prefectures[pref].communities]));
  if (previous && previous.snapshotReady===true && canon(previous)===canon({prefectures:cleaned})) {
    console.log('UNCHANGED: no HP changes, no commit needed');
    process.exit(0);
  }
  const document={
    version:1,
    source:'CA Clover stored community member totals, prefecture aggregate',
    generatedAt:data.generatedAt,
    snapshotReady:true,
    prefectures:cleaned
  };
  fs.writeFileSync(arg2,JSON.stringify(document,null,2)+'\n','utf8');
  console.log('UPDATED: '+items.length+' prefecture HP totals only');
} else {
  throw new Error('Usage: node scripts/refresh-suzuki-hp.mjs should-query FILE | apply INPUT OUTPUT');
}
