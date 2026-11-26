import { MessagesConsole } from "@/components/messages/messages-console"

// Rendered per request: the proxy has already checked the session.
export const dynamic = "force-dynamic"

export default function Page() {
  return <MessagesConsole />
}
