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

/**
 * Failure handler used by the real sync-ca-master Edge Function.
 * It attempts a gated pause (only the execution lease owner can do so),
 * then records the failed write stage in sync_runs. A failed audit must not
 * negate a successful pause. If the pause is unconfirmed, the caller MUST
 * retain its lease until the DB rejects a stale lock and pauses next startup.
 *
 * This deliberately does not mutate unrelated scheduler state.
 *
 * @param {object} params
 * @param {object} params.admin service-role Supabase client
 * @param {string} params.owner current lease owner UUID
 * @param {string} params.stage failed write stage (no PII)
 * @param {string} params.finishedAt ISO timestamp
 * @param {string} [params.code] fixed internal audit reason (never pass user input)
 * @returns {Promise<boolean>} true only if the owner-specific stop was confirmed
 */
export async function pauseAndAuditCaMasterFailure({admin,owner,stage,finishedAt,code="CA_MASTER_WRITE_INTERRUPTED"}){
  let pausedByOwner=false;
  try{
    const {data:paused,error:pauseError}=await admin.from("sync_automation_state")
      .update({ca_master_sync_enabled:false})
      .eq("id",1)
      .eq("ca_master_lease_owner",owner)
      .select("id")
      .maybeSingle();
    pausedByOwner=!pauseError&&paused?.id===1;
    if(!pausedByOwner) console.error("CA master pause not confirmed for lease owner");
  }catch{
    console.error("CA master dedicated pause request failed");
  }
  try{
    const {error:auditError}=await admin.from("sync_runs").insert({
      source:"ca_members_map",
      status:"partial",
      finished_at:finishedAt,
      details:{
        code,
        stage,
        requires_admin_review:true,
      },
    });
    if(auditError) console.error("CA master failure audit unavailable",auditError.code);
  }catch{
    console.error("CA master failure audit insert failed");
  }
  return pausedByOwner;
}
