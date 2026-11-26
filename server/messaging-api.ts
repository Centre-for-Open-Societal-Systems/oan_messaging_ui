// Calls the messaging service with the console's reader token. The token is
// read here, on the server, and never leaves it: not in a response, not in a log.
import type { MessagePage } from "../lib/messages"
import { config } from "./config"
import { mockMessages } from "./mock-api"

const TIMEOUT_MS = 15_000

export type UpstreamResult =
  | { ok: true; page: MessagePage }
  | { ok: false; status: number; message: string }

export async function fetchMessages(params: URLSearchParams, fetchImpl: typeof fetch = fetch): Promise<UpstreamResult> {
  if (config.messagingApi.mock) return { ok: true, page: mockMessages(params) }

  let res: Response
  try {
    res = await fetchImpl(`${config.messagingApi.url}/api/v1/messages?${params}`, {
      headers: { Authorization: `Bearer ${config.messagingApi.token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError"
    return { ok: false, status: 504, message: timedOut ? "The messaging service did not answer in time" : "The messaging service is unreachable" }
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, status: 502, message: "The console's reader token is not accepted by the messaging service" }
  }
  if (res.status === 422) {
    return { ok: false, status: 422, message: await problemDetail(res, "The messaging service rejected the filters") }
  }
  if (!res.ok) {
    return { ok: false, status: res.status === 503 ? 503 : 502, message: "The messaging service is not available" }
  }
  try {
    const page = (await res.json()) as MessagePage
    if (!Array.isArray(page?.items)) throw new Error("no items")
    return { ok: true, page }
  } catch {
    return { ok: false, status: 502, message: "The messaging service returned an unexpected response" }
  }
}

/** Whether the messaging API answers at all (any HTTP response counts; a 401 proves it is up). */
export async function pingMessagingApi(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (config.messagingApi.mock) return true
  try {
    await fetchImpl(`${config.messagingApi.url}/api/v1/messages?limit=1`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    })
    return true
  } catch {
    return false
  }
}

async function problemDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown; title?: unknown }
    const text = typeof body.detail === "string" ? body.detail : typeof body.title === "string" ? body.title : ""
    return text ? text.slice(0, 300) : fallback
  } catch {
    return fallback
  }
}
