import {
  ACTIVE_FEED_QUERY,
  ARCHIVED_FEED_QUERY,
  CLUB_QUERY,
  EVENT_QUERY,
} from "./queries.ts";
import type {
  CampfireClub,
  CampfireConnection,
  CampfireEvent,
  CampfireFeedResult,
  PaginationResult,
} from "./types.ts";
import type {TokenProvider} from "./token-provider.ts";

export const CAMPFIRE_GRAPHQL_ENDPOINT="https://niantic-social-api.nianticlabs.com/graphql";

const DEFAULT_PAGE_SIZE=100;
const DEFAULT_MAX_PAGES=100;
const DEFAULT_MAX_RETRIES=3;
const DEFAULT_RETRY_DELAY_MS=600;
const DEFAULT_MIN_REQUEST_INTERVAL_MS=180;

type GraphqlError={message?:string};
type GraphqlResponse<T>={data?:T;errors?:GraphqlError[]};

type FeedResponse={
  club?:{
    id?:string;
    name?:string;
    members?:{totalCount?:number|null}|null;
    activeFeed?:CampfireConnection<CampfireEvent>|null;
    archivedFeed?:CampfireConnection<CampfireEvent>|null;
  }|null;
};

export type CampfireClientOptions={
  tokenProvider:TokenProvider;
  endpoint?:string;
  fetchImpl?:typeof fetch;
  pageSize?:number;
  maxPages?:number;
  maxRetries?:number;
  retryDelayMs?:number;
  minRequestIntervalMs?:number;
};

export class CampfireApiError extends Error{
  constructor(
    message:string,
    public readonly code:string,
    public readonly retryable=false,
    public readonly status?:number,
  ){
    super(message);
    this.name="CampfireApiError";
  }
}

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

export class CampfireClient{
  private readonly endpoint:string;
  private readonly fetchImpl:typeof fetch;
  private readonly pageSize:number;
  private readonly maxPages:number;
  private readonly maxRetries:number;
  private readonly retryDelayMs:number;
  private readonly minRequestIntervalMs:number;
  private rateGate:Promise<void>=Promise.resolve();
  private nextRequestAt=0;

  constructor(private readonly options:CampfireClientOptions){
    this.endpoint=options.endpoint??CAMPFIRE_GRAPHQL_ENDPOINT;
    this.fetchImpl=options.fetchImpl??fetch;
    this.pageSize=Math.max(1,options.pageSize??DEFAULT_PAGE_SIZE);
    this.maxPages=Math.max(1,options.maxPages??DEFAULT_MAX_PAGES);
    this.maxRetries=Math.max(1,options.maxRetries??DEFAULT_MAX_RETRIES);
    this.retryDelayMs=Math.max(0,options.retryDelayMs??DEFAULT_RETRY_DELAY_MS);
    this.minRequestIntervalMs=Math.max(0,options.minRequestIntervalMs??DEFAULT_MIN_REQUEST_INTERVAL_MS);
  }

  async request<T>(query:string,variables:Record<string,unknown>={}):Promise<T>{
    let lastError:unknown;

    for(let attempt=0;attempt<this.maxRetries;attempt++){
      try{
        await this.waitForRateLimit();
        return await this.execute<T>(query,variables);
      }catch(error){
        lastError=error;
        const retryable=error instanceof CampfireApiError && error.retryable;
        if(!retryable || attempt===this.maxRetries-1) throw error;
        await sleep(this.retryDelayMs*(attempt+1));
      }
    }

    throw lastError instanceof Error?lastError:new CampfireApiError("Campfire request failed","UNKNOWN");
  }

  async getClub(clubId:string):Promise<CampfireClub>{
    const data=await this.request<{club?:CampfireClub|null}>(CLUB_QUERY,{clubId});
    if(!data.club) throw new CampfireApiError("Communityを取得できません","CLUB_NOT_FOUND");
    return data.club;
  }

  async getActiveFeed(clubId:string,initialCursor:string|null=null):Promise<CampfireFeedResult>{
    return this.getFeed(clubId,"activeFeed",initialCursor);
  }

  async getArchivedFeed(clubId:string,initialCursor:string|null=null):Promise<CampfireFeedResult>{
    return this.getFeed(clubId,"archivedFeed",initialCursor);
  }

  async getEvent(eventId:string):Promise<CampfireEvent>{
    const data=await this.request<{event?:CampfireEvent|null}>(EVENT_QUERY,{id:eventId});
    if(!data.event) throw new CampfireApiError("Meetupを取得できません","EVENT_NOT_FOUND");
    return data.event;
  }

  async paginate<T>(
    fetchPage:(after:string|null)=>Promise<CampfireConnection<T>>,
    initialCursor:string|null=null,
  ):Promise<PaginationResult<T>>{
    const items:T[]=[];
    const seenCursors=new Set<string>();
    let cursor=initialCursor;
    let totalCount:number|null=null;

    if(cursor) seenCursors.add(cursor);

    for(let page=0;page<this.maxPages;page++){
      const connection=await fetchPage(cursor);
      if(totalCount===null && Number.isFinite(connection.totalCount)) totalCount=Number(connection.totalCount);

      for(const edge of connection.edges??[]){
        if(edge?.node) items.push(edge.node);
      }

      const pageInfo=connection.pageInfo;
      if(!pageInfo?.hasNextPage){
        return {items,totalCount,complete:true,pages:page+1,lastCursor:null};
      }

      const nextCursor=pageInfo.endCursor??null;
      if(!nextCursor) throw new CampfireApiError("pagination cursor missing","PAGINATION_CURSOR");
      if(seenCursors.has(nextCursor)) throw new CampfireApiError("pagination cursor repeated","PAGINATION_LOOP");

      seenCursors.add(nextCursor);
      cursor=nextCursor;
    }

    return {items,totalCount,complete:false,pages:this.maxPages,lastCursor:cursor};
  }

  private async getFeed(
    clubId:string,
    field:"activeFeed"|"archivedFeed",
    initialCursor:string|null,
  ):Promise<CampfireFeedResult>{
    const query=field==="activeFeed"?ACTIVE_FEED_QUERY:ARCHIVED_FEED_QUERY;
    let memberCount:number|null=null;

    const result=await this.paginate<CampfireEvent>(async(after)=>{
      const data=await this.request<FeedResponse>(query,{
        clubId,
        first:this.pageSize,
        after,
      });

      if(!data.club) throw new CampfireApiError("Communityを取得できません","CLUB_NOT_FOUND");
      if(memberCount===null && Number.isFinite(data.club.members?.totalCount)){
        memberCount=Number(data.club.members?.totalCount);
      }

      return (field==="activeFeed"?data.club.activeFeed:data.club.archivedFeed)??{};
    },initialCursor);

    const events=result.items.filter(event=>event?.__typename==="Event" && Boolean(event.id) && Boolean(event.name));
    return {
      events,
      memberCount,
      totalCount:result.totalCount,
      complete:result.complete,
      pages:result.pages,
      lastCursor:result.lastCursor,
    };
  }

  private async execute<T>(query:string,variables:Record<string,unknown>):Promise<T>{
    const token=await this.options.tokenProvider.getToken();
    let response:Response;

    try{
      response=await this.fetchImpl(this.endpoint,{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Accept":"application/json",
          "Authorization":"Bearer "+token,
        },
        body:JSON.stringify({query,variables}),
      });
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      throw new CampfireApiError("Campfire network error: "+message,"NETWORK",true);
    }

    if([429,502,503,504].includes(response.status)){
      throw new CampfireApiError("Campfire HTTP "+response.status,"HTTP_"+response.status,true,response.status);
    }
    if(!response.ok){
      throw new CampfireApiError("Campfire HTTP "+response.status,"HTTP_"+response.status,false,response.status);
    }

    let payload:GraphqlResponse<T>;
    try{
      payload=await response.json() as GraphqlResponse<T>;
    }catch{
      throw new CampfireApiError("Campfire response is not valid JSON","INVALID_RESPONSE");
    }

    if(payload.errors?.length){
      const message=payload.errors.map(error=>error.message||"GraphQL error").join(" / ");
      const retryable=/DeadlineExceeded/i.test(message);
      throw new CampfireApiError(message,retryable?"GRAPHQL_DEADLINE":"GRAPHQL",retryable);
    }
    if(payload.data===undefined){
      throw new CampfireApiError("Campfire response has no data","INVALID_RESPONSE");
    }

    return payload.data;
  }

  private async waitForRateLimit(){
    let release:()=>void=()=>{};
    const previous=this.rateGate;
    this.rateGate=new Promise<void>(resolve=>{release=resolve;});

    await previous;
    try{
      const wait=Math.max(0,this.nextRequestAt-Date.now());
      if(wait>0) await sleep(wait);
      this.nextRequestAt=Date.now()+this.minRequestIntervalMs;
    }finally{
      release();
    }
  }
}
