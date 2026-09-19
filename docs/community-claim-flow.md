# Community claim flow

Updated: 2026-09-19

## Purpose

A CA can register one of their own Campfire Meetup URLs or IDs. CA Clover resolves the Meetup anonymously, extracts its Campfire Community ID, matches it to the local CA master Community, and creates an ADMIN approval request.

A Meetup URL is a discovery key, not proof of ownership. Access is granted only after ADMIN approval.

## Flow

1. CA account enters a Campfire Meetup URL or Meetup ID from /my.
2. community-claim extracts the Meetup ID.
3. It calls CampfireClient.getAnonymousEvent() without a Bearer token.
4. If anonymous detail is unavailable, it falls back to getPublicEvents().
5. clubId is matched to communities.campfire_community_id.
6. A community_access_requests row is created.
7. ADMIN sees pending requests at /admin/claims.
8. ADMIN approves or rejects.
9. Approval inserts community_memberships and seeds the submitted Meetup into meetups.

## CA master check

If the profile niantic_id exactly matches a ca_members.source_key, the request also checks whether that CA master record is linked to the detected Community.

- true: master link matches.
- false: identity matched a CA master record, but that Community link did not.
- null: no reliable CA master identity match was available, so ADMIN must verify manually.

The external CA master source remains read-only. Approval never modifies community_ca_members.

## Load behavior

Normal submission makes one anonymous Campfire GraphQL request. Public GraphQL is used only as a fallback. Approval does not contact Campfire again; it uses the aggregate Meetup values stored with the request.
