"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { MessageItem } from "@/lib/messages"
import { ChannelBadge, StatusBadge } from "./badges"
import { formatLocal } from "./format"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-1 text-[13px]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-slate-900">{children}</dd>
    </div>
  )
}

const dash = (v: string | null | undefined) => v || "-"

function Callbacks({ message }: { message: MessageItem }) {
  if (message.callbacks.length === 0) {
    return (
      <p className="text-[13px] text-slate-500">
        {message.delivery_receipts_supported
          ? "No callback has been received for this message."
          : "n/a (Telegram has no delivery receipts)"}
      </p>
    )
  }
  const ordered = [...message.callbacks].sort((a, b) => a.received_at.localeCompare(b.received_at))
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {["Raw status", "Disposition", "Provider", "Event time", "Received at"].map(h => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {ordered.map(c => (
          <TableRow key={c.id}>
            <TableCell className="font-mono text-[12px]">{c.raw_status}</TableCell>
            <TableCell>{c.disposition}</TableCell>
            <TableCell>{c.provider}</TableCell>
            <TableCell className="whitespace-nowrap">{formatLocal(c.event_time)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatLocal(c.received_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function Attempts({ message }: { message: MessageItem }) {
  if (message.attempt_log.length === 0) return <p className="text-[13px] text-slate-500">No provider attempt yet.</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {["#", "Started", "Finished", "Outcome", "Provider status", "Failure code", "Units"].map(h => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {message.attempt_log.map(a => (
          <TableRow key={a.attempt_no}>
            <TableCell>{a.attempt_no}</TableCell>
            <TableCell className="whitespace-nowrap">{formatLocal(a.started_at)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatLocal(a.finished_at)}</TableCell>
            <TableCell>{dash(a.outcome)}</TableCell>
            <TableCell className="font-mono text-[12px]">{dash(a.provider_status)}</TableCell>
            <TableCell>{dash(a.failure_code)}</TableCell>
            <TableCell>{a.units}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function MessageDetail({ message, onClose }: { message: MessageItem | null; onClose: () => void }) {
  return (
    <Dialog open={message !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        {message && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                Message <StatusBadge status={message.status} /> <ChannelBadge channel={message.channel} />
              </DialogTitle>
              <DialogDescription className="font-mono text-[12px] break-all">{message.id}</DialogDescription>
            </DialogHeader>
            <p className="rounded-md bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
              Only message metadata is shown. The message text is not stored by the messaging service and is not available here.
            </p>
            <dl className="divide-y divide-slate-100">
              <Row label="Caller">{message.caller_id}</Row>
              <Row label="Purpose">{message.purpose}</Row>
              <Row label="Source reference">{dash(message.source_reference)}</Row>
              <Row label="Recipient">{message.recipient_masked}</Row>
              <Row label="Final">{message.final ? "yes" : "no"}</Row>
              <Row label="Failure code">{dash(message.failure_code)}</Row>
              <Row label="Provider status">{dash(message.provider_status)}</Row>
              <Row label="Delivery receipts">{message.delivery_receipts_supported ? "supported" : "not supported (Telegram)"}</Row>
              <Row label="Attempts">{message.attempts}</Row>
              <Row label="Created">{formatLocal(message.created_at)}</Row>
              <Row label="Updated">{formatLocal(message.updated_at)}</Row>
              <Row label="Sent">{formatLocal(message.sent_at)}</Row>
              <Row label="Delivered">{formatLocal(message.delivered_at)}</Row>
              <Row label="Expires">{formatLocal(message.expires_at)}</Row>
              <Row label="Idempotency key">
                <span className="font-mono text-[12px]">{message.idempotency_key}</span>
              </Row>
            </dl>
            <section aria-labelledby="callbacks-heading">
              <h3 id="callbacks-heading" className="mb-1 text-sm font-semibold text-slate-900">
                Callbacks ({message.callbacks.length})
              </h3>
              <Callbacks message={message} />
            </section>
            <section aria-labelledby="attempts-heading">
              <h3 id="attempts-heading" className="mb-1 text-sm font-semibold text-slate-900">
                Provider attempts ({message.attempt_log.length})
              </h3>
              <Attempts message={message} />
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
