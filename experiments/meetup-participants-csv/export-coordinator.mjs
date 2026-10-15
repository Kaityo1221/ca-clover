import { buildParticipantCsv } from './csv-core.mjs';
import { collectMemberPages } from './member-pages.mjs';

// Pure dependency-injected integration. No production network, auth keys, DB, or tokens.
// The injected gate MUST be distributed/shared in a production deployment.
export class ExportFailure extends Error {
  constructor(code) {
    super(code);
    this.name = 'ExportFailure';
    this.code = code;
  }
}

function requireCallback(value, name) {
  if (typeof value !== 'function') throw new ExportFailure('CONFIG');
}

function fail(code) { throw new ExportFailure(code); }

export async function exportParticipantCsv({
  eventId,
  actorId,
  authorize,
  tryAcquire,
  fetchEventSnapshot,
  fetchMemberPage,
}) {
  if (typeof eventId !== 'string' || !/^[a-zA-Z0-9_-]{3,200}$/.test(eventId)) fail('INVALID_INPUT');
  if (typeof actorId !== 'string' || !actorId.trim()) fail('INVALID_INPUT');
  requireCallback(authorize, 'authorize');
  requireCallback(tryAcquire, 'tryAcquire');
  requireCallback(fetchEventSnapshot, 'fetchEventSnapshot');
  requireCallback(fetchMemberPage, 'fetchMemberPage');

  // The caller must inject an authenticated, server-side authorization check.
  // No query to private participant data occurs until this check succeeds.
  let allowed;
  try { allowed = await authorize({ actorId, eventId }); }
  catch { fail('FORBIDDEN'); }
  if (allowed !== true) fail('FORBIDDEN');

  // Null lease means BUSY. In production this must be a cross-instance lease
  // with an expiry; an in-process semaphore is NOT enough for Supabase.
  let lease;
  try { lease = await tryAcquire({ actorId, eventId }); }
  catch { fail('BUSY'); }
  if (!lease) fail('BUSY');
  if (typeof lease.release !== 'function') fail('CONFIG');

  try {
    const snapshot = await fetchEventSnapshot({ eventId });
    if (snapshot?.event?.id !== eventId) fail('INCOMPLETE');
    if (snapshot.allStatusesComplete !== true || !Array.isArray(snapshot.rsvpStatuses)) {
      fail('INCOMPLETE');
    }

    const pageResult = await collectMemberPages({ eventId, fetchPage: fetchMemberPage });
    const result = buildParticipantCsv({
      event: snapshot.event,
      members: pageResult.members,
      rsvpStatuses: snapshot.rsvpStatuses,
      allPagesComplete: pageResult.allPagesComplete,
      allStatusesComplete: snapshot.allStatusesComplete,
    });
    return result;
  } catch (error) {
    if (error instanceof ExportFailure) throw error;
    // Do not expose GraphQL payloads, usernames, IDs, or raw exceptions.
    fail('INCOMPLETE');
  } finally {
    try { await lease.release(); }
    catch { fail('GATE_ERROR'); }
  }
}
