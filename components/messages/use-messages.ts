"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { MessageItem, MessagePage } from "@/lib/messages"

export interface Filters {
  channel: string
  status: string
  caller: string
  purpose: string
  source_reference: string
}

export const NO_FILTERS: Filters = { channel: "", status: "", caller: "", purpose: "", source_reference: "" }

export const REFRESH_MS = 15_000
const PAGE_SIZE = 50

function toQuery(filters: Filters, cursor?: string): string {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
  for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim())
  if (cursor) params.set("cursor", cursor)
  return params.toString()
}

async function request(query: string): Promise<MessagePage> {
  let res: Response
  try {
    res = await fetch(`/api/messages?${query}`, { cache: "no-store", headers: { Accept: "application/json" } })
  } catch {
    throw new Error("Could not reach the console server. Check your connection and try again.")
  }
  if (res.status === 401) throw new Error("Your session has ended. Reload the page to sign in again.")
  if (res.status === 403) throw new Error("Your account is not allowed to view messages.")
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(`${body?.error ?? "The message list could not be loaded."} (HTTP ${res.status})`)
  }
  return (await res.json()) as MessagePage
}

/** Messages newest first for the applied filters; pages append, refresh reloads the first page. */
export function useMessages(filters: Filters, autoRefresh: boolean) {
  const [items, setItems] = useState<MessageItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [tick, setTick] = useState(0)
  const latest = useRef(0)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  // Reload the first page when the filters change, on Refresh and on each auto-refresh tick.
  useEffect(() => {
    const id = ++latest.current
    request(toQuery(filters))
      .then(page => {
        if (id !== latest.current) return
        setItems(page.items)
        setNextCursor(page.next_cursor ?? null)
        setError(null)
        setUpdatedAt(Date.now())
      })
      .catch((e: Error) => id === latest.current && setError(e.message))
      .finally(() => id === latest.current && setLoading(false))
  }, [filters, tick])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(timer)
  }, [autoRefresh, refresh])

  const loadMore = useCallback(async () => {
    if (!nextCursor) return
    const id = latest.current
    setLoadingMore(true)
    try {
      const page = await request(toQuery(filters, nextCursor))
      if (id !== latest.current) return
      setItems(prev => {
        const seen = new Set(prev.map(m => m.id))
        return [...prev, ...page.items.filter(m => !seen.has(m.id))]
      })
      setNextCursor(page.next_cursor ?? null)
      setError(null)
    } catch (e) {
      if (id === latest.current) setError((e as Error).message)
    } finally {
      setLoadingMore(false)
    }
  }, [filters, nextCursor])

  return { items, hasMore: nextCursor !== null, loading, loadingMore, error, updatedAt, refresh, loadMore }
}
