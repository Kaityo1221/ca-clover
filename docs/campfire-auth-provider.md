# Campfire Auth Provider research

Updated: 2026-09-19

## Decision

CA Clover must keep Campfire API access and authentication supply separate.

```
CampfireClient
  -> TokenProvider
       -> VaultTokenProvider (current)
       -> FutureAuthProvider (only when a supported token acquisition flow is confirmed)
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

## Official sign-in findings

Campfire officially supports Google, Facebook, and Apple sign-in.

Niantic also operates a shared sign-in/profile layer at:

- `signin.nianticlabs.com`
- `my.nianticlabs.com`

However, no public documentation or public code was found that provides all of the following for third-party Campfire integrations:

- application/client registration for Campfire API access
- an authorization endpoint intended for third-party Campfire integrations
- a documented callback flow
- a token endpoint that returns a Bearer accepted by `niantic-social-api.nianticlabs.com/graphql`
- refresh-token semantics for that Bearer

Because those pieces are not confirmed, CA Clover must not guess endpoint names, copy private mobile-app credentials, or embed undocumented client secrets.

## Current production position

Use `VaultTokenProvider` as the only production token source for now.

The existing ADMIN token UI is still considered an experimental/bootstrap mechanism, not the final user-facing authentication design.

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

1. Confirm whether the Campfire web application performs a browser-visible, user-driven exchange from Niantic sign-in to a Campfire API token.
2. Confirm whether that exchange uses a public client identifier or a first-party-only service identifier.
3. Determine whether the resulting GraphQL Bearer has any supported refresh mechanism.
4. If no supported exchange exists, keep the Vault provider and add operational token-expiry handling rather than building a brittle pseudo-OAuth flow.

## References inspected

- `topi314/campfire-tools/server/campfire/client.go`
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
