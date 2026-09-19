export interface TokenProvider{
  getToken():Promise<string>;
}

export class CampfireTokenUnavailableError extends Error{
  constructor(
    message="Campfire token is unavailable",
    public readonly reason:"missing"|"read_failed"="missing",
  ){
    super(message);
    this.name="CampfireTokenUnavailableError";
  }
}

export class StaticTokenProvider implements TokenProvider{
  constructor(private readonly token:string){}

  async getToken(){
    const token=this.token.trim();
    if(!token) throw new CampfireTokenUnavailableError();
    return token;
  }
}

type VaultReadResult={
  data:unknown;
  error:unknown;
};

export class VaultTokenProvider implements TokenProvider{
  private cachedToken:string|null=null;

  constructor(private readonly readToken:()=>Promise<VaultReadResult>){}

  async getToken(){
    if(this.cachedToken) return this.cachedToken;

    const {data,error}=await this.readToken();
    if(error){
      const message=error instanceof Error?error.message:String(error);
      throw new CampfireTokenUnavailableError("Campfire tokenをVaultから取得できません: "+message,"read_failed");
    }

    const token=typeof data==="string"?data.trim():"";
    if(!token) throw new CampfireTokenUnavailableError("Campfire tokenが登録されていません");

    this.cachedToken=token;
    return token;
  }

  clearCache(){
    this.cachedToken=null;
  }
}
