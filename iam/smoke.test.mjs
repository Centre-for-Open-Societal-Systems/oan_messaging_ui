import assert from "node:assert/strict"
import { test } from "node:test"
import { verifyMessagingApi } from "./smoke.mjs"

const env = { MESSAGING_API_URL: "http://api.test/", MESSAGING_API_TOKEN: "good" }

/** A stub messaging API: `good` is the only accepted token. */
function stub({ okBody = { items: [] }, okStatus = 200, acceptAll = false } = {}) {
  const calls = []
  const fetchImpl = async (url, init) => {
    const auth = init.headers.Authorization
    calls.push({ url, auth })
    if (acceptAll || auth === "Bearer good") return new Response(JSON.stringify(okBody), { status: okStatus })
    return new Response("{}", { status: 401 })
  }
  return { fetchImpl, calls }
}

test("passes when the reader token works and others get 401", async () => {
  const { fetchImpl, calls } = stub()
  await verifyMessagingApi(env, fetchImpl)
  assert.equal(calls.length, 3)
  assert.ok(calls.every(c => c.url === "http://api.test/api/v1/messages?limit=1"))
  assert.deepEqual(calls.map(c => c.auth), [undefined, "Bearer invalid-smoke-token", "Bearer good"])
})

test("fails when anonymous or bad tokens are accepted", async () => {
  await assert.rejects(verifyMessagingApi(env, stub({ acceptAll: true }).fetchImpl), /anonymous .* must return 401/)
})

test("fails when the reader token is refused", async () => {
  await assert.rejects(verifyMessagingApi({ ...env, MESSAGING_API_TOKEN: "other" }, stub().fetchImpl), /must return 200; got 401/)
})

test("fails when the body has no items array", async () => {
  await assert.rejects(verifyMessagingApi(env, stub({ okBody: { oops: 1 } }).fetchImpl), /no `items` array/)
})

test("requires its settings", async () => {
  await assert.rejects(verifyMessagingApi({}, stub().fetchImpl), /MESSAGING_API_URL is required/)
})
