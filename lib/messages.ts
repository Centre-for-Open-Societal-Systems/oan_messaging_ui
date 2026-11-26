// Shapes of GET /api/v1/messages (oan_messaging_service docs/openapi.yaml).
// Shared by the BFF and the UI; nothing here is secret. Message text is never
// part of the API, so it is not part of these types either.

export const CHANNELS = ["sms", "telegram"] as const
export const STATUSES = ["accepted", "sending", "sent", "delivered", "failed", "expired", "unknown"] as const

export type Channel = (typeof CHANNELS)[number]
export type MessageStatus = (typeof STATUSES)[number]

export interface Callback {
  id: string
  provider: string
  raw_status: string
  disposition: string
  event_time: string | null
  received_at: string
}

export interface AttemptLogEntry {
  attempt_no: number
  started_at: string
  finished_at?: string | null
  outcome?: string | null
  provider_status?: string | null
  failure_code?: string | null
  units: number
}

export interface MessageItem {
  id: string
  caller_id: string
  channel: Channel
  purpose: string
  source_reference: string | null
  status: MessageStatus
  final: boolean
  failure_code?: string | null
  provider_status?: string | null
  recipient_masked: string
  delivery_receipts_supported: boolean
  attempts: number
  created_at: string
  updated_at: string
  expires_at?: string | null
  sent_at?: string | null
  delivered_at?: string | null
  idempotency_key: string
  callbacks: Callback[]
  attempt_log: AttemptLogEntry[]
}

export interface MessagePage {
  items: MessageItem[]
  next_cursor?: string | null
}
