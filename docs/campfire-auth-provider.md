# Campfire Auth Provider research

Updated: 2026-09-19

## Decision

CA Clover must keep Campfire API access and authentication supply separate.

```
CampfireClient
  -> authenticated GraphQL
       -> TokenProvider
            -> VaultTokenProvider (current)
            -> FutureAuthProvider (only when a supported token acquisition flow is confirmed)
  -> anonymous normal GraphQL
       -> no token required for confirmed public event-detail operations
  -> public GraphQL
       -> no token required for public map-object lookup
```

Do not make manual DevTools token extraction a production user workflow.

Do not copy or depend on cmpf-tools user/community data. Only its API-access implementation has been used as a technical reference.

## What was confirmed

### 1. Authenticated Campfire GraphQL

Authenticated Campfire GraphQL calls use:

- `POST https://niantic-social-api.nianticlabs.com/graphql`
- `Authorization: Bearer <token>`
- JSON GraphQL body
- cursor pagination for feeds

This is already implemented in CA Clover's shared Campfire client.

### 2. campfire-tools does not mint the GraphQL Bearer

`topi314/campfire-tools` stores Campfire Bearer JWTs in its own database.
Admins submit those tokens manually through its admin UI.

The token is selected from stored, non-expired tokens by `getCampfireToken()`.
There is no code in campfire-tools that exchanges its Campfire login flow for the GraphQL Bearer used by `activeFeed` / `archivedFeed`.

### 3. campfire-auth is identity verification, not Bearer issuance

`topi314/campfire-auth` is a separate service.

Its login flow:

1. Generate a short verification code.
2. Ask the user to post that code into a specific Campfire channel.
3. campfire-auth reads channel message history.
4. It identifies the message sender.
5. The client exchanges a one-time code for a Campfire user object.

The exchange endpoint returns the verified user object, not a Campfire GraphQL access token.

Important: campfire-auth itself also needs a separately stored Campfire Bearer token to read message history. Its token database and token cleaner use the same manual token pattern.

Therefore self-hosting campfire-auth does not solve CA Clover's GraphQL token acquisition problem.

## Campfire Web session findings

The Campfire Web session token is used as a Bearer for the normal Niantic Social GraphQL endpoint.

A recent `topi314/campfire-map` implementation documents the first-party Campfire Web Local Storage key as:

```
CapacitorStorage.sessionToken
```

and sends that value as:

```
Authorization: Bearer <sessionToken>
```

to:

```
https://niantic-social-api.nianticlabs.com/graphql
```

This confirms the token shape/location used by the first-party web session.

It does **not** provide a supported third-party acquisition flow. The same project requires the operator to copy the token manually, so it is evidence about protocol behavior only, not a production authentication design for CA Clover.

Historical Niantic Profile code also used a browser session token as a Bearer for Niantic Social GraphQL, and a userscript updated on 2025-10-31 still observes the first-party Profile site calling `/niantic/graphql` directly from the browser.

## Anonymous normal GraphQL findings

`topi314/campfire-exporter` sends a logged-out request to the normal endpoint:

```
POST https://niantic-social-api.nianticlabs.com/graphql
```

with no Authorization header and `isLoggedIn: false`.

Its Relay query fetches `event(id)` and demonstrates that public Meetup detail can be returned without a Bearer.

The observed logged-out event shape includes fields CA Clover needs, such as:

- Meetup ID and title,
- start/end time,
- location/address,
- Community ID/name,
- Community Ambassador flag/badges,
- RSVP total count,
- check-in count,
- Campfire Live Event metadata.

The reference exporter also requests participant identities, but CA Clover intentionally does not copy those fields.

CA Clover now supports:

- `CampfireClient.anonymousRequest()`
- `CampfireClient.getAnonymousEvent(id)`

using the existing minimal `EVENT_QUERY`, which does not request ordinary participant identities.

This means a known Meetup ID can potentially be enriched with the required aggregate fields without a bearer token.

## Public GraphQL findings

Campfire also exposes:

```
POST https://niantic-social-api.nianticlabs.com/public/graphql
```

without a Bearer token.

`topi314/campfire-tools` uses this endpoint with `publicMapObjectsById(ids: ...)`.

Given a known public Meetup/map-object ID, it can return public event data including:

- Meetup ID,
- title,
- Community ID and name,
- address/place,
- coordinates,
- start/end time.

CA Clover has a minimal `PUBLIC_EVENTS_QUERY` and `CampfireClient.getPublicEvents(ids)` path that does not require a TokenProvider.

This is intentionally limited to non-participant data.

## Discovery remains the blocker

The missing piece is still:

```
Community ID -> active/archived Meetup IDs
```

or an equivalent public collection/discovery query.

Pokémon GO officially links users to:

```
https://campfire.nianticlabs.com/discover/collection/all-meetups
```

which confirms an "all meetups" collection exists in the first-party product.

No public source inspected so far exposes the GraphQL operation behind that collection.

`topi314/campfire-map` is not that operation. Its `realityChannelMapObjectsByS2Cells` query is for Pokémon GO game-map POIs such as gyms, PokéStops, routes and powerspots.

Therefore CA Clover should not guess a Collection field or query name.

## Official sign-in findings

Campfire officially supports Google, Facebook, and Apple sign-in.

Niantic/Scopely also operates a shared sign-in/profile layer at:

- `signin.nianticlabs.com`
- `my.nianticlabs.com`

Known first-party services use a URL pattern resembling:

```
https://signin.nianticlabs.com/signin?continue=<first-party callback>&service=<service id>
```

No public documentation or public code was found that provides all of the following for third-party Campfire integrations:

- application/client registration for Campfire API access,
- an authorization endpoint intended for third-party Campfire integrations,
- a documented third-party callback flow,
- a token endpoint that returns a Bearer accepted by Campfire GraphQL,
- refresh-token semantics for that Bearer.

Because those pieces are not confirmed, CA Clover must not guess service identifiers or endpoint names, copy first-party app credentials, or embed undocumented secrets.

## Current production position

Use `VaultTokenProvider` as the production source for operations that are confirmed to require authentication, especially Community feed discovery.

The existing ADMIN token UI remains an experimental/bootstrap mechanism, not the final user-facing authentication design.

For a known Meetup ID, prefer an anonymous/public operation when the required fields are available without authentication.

The API client is ready for a future supported AuthProvider without another GraphQL transport refactor.

## Requirements for a future provider

A future automatic provider can replace VaultTokenProvider only after all of the following are verified:

1. User authorization is interactive and does not require CA Clover to collect Google/Facebook/Apple passwords.
2. The flow yields a token explicitly accepted by Campfire GraphQL.
3. Token expiry can be determined.
4. Renewal or re-authorization behavior is known.
5. No private first-party app secret is required.
6. The flow can be used without storing participant identity data CA Clover does not need.

## Next research targets

Priority order:

1. Identify the GraphQL operation behind `/discover/collection/all-meetups` from a public source or first-party browser-visible request.
2. Determine whether the collection operation can be used logged out.
3. Determine whether Community pages expose public active Meetup IDs.
4. Test whether archived Community feeds require authentication.
5. If public discovery cannot be confirmed, keep VaultTokenProvider for discovery and use anonymous/public detail queries to reduce the amount of authenticated API access.

## References inspected

- `topi314/campfire-tools/server/campfire/client.go`
- `topi314/campfire-tools/server/campfire/public_events.go`
- `topi314/campfire-tools/server/campfire/queries/public_events.graphql`
- `topi314/campfire-tools/server/server.go`
- `topi314/campfire-tools/server/web/tracker/admin.go`
- `topi314/campfire-tools/server/database/campfire_tokens.go`
- `topi314/campfire-tools/server/web/rewards/sign_up.go`
- `topi314/campfire-auth/README.md`
- `topi314/campfire-auth/server/web/login.go`
- `topi314/campfire-auth/server/web/api.go`
- `topi314/campfire-auth/server/campfire_login_code_checker.go`
- `topi314/campfire-auth/server/server.go`
- `topi314/campfire-exporter/main.go`
- `topi314/campfire-exporter/query.graphql`
- `topi314/campfire-map/server/campfire/client.go`
- `topi314/campfire-map/server/campfire/queries/README.md`
- `topi314/campfire-map/server/campfire/queries/map_objects_by_s2_cells.graphql`
- Campfire Help Center: Other ways to log in to Campfire
- Pokémon GO 2024 Community Update linking the all-meetups collection
- Niantic Profile userscript updated 2025-10-31 observing `/niantic/graphql`
- Historical Niantic Profile browser script using a browser session token as a Bearer
