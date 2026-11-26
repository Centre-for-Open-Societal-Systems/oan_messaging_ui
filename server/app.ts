// The console's own API (backend-for-frontend), mounted under /api by
// app/api/[[...slugs]]/route.ts. Every route except /health sits behind the
// session check in proxy.ts.
//
//   GET /api/health    liveness + whether the messaging API answers
//   GET /api/me        the signed-in user (for the header)
//   GET /api/messages  the message list; see server/messages-query.ts for the
//                      accepted filters. Forwarded with the server-held
//                      reader token; metadata only, never message text.
import { Elysia } from "elysia"
import { cookies } from "next/headers"
import { checkSession } from "./auth/session"
import { config } from "./config"
import { fetchMessages, pingMessagingApi } from "./messaging-api"
import { buildMessagesQuery } from "./messages-query"

const NO_STORE = "no-store"

export function createApp(prefix = "/api") {
  return new Elysia({ prefix })
    .get("/health", async ({ set }) => {
      set.headers["cache-control"] = NO_STORE
      const reachable = await pingMessagingApi()
      return { status: reachable ? "ok" : "degraded", messagingApi: reachable ? "reachable" : "unreachable" }
    })

    .get("/me", async ({ set }) => {
      set.headers["cache-control"] = NO_STORE
      const session = await checkSession(await cookies())
      if (session.kind !== "ok") {
        set.status = 401
        return { error: "Not signed in" }
      }
      return { name: session.user.name, links: { staffPortal: config.staffPortalUrl || null } }
    })

    .get("/messages", async ({ query, set }) => {
      set.headers["cache-control"] = NO_STORE
      const built = buildMessagesQuery(query as Record<string, unknown>)
      if (!built.ok) {
        set.status = 400
        return { error: built.error }
      }
      const result = await fetchMessages(built.params)
      if (!result.ok) {
        console.error(`[messages] upstream failure (HTTP ${result.status}): ${result.message}`)
        set.status = result.status
        return { error: result.message }
      }
      return result.page
    })
}
