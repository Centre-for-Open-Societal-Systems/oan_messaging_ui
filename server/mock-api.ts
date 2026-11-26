// A tiny stand-in for GET /api/v1/messages, for UI work only
// (AUTH_ENABLED=false and MESSAGING_API_MOCK=1; config.ts refuses it in
// production). Sample data only; nothing here is real.
import type { MessageItem, MessagePage } from "../lib/messages"

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

function sample(i: number): MessageItem {
  const kinds = ["delivered", "sent", "failed", "accepted", "expired", "unknown", "sending"] as const
  const status = kinds[i % kinds.length]
  const telegram = i % 4 === 3
  const created = minutesAgo(i * 17 + 2)
  const callbacks =
    telegram || status === "accepted" || status === "sending"
      ? []
      : [
          { id: `cb-${i}-1`, provider: "sample-sms", raw_status: "SENT", disposition: "sent", event_time: minutesAgo(i * 17 + 1), received_at: minutesAgo(i * 17 + 1) },
          ...(status === "delivered" || status === "failed"
            ? [
                {
                  id: `cb-${i}-2`,
                  provider: "sample-sms",
                  raw_status: status === "delivered" ? "DELIVRD" : "UNDELIV",
                  disposition: status,
                  event_time: minutesAgo(i * 17),
                  received_at: minutesAgo(i * 17),
                },
              ]
            : []),
        ]
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    caller_id: i % 2 ? "farmer-registry" : "livestock-registry",
    channel: telegram ? "telegram" : "sms",
    purpose: i % 3 ? "otp" : "notification",
    source_reference: `registration:${1000 + i}`,
    status,
    final: ["delivered", "failed", "expired"].includes(status),
    failure_code: status === "failed" ? "undeliverable" : null,
    provider_status: status === "failed" ? "UNDELIV" : null,
    recipient_masked: telegram ? "tg:***4821" : `+2519*****${10 + (i % 90)}`,
    delivery_receipts_supported: !telegram,
    attempts: status === "failed" ? 2 : 1,
    created_at: created,
    updated_at: minutesAgo(i * 17),
    expires_at: minutesAgo(i * 17 - 60),
    sent_at: status === "accepted" ? null : minutesAgo(i * 17 + 1),
    delivered_at: status === "delivered" ? minutesAgo(i * 17) : null,
    idempotency_key: `sample-key-${i}`,
    callbacks,
    attempt_log: Array.from({ length: status === "failed" ? 2 : 1 }, (_, n) => ({
      attempt_no: n + 1,
      started_at: created,
      finished_at: status === "accepted" ? null : created,
      outcome: status === "accepted" ? null : n === 0 && status === "failed" ? "retry" : "ok",
      provider_status: status === "accepted" ? null : "ACCEPTED",
      failure_code: null,
      units: 1,
    })),
  }
}

const ALL = Array.from({ length: 24 }, (_, i) => sample(i))

export function mockMessages(params: URLSearchParams): MessagePage {
  const limit = Number(params.get("limit")) || 50
  const offset = Number(params.get("cursor")) || 0
  const prefix = params.get("source_reference")
  const filtered = ALL.filter(
    m =>
      (!params.get("channel") || m.channel === params.get("channel")) &&
      (!params.get("status") || m.status === params.get("status")) &&
      (!params.get("caller") || m.caller_id === params.get("caller")) &&
      (!params.get("purpose") || m.purpose === params.get("purpose")) &&
      (!prefix || (m.source_reference ?? "").startsWith(prefix)),
  )
  const items = filtered.slice(offset, offset + limit)
  const next = offset + limit < filtered.length ? String(offset + limit) : undefined
  return { items, ...(next ? { next_cursor: next } : {}) }
}
