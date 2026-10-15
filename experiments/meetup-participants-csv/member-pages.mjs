// Isolated pagination algorithm. fetchPage is injected by the caller.
// No actual HTTP requests, credentials, database access, or caching here.

export async function collectMemberPages({
  eventId,
  fetchPage,
  pageSize = 100,
  maxPages = 200,
}) {
  if (typeof eventId !== "string" || !eventId.trim()) {
    throw new Error("eventId is required");
  }
  if (typeof fetchPage !== "function") throw new Error("fetchPage callback required");
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new Error("Invalid pageSize");
  }
  if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 200) {
    throw new Error("Invalid maxPages");
  }

  const members = [];
  const ids = new Set();
  const cursors = new Set();
  let cursor = null;
  let expected = null;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
    const result = await fetchPage({ eventId, first: pageSize, after: cursor });
    if (!result?.event || result.event.id !== eventId) {
      throw new Error("Event not found or event ID mismatch");
    }
    const connection = result.event.members;
    if (!connection || !Array.isArray(connection.edges)) {
      throw new Error("Member connection is invalid");
    }
    if (!connection.pageInfo || typeof connection.pageInfo.hasNextPage !== "boolean") {
      throw new Error("Member pageInfo is invalid");
    }
    if (!Number.isSafeInteger(connection.totalCount) || connection.totalCount < 0) {
      throw new Error("Member totalCount is invalid");
    }
    if (expected === null) expected = connection.totalCount;
    if (expected !== connection.totalCount) {
      throw new Error("Member count changed during pagination; retry later");
    }

    for (const edge of connection.edges) {
      const member = edge?.node;
      if (!member || typeof member.id !== "string" || !member.id.trim()) {
        throw new Error("Member record lacks ID");
      }
      if (ids.has(member.id)) throw new Error("Duplicate member across pages");
      ids.add(member.id);
      members.push(member);
    }

    if (members.length > expected) throw new Error("Fetched more members than totalCount");
    if (connection.pageInfo.hasNextPage === false) {
      if (members.length !== expected) {
        throw new Error("Member records incomplete; refusing partial export");
      }
      return { members, allPagesComplete: true, pageCount: pageNumber };
    }

    const next = connection.pageInfo.endCursor;
    if (typeof next !== "string" || !next || cursors.has(next)) {
      throw new Error("Missing or repeated pagination cursor");
    }
    cursors.add(next);
    cursor = next;
  }

  throw new Error("Member pagination exceeds maxPages; refusing partial export");
}
