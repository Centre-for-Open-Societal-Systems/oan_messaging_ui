# OAN Messaging console checks

`bash ci/run-isolated.sh` runs locked npm installation, lint, TypeScript checks,
the `iam/*.test.mjs` tests and a production Next.js build inside Node 24, then
builds the root Dockerfile. No server is started and no live IAM or messaging
endpoint is called. Test containers use unique owner labels, a 2 GiB limit and a
1536 MiB Node heap limit; cleanup removes only the container this invocation
created. JUnit reports are kept under `reports/` (ignored by Git and builds).

GitHub runs the same checks (`.github/workflows/checks.yml`, immutable action
SHAs). Jenkins runs this validation, then builds and publishes the image (see
`Jenkinsfile` and `docs/ci.md`).
