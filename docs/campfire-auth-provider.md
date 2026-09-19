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
  -> public GraphQL
       -> no token required
```

Do not make manual DevTools token extraction a production user workflow.

Do not copy or depend on cmpf-tools user/community data. Only its API-access implementation has been used as a technical reference.

## What was confirmed

### 1. Campfire GraphQL access

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

## Current Niantic web-session findings

There is evidence that Niantic's browser session has historically been used directly as a Bearer for the Niantic Social GraphQL API.

A 2022 Niantic Profile browser script used `localStorage.sessionToken` as:

```
Authorization: Bearer <sessionToken>
```

against:

```
https://niantic-social-api.nianticlabs.com/niantic/graphql
```

More importantly, a Niantic Profile userscript updated on 2025-10-31 still observes the first-party web application calling the same `/niantic/graphql` endpoint directly from the browser.

This confirms that the browser-to-Niantic-Social architecture remains active recently, but it does **not** yet prove that:

- the 2026 Campfire web app stores the same token in localStorage,
- the Niantic Profile token is accepted by Campfire's `/graphql` endpoint,
- a third-party application can obtain that token through a supported redirect/callback,
- the token has a supported refresh flow for third-party clients.

Until those points are confirmed, CA Clover must not build an automatic provider around guessed first-party behavior.

## Official sign-in findings

Campfire officially supports Google, Facebook, and Apple sign-in.

Niantic/Scopely also operates a shared sign-in/profile layer at:

- `signin.nianticlabs.com`
- `my.nianticlabs.com`

Known first-party services use a URL pattern resembling:

```
https://signin.nianticlabs.com/signin?continue=<first-party callback>&service=<service id>
```

For example, Wayfarer uses its own first-party service identifier and callback.

No public documentation or public code was found that provides all of the following for third-party Campfire integrations:

- application/client registration for Campfire API access,
- an authorization endpoint intended for third-party Campfire integrations,
- a documented third-party callback flow,
- a token endpoint that returns a Bearer accepted by `niantic-social-api.nianticlabs.com/graphql`,
- refresh-token semantics for that Bearer.

Because those pieces are not confirmed, CA Clover must not guess service identifiers or endpoint names, copy private mobile-app credentials, or embed undocumented client secrets.

## Public GraphQL findings

Campfire also exposes:

```
POST https://niantic-social-api.nianticlabs.com/public/graphql
```

without a Bearer token.

`topi314/campfire-tools` uses this public endpoint with `publicMapObjectsById(ids: ...)`.

Given a known public Meetup/map-object ID, the endpoint can return public event data including:

- Meetup ID,
- title,
- Community ID and name,
- address/place,
- coordinates,
- start time,
- end time.

CA Clover now has a minimal `PUBLIC_EVENTS_QUERY` and `CampfireClient.getPublicEvents(ids)` path that does not require a TokenProvider.

This is intentionally limited to non-participant data.

### Public endpoint limitation

The missing piece is discovery.

The confirmed public query resolves **known Meetup IDs**. It does not by itself provide the required:

```
Community ID -> all active/archived Meetup IDs
```

mapping.

Therefore it cannot currently replace authenticated `activeFeed` / `archivedFeed` sync.

If a public collection/map query is confirmed later, CA Clover may be able to reduce or eliminate Bearer dependence for event discovery.

## Current production position

Use `VaultTokenProvider` as the only production authenticated token source for now.

The existing ADMIN token UI is still considered an experimental/bootstrap mechanism, not the final user-facing authentication design.

Use public GraphQL whenever a Meetup ID is already known and the required field is available publicly.

The API client is ready for a future provider without another GraphQL refactor.

## Requirements for a future provider

A future automatic provider can replace VaultTokenProvider only after the following are known and verified:

1. User authorization is interactive and does not require CA Clover to collect Google/Facebook/Apple passwords.
2. The flow yields a token explicitly accepted by Campfire GraphQL.
3. Token expiry can be determined.
4. Renewal or re-authorization behavior is known.
5. No private app secret extracted from the Campfire mobile application is required.
6. The flow can be used without storing participant identity data that CA Clover does not need.

## Next research targets

Priority order:

1. Determine whether the public Campfire discovery/collection UI uses a public GraphQL query capable of returning Meetup IDs by area, collection, or Community.
2. Confirm whether Campfire Web performs a browser-visible user-driven exchange from shared Niantic sign-in to a Campfire API token.
3. Confirm whether the browser token used by Niantic Profile is accepted by Campfire `/graphql` or has a different audience.
4. Determine whether any supported refresh mechanism exists.
5. If no supported exchange exists, keep VaultTokenProvider and improve operational token-expiry handling rather than building a brittle pseudo-OAuth flow.

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
- `topi314/campfire-auth/server/database/campfire_tokens.go`
- Campfire Help Center: Other ways to log in to Campfire
- Niantic Profile
- Niantic shared sign-in page
- Niantic Profile userscript updated 2025-10-31 observing `/niantic/graphql`
- Historical Niantic Profile browser script using `localStorage.sessionToken` as a Bearer
