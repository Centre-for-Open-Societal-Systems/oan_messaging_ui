"use client"

import { useEffect, useState } from "react"
import { ExternalLink, LogOut, MessageSquare, UserRound } from "lucide-react"

type Me = { name: string; links: { staffPortal: string | null } }

const LINK = "flex items-center gap-1 rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100"

export function ConsoleHeader() {
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then(res => (res.ok ? (res.json() as Promise<Me>) : null))
      .then(setMe)
      .catch(() => setMe(null))
  }, [])

  return (
    <header className="flex flex-none flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
      <MessageSquare className="h-5 w-5 text-emerald-700" aria-hidden />
      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold text-slate-900">OAN Messaging</h1>
        <p className="truncate text-[11px] text-slate-500">Messages sent through the messaging service, with their callbacks</p>
      </div>
      <nav aria-label="Account" className="ml-auto flex items-center gap-1 text-[13px]">
        {me?.links.staffPortal && (
          <a className={LINK} href={me.links.staffPortal}>
            Staff portal <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
        {me && (
          <span className="ml-2 flex items-center gap-1 text-slate-700">
            <UserRound className="h-4 w-4" aria-hidden /> {me.name}
          </span>
        )}
        {/* A route handler, not a page: it needs a full navigation, not <Link>. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className={`${LINK} ml-1`} href="/api/auth/logout">
          <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
        </a>
      </nav>
    </header>
  )
}
