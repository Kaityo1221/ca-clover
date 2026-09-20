type FindingLike={
  flag_code:string;
  matched_text?:string|null;
};

function firstMatched(findings:FindingLike[],flags:string[]){
  return findings.find(item=>flags.includes(item.flag_code)&&item.matched_text)?.matched_text??null;
}

export function buildMeetupWatchContactTemplate(
  flags:string[],
  findings:FindingLike[],
){
  const questions:string[]=[];
  const add=(value:string)=>{
    if(value&&!questions.includes(value)) questions.push(value);
  };

  if(flags.includes("REPEAT_SAME_DAY")||flags.includes("REPEAT_CLOSE")){
    add("同日または近い時間帯に複数のMeetupが設定されています。それぞれを分けて開催した経緯を教えてください。");
  }

  if(flags.some(flag=>["TITLE_STRONG","TITLE_CAUTION","PARTICIPATION_RESTRICTED"].includes(flag))){
    const matched=firstMatched(findings,["TITLE_STRONG","TITLE_CAUTION","PARTICIPATION_RESTRICTED"]);
    add("Meetupのタイトル・概要に"+(matched?"「"+matched+"」という表現があります。":"確認したい表現があります。")+"どのような開催を想定して設定したものか教えてください。");
  }

  if(flags.includes("HOST_ABSENT_TEXT")){
    const matched=firstMatched(findings,["HOST_ABSENT_TEXT"]);
    add("概要に"+(matched?"「"+matched+"」と記載されています。":"主催者不在を示す表現があります。")+"当日の主催・参加者対応について教えてください。");
  }

  if(flags.some(flag=>["NON_FACE_TO_FACE","FREE_CHECKIN_TEXT","CHECKIN_ONLY"].includes(flag))){
    const matched=firstMatched(findings,["NON_FACE_TO_FACE","FREE_CHECKIN_TEXT","CHECKIN_ONLY"]);
    add("概要に"+(matched?"「"+matched+"」という記載があります。":"来場・チェックイン方法について確認したい記載があります。")+"当日の参加方法や現地対応をどのように想定していたか教えてください。");
  }

  if(flags.includes("OFFICIAL_TIME_OUTSIDE")){
    add("公式イベント終了後の時間帯にMeetupが設定されています。この時間に開催した経緯を教えてください。");
  }

  if(flags.includes("CREATED_LAST_MINUTE")){
    add("開始直前にMeetupが作成されています。現地でどのような状況があり、この時間に設定したか教えてください。");
  }

  if(flags.includes("REWARD_ONLY")){
    const matched=firstMatched(findings,["REWARD_ONLY"]);
    add((matched?"「"+matched+"」という表現があります。":"報酬に関する表現があります。")+"当日のMeetupで予定していた活動内容を教えてください。");
  }

  if(flags.includes("LOW_CHECKIN_REPEAT")){
    add("少人数のCheck-inが続いています。最近の開催状況や現地での参加状況について教えてください。");
  }

  const selected=questions.slice(0,2);
  return [
    "お疲れ様です。Meetupの運用確認のため、状況を確認させてください。",
    "",
    ...selected.map((question,index)=>(index+1)+". "+question),
    "",
    "確認できる範囲で大丈夫です。状況や設定した経緯を教えてください。",
  ].join("\n");
}
