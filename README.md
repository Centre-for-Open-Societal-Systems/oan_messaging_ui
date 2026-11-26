# OAN Messaging console

A staff console that lists every message sent through
[oan_messaging_service](https://github.com/Centre-for-Open-Societal-Systems/oan_messaging_service),
newest first, with the callbacks received for each message and the provider
attempts. Click a row for the full detail and the callback timeline.

It shows message **metadata only**: the service never stores message text, so
the console cannot show it, and recipients arrive already masked. Telegram
messages have no delivery receipts and are shown as such.

Next.js 16 (standalone server) with its own backend-for-frontend (Elysia,
mounted under `/api`), Tailwind v4, Radix, lucide and Geist.

## Security

- Staff sign in through the registry IAM (cookie session) and need the
  Keycloak client role `Messaging Viewer` on the client `oan-messaging-ui`.
- The browser never talks to the messaging service. The BFF calls it with a
  reader token (`MESSAGING_API_TOKEN`) held on the server; the token is never
  sent to the browser or logged.
- The BFF forwards only the documented filters (channel, status, caller,
  purpose, source_reference, limit, cursor) and answers with
  `Cache-Control: no-store`.

## Run locally

```bash
npm ci
cp .env.example .env.local     # then edit
npm run dev
```

For UI work without IAM or a messaging service, set `AUTH_ENABLED=false` and
`MESSAGING_API_MOCK=1`: a few built-in sample messages (with callbacks) are
served. The mock is ignored in production builds (`NODE_ENV=production`).

Checks (what CI runs): `npm run lint`, `npm run typecheck`, `npm test`,
`npm run build`; or `bash ci/run-isolated.sh` for the same inside Docker.

## Configuration

| Variable | Required | Meaning |
| --- | --- | --- |
| `MESSAGING_API_URL` | yes (not with mock) | Base URL of the messaging service, e.g. `http://oan-messaging-api` |
| `MESSAGING_API_TOKEN` | yes (not with mock) | Reader token of this console; server side only |
| `MESSAGING_API_MOCK` | no | `1` with `AUTH_ENABLED=false`: built-in sample data, never in production |
| `PUBLIC_URL` | yes | Public origin of the console; login return URLs, canonical host |
| `IAM_URL` | yes | The registry IAM (staff portal API) |
| `LOGIN_PROVIDER_ID` | no | IAM login provider; discovered when empty |
| `MESSAGING_CLIENT_ID` | no | Keycloak client and IAM application mnemonic, default `oan-messaging-ui` |
| `MESSAGING_ROLE` | no | Client role that grants access, default `Messaging Viewer` |
| `MESSAGING_CLIENT_SECRET` | iam/ scripts only | Secret of that client; the server does not read it |
| `COOKIE_DOMAIN` | no | Domain IAM scopes its session cookies to |
| `OIDC_LOGOUT_URL`, `OIDC_CLIENT_ID` | no | End the Keycloak session when IAM cannot |
| `SESSION_CACHE_SECONDS` | no | How long a validated session is trusted, default 60 |
| `AUTH_ENABLED` | no | `false` only for local UI work |
| `STAFF_PORTAL_URL` | no | Header link to the staff portal |

## Layout

| Path | What it is |
| --- | --- |
| `app/`, `proxy.ts` | Pages, auth routes, and the session/role gate for every request |
| `components/messages/` | The console: filter bar, table, detail dialog, data hook |
| `components/ui/` | Small UI primitives |
| `server/` | BFF (`app.ts`), query whitelist, messaging API client, mock, auth, config |
| `lib/messages.ts` | Types of the messaging API list response |
| `iam/` | Keycloak setup, IAM registration (tile, permission, role) and smoke check |
| `ci/`, `scripts/ci/`, `Jenkinsfile`, `init.yaml` | Validation, image naming, build and publish |
| `docs/` | Architecture, deployment and CI notes |

See [docs/architecture.md](docs/architecture.md), [docs/deployment.md](docs/deployment.md)
and [docs/ci.md](docs/ci.md).
