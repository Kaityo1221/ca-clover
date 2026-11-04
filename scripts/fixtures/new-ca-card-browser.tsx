import { createRoot } from "react-dom/client";
import NewCaApprovalDeck from '../../src/components/new-ca-approval-deck';
const applications=[1,2,3].map(n=>({id:'synthetic-'+n,trainerName:'SyntheticCA'+n,discordDisplayName:'長い表示名でもカードが崩れないための合成テスト '+n,discordUsername:'synthetic'+n,discordNickname:null,discordUserId:'123456789012345678',displayNameSource:'discord_oauth' as const,campfireUrl:'https://campfire.scopely.com/discover/club/00000000-0000-4000-8000-000000000001',status:'pending_admin' as const,caLevel:n===2?'2nd':'1st',masterResult:'合成データ照合済み',communityName:'Synthetic Community',createdAt:'2026-11-04T09:00:00Z',approvalHistory:[{event:'synthetic-created',at:'2026-11-04T09:00:00Z'}]}));
export default function QA(){return <main style={{padding:16}}><NewCaApprovalDeck applications={applications} onRevalidate={async()=> '合成再検証が完了しました。'} onPreviewDecision={async (_application,action,reason)=> action === 'approve' ? '練習：承認、保存なし' : '練習：'+action+':'+reason}/></main>;}

createRoot(document.getElementById("root")!).render(<QA/>);
