export type NormalizedText={
  normalized:string;
  map:Array<{start:number;end:number}>;
};

const discarded=/[\p{White_Space}\p{Punctuation}\p{Symbol}]/u;

export function normalizeWithMap(value:string):NormalizedText{
  let normalized="";
  const map:Array<{start:number;end:number}>=[];

  for(let index=0;index<value.length;){
    const codePoint=value.codePointAt(index);
    if(codePoint===undefined) break;
    const original=String.fromCodePoint(codePoint);
    const start=index;
    const end=index+original.length;
    const folded=original.normalize("NFKC").toLowerCase();

    for(const char of Array.from(folded)){
      if(discarded.test(char)) continue;
      normalized+=char;
      map.push({start,end});
    }
    index=end;
  }

  return {normalized,map};
}

export function normalizeSimple(value:string){
  return normalizeWithMap(value).normalized;
}

export function originalRange(
  normalized:NormalizedText,
  start:number,
  length:number,
){
  if(length<=0) return null;
  const first=normalized.map[start];
  const last=normalized.map[start+length-1];
  if(!first||!last) return null;
  return {start:first.start,end:last.end};
}
