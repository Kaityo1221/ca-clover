import {parseAuthorizedMeetupDelta} from "./meetup-delta-api-contract";

export type AuthorizedDeltaTotals = {
  added: number;
  updated: number;
  unchanged: number;
  checkedCommunities: number;
};
type ApiResult = {data: unknown; error?: unknown; status?: number};
export type InvokeReadOnlyDelta = (communityId: string) => Promise<ApiResult>;
export class MeetupDeltaRequestError extends Error {
  constructor(public readonly category: "unauthorized"|"unavailable"|"invalid-response") {
    super("MEETUP_DELTA_" + category.toUpperCase().replace("-", "_"));
  }
}

// The supplied community IDs are UI hints, NOT proof of CA membership.
// Every call must still pass server-side JWT + formally verified CA approval.
export async function requestAuthorizedMeetupDeltas(
  requestedIds: readonly string[],
  invoke: InvokeReadOnlyDelta,
): Promise<AuthorizedDeltaTotals> {
  if (!Array.isArray(requestedIds) || requestedIds.length === 0 ||
      requestedIds.length > 50 || typeof invoke !== "function") {
    throw new MeetupDeltaRequestError("invalid-response");
  }
  const ids = [...requestedIds];
  if (new Set(ids).size !== ids.length ||
      ids.some(id=>typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(id))) {
    throw new MeetupDeltaRequestError("invalid-response");
  }
  const totals: AuthorizedDeltaTotals = {added:0, updated:0, unchanged:0, checkedCommunities:0};
  for (const communityId of ids) {
    let result: ApiResult;
    try { result = await invoke(communityId); }
    catch { throw new MeetupDeltaRequestError("unavailable"); }
    if (result?.error) {
      const context=(result.error as {context?:{status?:number}})?.context;
      const status=context?.status ?? result.status;
      if (status === 401 || status === 403) throw new MeetupDeltaRequestError("unauthorized");
      throw new MeetupDeltaRequestError("unavailable");
    }
    let parsed;
    try {parsed = parseAuthorizedMeetupDelta(result?.data,communityId);}
    catch {throw new MeetupDeltaRequestError("invalid-response");}
    totals.added += parsed.added;
    totals.updated += parsed.updated;
    totals.unchanged += parsed.unchanged;
    totals.checkedCommunities++;
    if (![totals.added,totals.updated,totals.unchanged].every(Number.isSafeInteger)) {
      throw new MeetupDeltaRequestError("invalid-response");
    }
  }
  // Return only after every community has completed. Never show partial counts.
  return totals;
}
