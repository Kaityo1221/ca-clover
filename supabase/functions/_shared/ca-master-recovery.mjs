/**
 * Decide whether an Edge function can safely release its CA-master lease.
 *
 * During a partial write, a failed attempt to switch off the dedicated
 * CA-master gate MUST NOT release the lease: it must expire and fail closed.
 *
 * @param {{writeStarted:boolean, writeFailed:boolean, pauseConfirmed:boolean}} state
 * @returns {boolean}
 */
export function shouldReleaseCaMasterLease({writeStarted,writeFailed,pauseConfirmed}){
  return !writeFailed || !writeStarted || pauseConfirmed;
}
