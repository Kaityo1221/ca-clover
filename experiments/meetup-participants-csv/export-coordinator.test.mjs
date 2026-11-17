import test from 'node:test';
import assert from 'node:assert/strict';
import { exportParticipantCsv } from './export-coordinator.mjs';

const eventId = 'sample_001';
const snapshot = { event: { id: eventId, eventTime: '2026-10-15T14:00:00+09:00' },
  allStatusesComplete: true, rsvpStatuses: [
    { userId: 'u1', rsvpStatus: 'ACCEPTED' },
    { userId: 'u2', rsvpStatus: 'CHECKED_IN' }
  ] };
const page = { event: { id: eventId, members: {
  totalCount: 2,
  edges: [{ node: { id: 'u1', username: 'Trainer_A' } }, { node: { id: 'u2', username: 'Trainer_B' } }],
  pageInfo: { hasNextPage: false, endCursor: null },
} } };
function makeGate(capacity = 3) {
  let active = 0;
  let peak = 0;
  const users = new Set();
  return {
    get active() { return active; },
    get peak() { return peak; },
    async tryAcquire({ actorId }) {
      if (active >= capacity || users.has(actorId)) return null;
      active++;
      peak = Math.max(peak, active);
      users.add(actorId);
      let released = false;
      return { release: async () => {
        if (released) throw Error('double release');
        released = true;
        active--;
        users.delete(actorId);
      } };
    }
  };
}
function setup(overrides = {}) {
  const gate = makeGate();
  return { gate, options: {
    eventId,
    actorId: 'actor_A',
    authorize: async () => true,
    tryAcquire: gate.tryAcquire.bind(gate),
    fetchEventSnapshot: async () => snapshot,
    fetchMemberPage: async () => page,
    ...overrides
  } };
}
test('authorized one-event request exports no permanent cache', async () => {
  const { gate, options } = setup();
  const result = await exportParticipantCsv(options);
  assert.equal(result.summary.participating, 2);
  assert.equal(result.summary.checkedIn, 1);
  assert.match(result.csv, /Trainer_A/);
  assert.equal(gate.active, 0);
});
test('no private participant lookup occurs when authorization fails', async () => {
  let calls = 0;
  const { gate, options } = setup({ authorize: async () => false,
    fetchEventSnapshot: async () => { calls++; return snapshot; },
    fetchMemberPage: async () => { calls++; return page; } });
  await assert.rejects(() => exportParticipantCsv(options), /FORBIDDEN/);
  assert.equal(calls, 0);
  assert.equal(gate.active, 0);
});
test('a full gate returns BUSY without any API call', async () => {
  let calls = 0;
  const { options } = setup({ tryAcquire: async () => null,
    fetchEventSnapshot: async () => { calls++; return snapshot; } });
  await assert.rejects(() => exportParticipantCsv(options), /BUSY/);
  assert.equal(calls, 0);
});
test('status evidence must prove completeness, even if the member page is complete', async () => {
  const { options, gate } = setup({ fetchEventSnapshot: async () => ({ ...snapshot, allStatusesComplete: false }) });
  await assert.rejects(() => exportParticipantCsv(options), /INCOMPLETE/);
  assert.equal(gate.active, 0);
});
test('releases slots and hides raw API error content on failure', async () => {
  const { options, gate } = setup({ fetchEventSnapshot: async () => { throw Error('PRIVATE_TRAINER_NAME secret'); } });
  await assert.rejects(async () => {
    try { await exportParticipantCsv(options); } catch (e) {
      assert.ok(!e.message.includes('PRIVATE_TRAINER_NAME'));
      throw e;
    }
  }, /INCOMPLETE/);
  assert.equal(gate.active, 0);
});
test('300 simultaneous fake demands never exceed 3 in local test gate', async () => {
  const gate = makeGate(3);
  let calls = 0;
  const requests = Array.from({ length: 300 }, (_, i) => exportParticipantCsv({
    eventId, actorId: 'actor_' + i,
    authorize: async () => true,
    tryAcquire: gate.tryAcquire.bind(gate),
    fetchEventSnapshot: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 25)); return snapshot; },
    fetchMemberPage: async () => page,
  }));
  const results = await Promise.allSettled(requests);
  const ok = results.filter(r => r.status === 'fulfilled');
  const busy = results.filter(r => r.status === 'rejected' && r.reason.code === 'BUSY');
  assert.equal(ok.length, 3);
  assert.equal(busy.length, 297);
  assert.equal(calls, 3);
  assert.equal(gate.peak, 3);
  assert.equal(gate.active, 0);
});
test('requires actual callbacks and rejects malformed IDs', async () => {
  const { options } = setup();
  await assert.rejects(() => exportParticipantCsv({ ...options, eventId: '../evil' }), /INVALID_INPUT/);
  await assert.rejects(() => exportParticipantCsv({ ...options, authorize: undefined }), /CONFIG/);
});
