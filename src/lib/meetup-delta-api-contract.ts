// Presentation-only contract for the future server-authorized Meetup delta API.
// Parsing is NOT authentication. The server must verify the current JWT and
// enforce formal CA/community permissions before returning this object.
export type AuthorizedMeetupDelta = {
  communityId: string;
  added: number;
  updated: number;
  unchanged: number;
};

export function parseAuthorizedMeetupDelta(
  payload: unknown,
  requestedCommunityId: string,
): AuthorizedMeetupDelta {
  if (
    !payload ||
    typeof payload !== "object" ||
    !requestedCommunityId
  ) throw new Error("INVALID_MEETUP_DELTA_RESPONSE");
  const data = payload as Record<string, unknown>;
  if (data.ok !== true || data.communityId !== requestedCommunityId) {
    throw new Error("UNAUTHORIZED_MEETUP_DELTA_SCOPE");
  }
  for (const count of [data.added, data.updated, data.unchanged]) {
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
      throw new Error("INVALID_MEETUP_DELTA_COUNTS");
    }
  }
  return {
    communityId: requestedCommunityId,
    added: data.added as number,
    updated: data.updated as number,
    unchanged: data.unchanged as number,
  };
}
