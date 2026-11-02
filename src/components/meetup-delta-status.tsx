"use client";

import { meetupDeltaMessage, type DeltaStatus } from "@/lib/meetup-delta-display";

export function MeetupDeltaStatus({ status, added = 0, updated = 0 }: {
  status: DeltaStatus;
  added?: number;
  updated?: number;
}) {
  return (
    <div role="status" aria-live="polite" data-meetup-delta-status={status}>
      <span>{meetupDeltaMessage(status, added, updated)}</span>
    </div>
  );
}
