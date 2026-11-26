import assert from "node:assert/strict"
import { createServer } from "node:http"
import { test } from "node:test"

let runs = 0

async function fixture({ users, brokenGrant = false, dropExisting = false } = {}) {
  const user = { id: "staff-admin-id", username: "admin", enabled: true }
  const viewer = { id: "viewer-role", name: "Messaging Viewer" }
  const unrelated = { id: "existing-role", name: "Registry Approver" }
  const clients = new Map([["messaging", { id: "messaging-id", clientId: "messaging" }]])
  const mappings = new Map([["staff-admin-id/messaging-id", [unrelated]]])
  let writes = 0
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost")
    const path = decodeURIComponent(url.pathname).replace("/admin/realms/staff", "")
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const raw = Buffer.concat(chunks).toString()
    const send = (status, body) => {
      response.writeHead(status, { "Content-Type": "application/json" })
      response.end(body === undefined ? "" : JSON.stringify(body))
    }
    if (request.url === "/realms/master/protocol/openid-connect/token") return send(200, { access_token: "fixture-admin-token" })
    if (request.headers.authorization !== "Bearer fixture-admin-token") return send(401, {})
    if (request.method !== "GET") writes++
    if (path === "/users") return send(200, users ?? [user])
    if (path === "/clients") return send(200, [clients.get(url.searchParams.get("clientId"))].filter(Boolean))
    if (path === "/clients/messaging-id" && request.method === "PUT") return send(204)
    if (path === "/clients/messaging-id/roles/Messaging Viewer") return send(200, viewer)
    const match = path.match(/^\/users\/([^/]+)\/role-mappings\/clients\/([^/]+)$/)
    if (match) {
      const key = `${match[1]}/${match[2]}`
      if (request.method === "GET") return send(200, mappings.get(key) ?? [])
      if (request.method === "POST") {
        if (!brokenGrant) {
          const previous = dropExisting ? [] : mappings.get(key) ?? []
          mappings.set(key, [...new Map([...previous, ...JSON.parse(raw)].map(role => [role.id, role])).values()])
        }
        return send(204)
      }
    }
    send(501, { error: "Unmodeled contract" })
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  return {
    mappings,
    user,
    writes: () => writes,
    close: () => new Promise(resolve => server.close(resolve)),
    run: async () => {
      const env = { KEYCLOAK_URL: `http://127.0.0.1:${server.address().port}`, KEYCLOAK_REALM: "staff",
          KEYCLOAK_ADMIN_PASSWORD: "fixture-only", MESSAGING_CLIENT_ID: "messaging", MESSAGING_CLIENT_SECRET: "fixture-only",
          GRANT_USERS: "admin", MAX_ATTEMPTS: "1" }
      const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]))
      Object.assign(process.env, env)
      try {
        await import(`./keycloak-setup.mjs?run=${++runs}`)
        return { code: 0, output: "" }
      } catch (error) { return { code: 1, output: error.message } }
      finally {
        for (const [key, value] of Object.entries(previous)) {
          if (value === undefined) delete process.env[key]
          else process.env[key] = value
        }
      }
    },
  }
}

test("existing admin keeps identity and unrelated roles; grants are idempotent", async () => {
  const state = await fixture()
  try {
    const identity = JSON.stringify(state.user)
    for (let i = 0; i < 2; i++) {
      const result = await state.run()
      assert.equal(result.code, 0, result.output)
    }
    assert.equal(JSON.stringify(state.user), identity)
    assert.deepEqual(state.mappings.get("staff-admin-id/messaging-id").map(r => r.name), ["Registry Approver", "Messaging Viewer"])
    assert.equal(state.writes(), 3) // Two client updates; the role added once.
  } finally { await state.close() }
})

for (const [name, users] of [
  ["missing", []],
  ["ambiguous", [{ id: "a", username: "admin" }, { id: "b", username: "admin" }]],
  ["wrong username", [{ id: "a", username: "administrator" }]],
  ["service account", [{ id: "a", username: "admin", serviceAccountClientId: "service" }]],
]) {
  test(`${name} requested user fails before any IAM mutation`, async () => {
    const state = await fixture({ users })
    try {
      const result = await state.run()
      assert.notEqual(result.code, 0)
      assert.match(result.output, /must resolve to exactly one staff user/)
      assert.equal(state.writes(), 0)
    } finally { await state.close() }
  })
}

for (const options of [{ brokenGrant: true }, { dropExisting: true }]) {
  test(`mapping verification rejects ${JSON.stringify(options)}`, async () => {
    const state = await fixture(options)
    try {
      const result = await state.run()
      assert.notEqual(result.code, 0)
      assert.match(result.output, /Client role grant verification failed/)
    } finally { await state.close() }
  })
}
