// The only query parameters the BFF forwards to the messaging API, and the
// only values it accepts for them. Anything else is dropped, so the browser
// cannot reach other parameters or endpoints of the service.
import { CHANNELS, STATUSES } from "../lib/messages.ts"

export const MAX_LIMIT = 100
export const DEFAULT_LIMIT = 50

export type QueryResult = { ok: true; params: URLSearchParams } | { ok: false; error: string }

const TEXT_PARAMS = ["caller", "purpose", "source_reference", "cursor"] as const
const MAX_TEXT = 512

function one(value: unknown): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  if (typeof v !== "string") return undefined
  const trimmed = v.trim()
  return trimmed === "" ? undefined : trimmed
}

export function buildMessagesQuery(query: Record<string, unknown>): QueryResult {
  const params = new URLSearchParams()

  const channel = one(query.channel)
  if (channel !== undefined) {
    if (!(CHANNELS as readonly string[]).includes(channel)) return { ok: false, error: "channel must be sms or telegram" }
    params.set("channel", channel)
  }

  const status = one(query.status)
  if (status !== undefined) {
    if (!(STATUSES as readonly string[]).includes(status)) return { ok: false, error: `status must be one of ${STATUSES.join(", ")}` }
    params.set("status", status)
  }

  for (const name of TEXT_PARAMS) {
    const value = one(query[name])
    if (value === undefined) continue
    if (value.length > MAX_TEXT) return { ok: false, error: `${name} is too long` }
    params.set(name, value)
  }

  const limit = one(query.limit)
  if (limit !== undefined) {
    if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > MAX_LIMIT) {
      return { ok: false, error: `limit must be a whole number from 1 to ${MAX_LIMIT}` }
    }
    params.set("limit", String(Number(limit)))
  } else {
    params.set("limit", String(DEFAULT_LIMIT))
  }

  return { ok: true, params }
}
