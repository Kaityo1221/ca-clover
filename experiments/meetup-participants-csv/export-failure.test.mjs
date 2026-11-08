import test from "node:test";
import assert from "node:assert/strict";
import { getPublicExportFailure } from "./export-failure.mjs";

test("returns friendly retry guidance on HTTP 429", () => {
  const state = getPublicExportFailure({ status: 429 });
  assert.equal(state.category, "BUSY");
  assert.equal(state.retryable, true);
  assert.match(state.message, /混み合って/);
});

test("does not expose account name, response body, or token in errors", () => {
  const state = getPublicExportFailure({
    message: "private Trainer_X super_secret_token",
    response: { body: "private Trainer_X" },
    status: 500,
  });
  assert.equal(state.category, "UNKNOWN");
  assert.ok(!JSON.stringify(state).includes("Trainer_X"));
  assert.ok(!JSON.stringify(state).includes("super_secret_token"));
});

test("forbidden access is not offered as an automatic retry", () => {
  const state = getPublicExportFailure({ status: 403 });
  assert.equal(state.category, "FORBIDDEN");
  assert.equal(state.retryable, false);
});

test("incomplete lists are marked as failed, not successful", () => {
  const state = getPublicExportFailure({ code: "INCOMPLETE" });
  assert.equal(state.category, "INCOMPLETE");
  assert.match(state.message, /中止/);
});

test("aborted requests have a timeout message", () => {
  const state = getPublicExportFailure({ name: "AbortError" });
  assert.equal(state.category, "TIMEOUT");
});

test("unknown exceptions never leak private fields", () => {
  const state = getPublicExportFailure(new Error("secret"));
  assert.equal(state.category, "UNKNOWN");
  assert.ok(!state.message.includes("secret"));
});
