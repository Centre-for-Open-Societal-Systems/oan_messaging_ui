# Architecture

One Next.js standalone server serves the page and its own small API (a
backend-for-frontend). It is read-only and shows message metadata only.

```
 browser ──► this service ──────────────► oan_messaging_service
              ├─ proxy.ts    session + role check on every request   GET /api/v1/messages
              └─ /api/*      Elysia BFF   (Bearer reader token, server side)
 registry IAM ◄── session check (GET /auth/get_user_profile)
```

## Access

Login belongs to the registry IAM. After login IAM sets its session cookies on
the registry cookie domain; the console is served under that domain, so the
browser sends them with every request. `proxy.ts` runs before every page and
API route and:

1. asks IAM whether the session is valid, caching the answer per session for
   `SESSION_CACHE_SECONDS`;
2. requires the client role `MESSAGING_ROLE` (default `Messaging Viewer`) on
   the Keycloak client `MESSAGING_CLIENT_ID` (default `oan-messaging-ui`).

No session sends the browser to IAM login (`/api/auth/login`), which returns it
to the page it asked for. A session without the role gets a 403 page; API calls
get 401 or 403. Any host other than `PUBLIC_URL` is redirected there, except
`/api/health`, which probes call on the pod address.

The same client role drives the staff-portal tile: IAM enables a tile only for
users whose token has a role on the client named like the tile's application
mnemonic. `iam/payload.json` is the tile catalog (permission `messages:view`,
role `Messaging Viewer`); `iam/keycloak-setup.mjs` creates the client and role;
`iam/register.mjs` registers the tile; `iam/smoke.mjs` checks that the messaging
API accepts the reader token and rejects others.

## BFF routes

| Route | Purpose |
| --- | --- |
| `GET /api/health` | liveness, and whether the messaging API answers; no session needed |
| `GET /api/me` | signed-in user name and the staff portal link |
| `GET /api/messages` | the message list (below) |
| `GET /api/auth/login?returnTo=`, `GET /api/auth/logout` | start login at IAM / sign out |

`GET /api/messages` accepts `channel`, `status`, `caller`, `purpose`,
`source_reference` (prefix), `limit` (1-100, default 50) and `cursor`; any other
parameter is dropped (`server/messages-query.ts`). It forwards to
`MESSAGING_API_URL/api/v1/messages` with `Authorization: Bearer
MESSAGING_API_TOKEN` and a 15 s timeout, and passes the JSON through with
`Cache-Control: no-store`. If the service answers 401 or 403 the console
returns 502 (the reader token is not accepted); an unreachable service gives
504, and 503 is passed on. The token is never returned or logged.

## UI

A single client page: filter bar (Apply/Reset), Refresh and an auto-refresh
toggle (15 s, off by default), the table (newest first, "Load more" follows
`next_cursor`), and a detail dialog with the callback timeline and attempt log.
Telegram has no delivery receipts, so an empty callback list is shown as "n/a".
