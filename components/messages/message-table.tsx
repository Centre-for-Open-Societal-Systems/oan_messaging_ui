"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { MessageItem } from "@/lib/messages"
import { ChannelBadge, StatusBadge } from "./badges"
import { formatLocal, formatRelative } from "./format"

const HEADS = ["Created", "Channel", "Status", "Caller", "Purpose", "Source reference", "Recipient", "Attempts", "Callbacks"]

function CallbackSummary({ message }: { message: MessageItem }) {
  if (message.callbacks.length === 0) {
    return (
      <span className="text-slate-500">
        {message.delivery_receipts_supported ? "none yet" : "n/a (Telegram has no delivery receipts)"}
      </span>
    )
  }
  const latest = [...message.callbacks].sort((a, b) => b.received_at.localeCompare(a.received_at))[0]
  return (
    <span>
      {message.callbacks.length} <span className="text-slate-500">latest</span>{" "}
      <code className="rounded bg-slate-100 px-1 text-[12px]">{latest.raw_status}</code>
    </span>
  )
}

export function MessageTable({ items, onOpen }: { items: MessageItem[]; onOpen: (message: MessageItem) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-slate-200">
          {HEADS.map(h => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(m => (
          <TableRow key={m.id} className="hover:bg-emerald-50/50">
            <TableCell className="whitespace-nowrap">
              <button
                type="button"
                className="text-left font-medium text-emerald-800 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                onClick={() => onOpen(m)}
                aria-label={`Open message created ${formatLocal(m.created_at)}`}
              >
                {formatLocal(m.created_at)}
              </button>
              <div className="text-[11px] text-slate-500">{formatRelative(m.created_at)}</div>
            </TableCell>
            <TableCell>
              <ChannelBadge channel={m.channel} />
            </TableCell>
            <TableCell>
              <StatusBadge status={m.status} />
            </TableCell>
            <TableCell>{m.caller_id}</TableCell>
            <TableCell>{m.purpose}</TableCell>
            <TableCell className="max-w-[16rem] truncate" title={m.source_reference ?? undefined}>
              {m.source_reference ?? "-"}
            </TableCell>
            <TableCell className="font-mono text-[12px] whitespace-nowrap">{m.recipient_masked}</TableCell>
            <TableCell>{m.attempts}</TableCell>
            <TableCell>
              <CallbackSummary message={m} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function TableSkeleton() {
  return (
    <div className="space-y-2 p-3" role="status" aria-label="Loading messages">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}
