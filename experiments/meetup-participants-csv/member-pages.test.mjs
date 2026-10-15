import test from "node:test";
import assert from "node:assert/strict";
import { collectMemberPages } from "./member-pages.mjs";

const response = (edges, totalCount, hasNextPage, endCursor = null) => ({
  event: {
    id: "event-001",
    members: {
      totalCount,
      edges: edges.map((node) => ({ node })),
      pageInfo: { hasNextPage, endCursor }
    }
  }
});

test("paginates completely and uses the cursor", async () => {
  const calls = [];
  const result = await collectMemberPages({
    eventId: "event-001",
    fetchPage: async (params) => {
      calls.push(params);
      return params.after === null
        ? response([{ id: "u1", username: "A" }], 2, true, "next")
        : response([{ id: "u2", username: "B" }], 2, false);
    }
  });
  assert.equal(result.pageCount, 2);
  assert.equal(result.members.length, 2);
  assert.equal(result.allPagesComplete, true);
  assert.equal(calls[1].after, "next");
});

test("refuses incomplete member lists", async () => {
  await assert.rejects(
    () => collectMemberPages({
      eventId: "event-001",
      fetchPage: async () => response([{ id: "u1" }], 2, false),
    }),
    /incomplete/
  );
});

test("detects cursor loops", async () => {
  await assert.rejects(
    () => collectMemberPages({
      eventId: "event-001",
      fetchPage: async () => response([{ id: "u1" }], 2, true, "repeat"),
    }),
    /repeated pagination cursor/
  );
});

test("refuses event ID mismatch", async () => {
  await assert.rejects(
    () => collectMemberPages({
      eventId: "event-001",
      fetchPage: async () => ({ event: { id: "wrong" } }),
    }),
    /mismatch/
  );
});

test("refuses when the total changes between pages", async () => {
  await assert.rejects(
    () => collectMemberPages({
      eventId: "event-001",
      fetchPage: async ({ after }) => after === null
        ? response([{ id: "u1" }], 2, true, "second")
        : response([{ id: "u2" }], 3, false),
    }),
    /count changed/
  );
});

test("caps member page size and page count", async () => {
  await assert.rejects(
    () => collectMemberPages({
      eventId: "event-001",
      pageSize: 1000,
      fetchPage: async () => response([], 0, false),
    }),
    /Invalid pageSize/
  );
});
