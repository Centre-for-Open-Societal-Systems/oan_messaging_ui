import assert from "node:assert/strict"
import { test } from "node:test"
import { buildMessagesQuery } from "../server/messages-query.ts"

const ok = query => {
  const r = buildMessagesQuery(query)
  assert.equal(r.ok, true, r.error)
  return Object.fromEntries(r.params)
}

test("forwards exactly the whitelisted parameters and drops the rest", () => {
  assert.deepEqual(
    ok({ channel: "sms", status: "failed", caller: "c", purpose: "otp", source_reference: "reg:", cursor: "abc", limit: "10", token: "x", admin: "1" }),
    { channel: "sms", status: "failed", caller: "c", purpose: "otp", source_reference: "reg:", cursor: "abc", limit: "10" },
  )
})

test("defaults the limit and ignores empty values", () => {
  assert.deepEqual(ok({ channel: "", caller: "  " }), { limit: "50" })
})

test("takes the first of repeated parameters", () => {
  assert.deepEqual(ok({ channel: ["telegram", "sms"] }), { channel: "telegram", limit: "50" })
})

test("rejects bad values", () => {
  for (const q of [{ channel: "fax" }, { status: "lost" }, { limit: "0" }, { limit: "101" }, { limit: "1.5" }, { limit: "-1" }, { limit: "abc" }, { caller: "x".repeat(600) }]) {
    assert.equal(buildMessagesQuery(q).ok, false, JSON.stringify(q))
  }
})
