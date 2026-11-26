# Deployment

This repository holds the application and its Dockerfile. Deployment is the
`oan-messaging` chart in oan-helm, which is expected to provision the Keycloak
client, the role, the staff-portal tile and the reader token, and to run this
image's `iam/` scripts. Nothing in this repository deploys by itself.

## Container

- Image: `eoan/oan_messaging_ui/oan-messaging-ui` in ECR (see [ci.md](ci.md)).
- Port `3000`, liveness `GET /api/health` (public; reports `degraded` when the
  messaging API does not answer).
- Environment: `MESSAGING_API_URL`, `MESSAGING_API_TOKEN`, `PUBLIC_URL`,
  `IAM_URL`, and normally `COOKIE_DOMAIN`, `LOGIN_PROVIDER_ID`, `OIDC_LOGOUT_URL`,
  `OIDC_CLIENT_ID`, `STAFF_PORTAL_URL`; see the README table. `AUTH_ENABLED` must
  stay true and `MESSAGING_API_MOCK` unset.

## IAM jobs (same image, run once per deploy)

| Step | Command | Needs |
| --- | --- | --- |
| Keycloak client and role | `node iam/keycloak-setup.mjs` | `IAM_URL`, `PUBLIC_URL`, `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD`, `MESSAGING_CLIENT_SECRET`, optional `GRANT_USERS` |
| Staff-portal tile | `node iam/register.mjs` | `IAM_URL`, `PUBLIC_URL`, `APP_DESCRIPTION`, `MESSAGING_CLIENT_ID`, `MESSAGING_CLIENT_SECRET` |
| Smoke check | `node iam/smoke.mjs` | `MESSAGING_API_URL`, `MESSAGING_API_TOKEN` |

The client is `oan-messaging-ui` (also the IAM application mnemonic), the role
`Messaging Viewer`. No staff user has access by default; roles are granted in
Keycloak (or with `GRANT_USERS`).

Never put credentials in source or the image. The reader token and client secret
come from managed Secrets.
