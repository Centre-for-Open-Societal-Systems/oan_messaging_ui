# CI and image publication

- **Validation**: `bash ci/run-isolated.sh` (Docker only): locked `npm ci`, lint,
  TypeScript, the `node --test` suites (`iam/*.test.mjs`: Keycloak grants, smoke
  logic, query whitelist), a production build, then a build of the Dockerfile.
  JUnit goes to `reports/tests.xml`. See [../ci/README.md](../ci/README.md).
- **GitHub**: `.github/workflows/checks.yml` runs the image-name tests,
  `bash ci/validate.sh` and a Docker build on pull requests and on develop.
- **Jenkins**: `Jenkinsfile` (job `oan-messaging-ui`,
  `ci/jenkins/jobs/oan-messaging-ui.xml`, develop only): checkout, version from
  `init.yaml` via `scripts/ci/image_names.py`, validation, docker build, and on
  `develop` a push to ECR with credential `aws-ecr-creds-new`:
  `379220350808.dkr.ecr.ap-south-1.amazonaws.com/eoan/oan_messaging_ui/oan-messaging-ui:<version>-develop.<build>`
  plus a 12-character commit tag. ECR tags are immutable; bump `init.yaml` when a
  recreated job restarts the build number.

The Jenkins job and pipeline have not yet been run against a live Jenkins.
