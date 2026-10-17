// Candidate policy mirrored by bounded DB control columns; server is authoritative.
export const ENGINE_POLICY = Object.freeze({minimumSeconds:15, hourlyLimit:12,
  clientCooldownMs:16_000, browserTimeoutMs:100_000, requestTimeoutMs:12_000,
  deadlineMs:90_000, reservationSeconds:120, snapshotRetries:1, networkRetries:2});
