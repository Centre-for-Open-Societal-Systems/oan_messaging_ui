// Display helpers. Times arrive as ISO strings (UTC) and are shown in the
// local time zone of the person looking at them.

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

export function formatLocal(value: string | null | undefined): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })
}

export function formatRelative(value: string | null | undefined, now = Date.now()): string {
  if (!value) return ""
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return ""
  const seconds = Math.round((time - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return rtf.format(seconds, "second")
  if (abs < 45 * 60) return rtf.format(Math.round(seconds / 60), "minute")
  if (abs < 22 * 3600) return rtf.format(Math.round(seconds / 3600), "hour")
  if (abs < 26 * 86400) return rtf.format(Math.round(seconds / 86400), "day")
  return rtf.format(Math.round(seconds / (30 * 86400)), "month")
}
