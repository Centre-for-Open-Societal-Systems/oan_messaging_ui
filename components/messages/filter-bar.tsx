"use client"

import { useState } from "react"
import { RotateCcw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CHANNELS, STATUSES } from "@/lib/messages"
import { NO_FILTERS, type Filters } from "./use-messages"

const FIELD =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-[8rem] flex-1 flex-col gap-0.5">
      <span className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{label}</span>
      {children}
    </label>
  )
}

/** Edits a draft; the list only changes when Apply is pressed. */
export function FilterBar({ applied, onApply }: { applied: Filters; onApply: (filters: Filters) => void }) {
  const [draft, setDraft] = useState<Filters>(applied)
  const set = (key: keyof Filters) => (value: string) => setDraft(prev => ({ ...prev, [key]: value }))

  return (
    <form
      role="search"
      aria-label="Filter messages"
      className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-white/70 px-4 py-2"
      onSubmit={e => {
        e.preventDefault()
        onApply(draft)
      }}
    >
      <Field label="Channel">
        <select className={FIELD} value={draft.channel} onChange={e => set("channel")(e.target.value)}>
          <option value="">All</option>
          {CHANNELS.map(c => (
            <option key={c} value={c}>
              {c === "sms" ? "SMS" : "Telegram"}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Status">
        <select className={FIELD} value={draft.status} onChange={e => set("status")(e.target.value)}>
          <option value="">All</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Caller">
        <input className={FIELD} value={draft.caller} onChange={e => set("caller")(e.target.value)} placeholder="exact id" />
      </Field>
      <Field label="Purpose">
        <input className={FIELD} value={draft.purpose} onChange={e => set("purpose")(e.target.value)} placeholder="exact" />
      </Field>
      <Field label="Source reference">
        <input
          className={FIELD}
          value={draft.source_reference}
          onChange={e => set("source_reference")(e.target.value)}
          placeholder="starts with"
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          <Search aria-hidden /> Apply
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(NO_FILTERS)
            onApply(NO_FILTERS)
          }}
        >
          <RotateCcw aria-hidden /> Reset
        </Button>
      </div>
    </form>
  )
}
