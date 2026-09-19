export type CampfireMemberCount={
  totalCount?:number|null;
};

export type CampfireLiveEvent={
  eventName?:string|null;
};

export type CampfireClub={
  id:string;
  name:string;
  address?:string|null;
  location?:string|null;
  createdByCommunityAmbassador?:boolean|null;
  members?:CampfireMemberCount|null;
};

export type CampfireEvent={
  __typename?:string;
  id:string;
  name:string;
  address?:string|null;
  location?:string|null;
  eventTime?:string|null;
  eventEndTime?:string|null;
  createdByCommunityAmbassador?:boolean|null;
  checkedInMembersCount?:number|null;
  members?:CampfireMemberCount|null;
  campfireLiveEvent?:CampfireLiveEvent|null;
};

export type CampfirePublicPlace={
  location?:unknown;
  name?:string|null;
  formattedAddress?:string|null;
};

export type CampfirePublicMapLocation={
  latitude?:number|null;
  longitude?:number|null;
};

export type CampfirePublicEvent={
  id:string;
  name:string;
  clubId?:string|null;
  clubName?:string|null;
  address?:string|null;
  eventTime?:string|null;
  eventEndTime?:string|null;
  place?:CampfirePublicPlace|null;
  mapObjectLocation?:CampfirePublicMapLocation|null;
};

export type CampfirePageInfo={
  hasNextPage?:boolean;
  endCursor?:string|null;
};

export type CampfireConnection<T>={
  totalCount?:number|null;
  edges?:Array<{node?:T|null}>|null;
  pageInfo?:CampfirePageInfo|null;
};

export type PaginationResult<T>={
  items:T[];
  totalCount:number|null;
  complete:boolean;
  pages:number;
  lastCursor:string|null;
};

export type CampfireFeedResult={
  events:CampfireEvent[];
  memberCount:number|null;
  totalCount:number|null;
  complete:boolean;
  pages:number;
  lastCursor:string|null;
};
