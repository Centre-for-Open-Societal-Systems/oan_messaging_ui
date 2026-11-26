"use client"

import { useState } from "react"
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { MessageItem } from "@/lib/messages"
import { ConsoleHeader } from "./console-header"
import { FilterBar } from "./filter-bar"
import { MessageDetail } from "./message-detail"
import { MessageTable, TableSkeleton } from "./message-table"
import { NO_FILTERS, REFRESH_MS, useMessages, type Filters } from "./use-messages"

/** The page body: header, filters, the message list and the detail dialog. */
export function MessagesConsole() {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [open, setOpen] = useState<MessageItem | null>(null)
  const { items, hasMore, loading, loadingMore, error, updatedAt, refresh, loadMore } = useMessages(filters, autoRefresh)

  return (
    <div className="flex h-dvh flex-col bg-[#F5F8F6]">
      <ConsoleHeader />
      <FilterBar applied={filters} onApply={setFilters} />

      <div className="flex flex-none flex-wrap items-center gap-3 px-4 py-2 text-[13px]">
        <Button type="button" size="sm" variant="outline" onClick={refresh}>
          <RefreshCw aria-hidden /> Refresh
        </Button>
        <label className="flex items-center gap-1.5 text-slate-700">
          <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
          Auto-refresh every {REFRESH_MS / 1000} s
        </label>
        <span className="ml-auto text-[12px] text-slate-500" aria-live="polite">
          {updatedAt ? `${items.length} loaded, updated ${new Date(updatedAt).toLocaleTimeString()}` : ""}
        </span>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {error && (
          <div role="alert" className="mb-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
            <span>{error}</span>
          </div>
        )}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <TableSkeleton />
          ) : items.length === 0 && !error ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-slate-500">
              <Inbox className="h-6 w-6" aria-hidden />
              <p className="text-sm">No messages match these filters.</p>
            </div>
          ) : (
            <MessageTable items={items} onOpen={setOpen} />
          )}
        </div>
        {hasMore && (
          <div className="mt-3 flex justify-center">
            <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading..." : "Load more"}
            </Button>
          </div>
        )}
      </main>

      <MessageDetail message={open} onClose={() => setOpen(null)} />
    </div>
  )
}
