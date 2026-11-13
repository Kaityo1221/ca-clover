export const MEETUP_CATEGORIES = Object.freeze([
  ["all","すべて"],["community-day","コミュニティデイ"],["raid-day","レイドデイ"],
  ["max-battle","マックスバトル"],["spotlight","スポライ"],["raid-hour","レイドアワー"],["other","その他"]
]);
export function classifyMeetup(meetup) {
  // The official Campfire event name is authoritative when it describes a recognizable event.
  // Generic event names (e.g. "Mega Raid") do not imply a Raid Day.
  // A confirmed reward-less Meetup uses the CA's own title. A reward-eligible
  // Meetup uses its linked Campfire event name, falling back to title if absent.
  // For legacy unknown eligibility, keep the existing official-first behavior.
  const names=meetup?.is_passcode_reward_eligible===false
    ? [meetup?.title]
    : [meetup?.campfire_live_event_name,meetup?.title];
  for(const value of names){
    const name=String(value||"").normalize("NFKC").trim();
    if(!name)continue;
    if(/community\s*day|コミュニティ[・ー\s]*(?:デイ|デー)|コミュデイ/i.test(name))return "community-day";
    if(/(?:raid\s*(?:day|weekend)|(?:mega|shadow|super\s*mega)\s*raid\s*day)|レイド[・ー\s]*デ[イー]|(?:シャドウ|メガ)レイドデイ/i.test(name))return "raid-day";
    if(/(?:max\s*(?:battle|monday|weekend)|gigantamax|dynamax|gmax|キョダイマックス|ダイマックス|マックス[・ー\s]*(?:バトル|マンデー)|マックスレイド)/i.test(name))return "max-battle";
    if(/spotlight\s*hour|スポットライト[・ー\s]*アワー|スポライ/i.test(name))return "spotlight";
    if(/raid\s*hour|レイド[・ー\s]*アワー/i.test(name))return "raid-hour";
  }
  return "other";
}
export function filterMeetupsByCategory(meetups,category) {
  if(!MEETUP_CATEGORIES.some(([key])=>key===category))throw new TypeError("unknown category");
  return meetups.filter(m=>category==="all"||classifyMeetup(m)===category);
}
