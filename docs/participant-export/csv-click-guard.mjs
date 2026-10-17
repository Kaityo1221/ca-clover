// CA Clover participant CSV: client-side duplicate-click guard, isolated candidate.
// A browser instance can issue only one export request at a time.
// This is UX defense in depth; server DB D permission, rate limits and audit
// MUST remain authoritative (including multiple tabs and devices).
// Do not cache CSV data, names, tokens, or a fulfilled Response in this guard.
import { ENGINE_POLICY } from './engine-policy.mjs';
export function createCsvClickGuard({
  cooldownMs = ENGINE_POLICY.clientCooldownMs,
  clock = () => Date.now(),
  onStateChange = () => {},
} = {}) {
  if (!Number.isInteger(cooldownMs) || cooldownMs < ENGINE_POLICY.clientCooldownMs || cooldownMs > 60_000 ||
      typeof clock !== 'function' || typeof onStateChange !== 'function') {
    throw new TypeError('invalid guard configuration');
  }

  let pending = false;
  let nextAllowedAt = 0;

  function getState() {
    const now = clock();
    if (!Number.isFinite(now) || now < 0) throw new TypeError('invalid clock');
    return Object.freeze({
      pending,
      canStart: !pending && now >= nextAllowedAt,
      retryAfterMs: Math.max(0, Math.ceil(nextAllowedAt - now)),
    });
  }

  function notify() {
    try { onStateChange(getState()); } catch {
      // UI notification problems must not turn one completed request into a
      // duplicated export or leak CSV contents.
    }
  }

  async function run(exportRequest) {
    if (typeof exportRequest !== 'function') throw new TypeError('request callback required');
    const state = getState();
    if (state.pending) return Object.freeze({ kind: 'blocked', reason: 'IN_PROGRESS' });
    if (!state.canStart) return Object.freeze({
      kind: 'blocked', reason: 'COOLDOWN', retryAfterMs: state.retryAfterMs,
    });

    pending = true;
    nextAllowedAt = clock() + cooldownMs; // DB window starts with the attempt, not completion.
    notify();
    try {
      // Returning the Response directly avoids storing or copying roster bytes.
      const value = await exportRequest();
      if(value?.status===429){
        const seconds=Number(value.headers?.get?.('retry-after'));
        if(Number.isFinite(seconds)&&seconds>0)nextAllowedAt=Math.max(nextAllowedAt,clock()+Math.min(3600,seconds)*1000);
      }
      return { kind: 'executed', value };
    } finally {
      pending = false;
      notify();
    }
  }

  return Object.freeze({ getState, run });
}

