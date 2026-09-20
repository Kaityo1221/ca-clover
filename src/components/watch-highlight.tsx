"use client";

type FindingRange={
  matched_field:string|null;
  match_start:number|null;
  match_end:number|null;
  active:boolean;
};

export default function WatchHighlight({
  text,
  field,
  findings,
}:{
  text:string;
  field:"title"|"details";
  findings:FindingRange[];
}){
  const ranges=findings
    .filter(f=>f.active&&f.matched_field===field&&f.match_start!==null&&f.match_end!==null)
    .map(f=>({start:Math.max(0,f.match_start as number),end:Math.min(text.length,f.match_end as number)}))
    .filter(range=>range.end>range.start)
    .sort((a,b)=>a.start-b.start||a.end-b.end);

  const merged:Array<{start:number;end:number}>=[];
  for(const range of ranges){
    const last=merged[merged.length-1];
    if(last&&range.start<=last.end){
      last.end=Math.max(last.end,range.end);
    }else{
      merged.push({...range});
    }
  }

  if(!merged.length) return <>{text}</>;

  const nodes:React.ReactNode[]=[];
  let cursor=0;
  merged.forEach((range,index)=>{
    if(range.start>cursor) nodes.push(<span key={"plain-"+index}>{text.slice(cursor,range.start)}</span>);
    nodes.push(
      <strong key={"hit-"+index} className="font-black text-red-600">
        {text.slice(range.start,range.end)}
      </strong>
    );
    cursor=range.end;
  });
  if(cursor<text.length) nodes.push(<span key="tail">{text.slice(cursor)}</span>);
  return <>{nodes}</>;
}
