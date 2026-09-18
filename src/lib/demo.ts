export type Coverage = "complete" | "partial" | "missing";

export type Community = {
  id:string;
  name:string;
  prefecture:string;
  cas:string[];
  members:number|null;
  last:string|null;
  d30:number;
  d90:number;
  rsvp:number;
  checkin:number;
  coverage:Coverage;
};

export const communities: Community[] = [
  {id:"pgc-tokyo",name:"Pokémon GO Club Tokyo",prefecture:"東京都",cas:["SyoGo","2nd CA"],members:20143,last:"2026-09-17",d30:4,d90:11,rsvp:420,checkin:336,coverage:"partial"},
  {id:"sendai",name:"Pokémon GO Community Sendai",prefecture:"宮城県",cas:["toyoxx"],members:null,last:"2026-09-13",d30:3,d90:8,rsvp:281,checkin:224,coverage:"complete"},
  {id:"nara",name:"Pokémon GO 奈良 まほろば",prefecture:"奈良県",cas:["Nest21watti","FukuDi000levi"],members:null,last:"2026-08-30",d30:1,d90:5,rsvp:96,checkin:73,coverage:"partial"},
  {id:"tokushima",name:"Pokémon GO in 石井ドーム",prefecture:"徳島県",cas:["RYO24s","banbe53"],members:null,last:null,d30:0,d90:0,rsvp:0,checkin:0,coverage:"missing"}
];

export const meetups = [
  {date:"2026-09-17",title:"Super Mega Raid",place:"東京都",rsvp:126,checkin:98,ca:true},
  {date:"2026-09-12",title:"Community Day",place:"東京都",rsvp:188,checkin:151,ca:true},
  {date:"2026-09-05",title:"Weekend Meetup",place:"葛西臨海公園",rsvp:74,checkin:58,ca:true},
  {date:"2026-08-29",title:"Raid Hour",place:"上野公園",rsvp:52,checkin:39,ca:false}
];
