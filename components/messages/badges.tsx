import { Badge } from "@/components/ui/badge"
import type { Channel, MessageStatus } from "@/lib/messages"

const STATUS_TONE: Record<MessageStatus, "green" | "blue" | "neutral" | "amber" | "red"> = {
  delivered: "green",
  sent: "blue",
  accepted: "neutral",
  sending: "amber",
  failed: "red",
  expired: "red",
  unknown: "amber",
}

export function StatusBadge({ status }: { status: MessageStatus }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status}</Badge>
}

export function ChannelBadge({ channel }: { channel: Channel }) {
  return <Badge tone={channel === "sms" ? "neutral" : "blue"}>{channel === "sms" ? "SMS" : "Telegram"}</Badge>
}
