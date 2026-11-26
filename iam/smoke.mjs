// Runs from the application image as the owning chart's smoke hook. Verifies
// what the console's BFF depends on: the messaging API accepts the console's
// reader token and rejects anyone else. Needs no staff password.
//
// Environment: MESSAGING_API_URL, MESSAGING_API_TOKEN
import { fileURLToPath } from "node:url"

export async function verifyMessagingApi(env = process.env, fetchImpl = fetch) {
  const required = name => {
    const value = env[name]?.trim()
    if (!value) throw new Error(`${name} is required for messaging API verification`)
    return value
  }
  const url = `${required("MESSAGING_API_URL").replace(/\/+$/, "")}/api/v1/messages?limit=1`
  const token = required("MESSAGING_API_TOKEN")
  const request = bearer =>
    fetchImpl(url, {
      headers: { Accept: "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
      signal: AbortSignal.timeout(20000),
    })

  for (const [label, bearer] of [["anonymous", undefined], ["invalid-token", "invalid-smoke-token"]]) {
    const rejected = await request(bearer)
    if (rejected.status !== 401) throw new Error(`${label} message list request must return 401; got ${rejected.status}`)
    console.log(`${label}: rejected with 401`)
  }

  const result = await request(token)
  if (result.status !== 200) throw new Error(`reader token request must return 200; got ${result.status}`)
  const body = await result.json().catch(() => null)
  if (!Array.isArray(body?.items)) throw new Error("message list response has no `items` array")
  console.log("reader token: message list verified")
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyMessagingApi().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
