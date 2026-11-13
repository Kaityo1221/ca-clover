import type { CaMasterRecord } from "./ca-master";

export type ExistingCA = {
  source_key: string;
  trainer_name: string;
  ca_level: string | null;
  prefecture: string | null;
  join_date: string | null;
  status: string | null;
};
export type ExistingCommunity = {
  campfire_community_id: string | null;
  name: string;
  prefecture: string | null;
};
export type HistoricalCommunityId = { campfire_community_id: string; status?: string };
export type DiffKind = "new_candidate" | "hold" | "existing_difference" | "inactive_not_registered" | "clover_only";
export type CaMasterDiffRow = {
  kind: DiffKind;
  trainerName: string;
  sourceKey: string;
  communityName: string;
  campfireCommunityId: string | null;
  prefecture: string;
  caLevel: "1st" | "2nd" | null;
  joinDate: string | null;
  reason: string;
};
export type CaMasterDiffReport = {
  sourceCount: number;
  existingCount: number;
  newCandidates: CaMasterDiffRow[];
  holds: CaMasterDiffRow[];
  existingDifferences: CaMasterDiffRow[];
  inactiveUnregistered: CaMasterDiffRow[];
  cloverOnly: CaMasterDiffRow[];
};

const norm = (value: string | null | undefined) =>
  (value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US");
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const inactive = /inactive|retired|suspended|休止|停止|卒業|退任|終了|辞任/i;
const explicitNew = /🆕|\bnew\b|\bactive\b|活動中|新規/i;

function asRow(record: CaMasterRecord, kind: DiffKind, reason: string): CaMasterDiffRow {
  return {
    kind, trainerName: record.trainerName, sourceKey: record.sourceKey,
    communityName: record.communityName, campfireCommunityId: record.communityId,
    prefecture: record.prefecture, caLevel: record.caLevel,
    joinDate: record.joinDate, reason,
  };
}

/** No mutations, approvals, or identity assignments. Never infer retirement from absence. */
export function compareCaMasterNewOnly(
  source: CaMasterRecord[],
  members: ExistingCA[],
  communities: ExistingCommunity[],
  history: HistoricalCommunityId[],
  historyVerified: boolean,
): CaMasterDiffReport {
  const memberByKey = new Map(members.map(member => [norm(member.source_key), member]));
  const memberByName = new Map(members.map(member => [norm(member.trainer_name), member]));
  const idToCommunity = new Map(communities.filter(c => c.campfire_community_id)
    .map(c => [norm(c.campfire_community_id), c]));
  const nameToCommunity = new Map(communities.map(c => [norm(c.name), c]));
  const retiredOrPriorIds = new Set(history.map(c => norm(c.campfire_community_id)));
  const keyCounts = new Map<string,number>();
  const identities = new Map<string,Set<string>>();
  const namesToIds = new Map<string,Set<string>>();
  for (const record of source) {
    const key = norm(record.sourceKey);
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    if (record.communityId) {
      const id = norm(record.communityId);
      const naming = norm(record.communityName) + "|" + norm(record.prefecture);
      const names = identities.get(id) ?? new Set<string>();
      names.add(naming);
      identities.set(id,names);
      const ids = namesToIds.get(naming) ?? new Set<string>();
      ids.add(id);
      namesToIds.set(naming,ids);
    }
  }

  const result:CaMasterDiffReport = {
    sourceCount:source.length, existingCount:members.length,
    newCandidates:[], holds:[], existingDifferences:[],
    inactiveUnregistered:[], cloverOnly:[],
  };
  const presentKeys = new Set<string>();
  for (const record of source) {
    const key = norm(record.sourceKey);
    if (key) presentKeys.add(key);
    const member = memberByKey.get(key) ?? memberByName.get(norm(record.trainerName));
    const isInactive = inactive.test(record.status ?? "");
    if (member) {
      const changes:string[]=[];
      if (norm(member.trainer_name)!==norm(record.trainerName)) changes.push("CA名");
      if (norm(member.prefecture)!==norm(record.prefecture)) changes.push("都道府県");
      if (norm(member.ca_level)!==norm(record.caLevel)) changes.push("CA区分");
      if (norm(member.join_date)!==norm(record.joinDate)) changes.push("就任日");
      if (isInactive && !inactive.test(member.status ?? "")) changes.push("公式Inactive");
      if (changes.length) result.existingDifferences.push(asRow(record,"existing_difference",
        changes.join("・") + "に差異があります。既存情報には触れません。"));
      continue;
    }
    if (isInactive) {
      result.inactiveUnregistered.push(asRow(record,"inactive_not_registered","公式名簿でInactive。自動追加しません。"));
      continue;
    }
    const issues:string[]=[];
    if (!key || (keyCounts.get(key)??0)!==1) issues.push("原本CA名の重複または欠落");
    if (!record.communityId || !uuid.test(record.communityId)) issues.push("Campfire IDがない、または不正");
    if (!record.joinDate) issues.push("就任日が未確認");
    if (!explicitNew.test(record.status ?? "")) issues.push("追加対象であることを原本のStatusから確認できません");
    if (record.caLevel==="2nd") issues.push("2nd CAの所属確認が必要");
    if (record.communityId && uuid.test(record.communityId)) {
      const id=norm(record.communityId);
      const naming=norm(record.communityName)+"|"+norm(record.prefecture);
      if ((identities.get(id)?.size??0)>1) issues.push("1つのCampfire IDに複数の名称・地域");
      if ((namesToIds.get(naming)?.size??0)>1) issues.push("同一名・地域に異なるCampfire ID");
      if (idToCommunity.has(id)) issues.push("Campfire IDは既存コミュニティに登録済み");
      if (retiredOrPriorIds.has(id)) issues.push("過去ID・旧所属との衝突可能性");
    }
    const sameName = nameToCommunity.get(norm(record.communityName));
    if (sameName) issues.push("同名コミュニティが登録済み");
    if (!historyVerified) issues.push("旧Campfire ID履歴を照合できていません");
    if (issues.length) {
      result.holds.push(asRow(record,"hold",issues.join("。") + "。新規追加しません。"));
    } else {
      result.newCandidates.push(asRow(record,"new_candidate",
        "新規CA・新規コミュニティ候補。会長の個別承認と登録直前の再検証が必要。"));
    }
  }
  for (const member of members) {
    if (presentKeys.has(norm(member.source_key)) ||
        source.some(row=>norm(row.trainerName)===norm(member.trainer_name))) continue;
    result.cloverOnly.push({
      kind:"clover_only", trainerName:member.trainer_name,sourceKey:member.source_key,
      communityName:"",campfireCommunityId:null,prefecture:member.prefecture??"",
      caLevel:member.ca_level==="1st"||member.ca_level==="2nd"?member.ca_level:null,
      joinDate:member.join_date??null,reason:"Cloverにだけ存在。削除・退任処理は行いません。",
    });
  }
  return result;
}

export function formatCaMasterDiffReport(report: CaMasterDiffReport, sourceLabel:string, checkedAt:string):string {
  const rows = (items:CaMasterDiffRow[]) => items.length
    ? items.map(x=>`・${x.trainerName} / ${x.communityName||"Community未特定"} / ${x.prefecture}：${x.reason}`).join("\n")
    : "・なし";
  return [
    "🍀 CA Clover CAマスター差分報告（追加専用）",
    `確認日時：${checkedAt}`, `公式データの取得方法：${sourceLabel}`,
    `公式CA行：${report.sourceCount} / Clover CA：${report.existingCount}`,
    `追加候補：${report.newCandidates.length} / 保留：${report.holds.length} / 既存差異：${report.existingDifferences.length} / Inactive：${report.inactiveUnregistered.length} / Cloverのみ：${report.cloverOnly.length}`,
    "", "【新規追加候補（会長の承認待ち）】",rows(report.newCandidates),
    "", "【保留・要確認】",rows(report.holds),
    "", "【既存CAの差異（変更禁止）】",rows(report.existingDifferences),
    "", "【公式Inactive（追加禁止）】",rows(report.inactiveUnregistered),
    "", "【Cloverのみ（削除禁止）】",rows(report.cloverOnly),
    "", "既存CA・所属・権限の変更および自動登録は実施していません。",
  ].join("\n");
}
