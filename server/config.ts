// Server-side settings, read from the environment once per process.
// Everything that differs between environments lives here, so the rest of the
// code never reads process.env directly. See .env.example for the full list.

function optional(name: string, fallback: string): string {
  const value = process.env[name]?.trim()
  return value ? value : fallback
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not set`)
  return value
}

function flag(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase()
  if (!value) return fallback
  return !["0", "false", "no", "off"].includes(value)
}

const trimSlash = (value: string) => value.replace(/\/+$/, "")

const authEnabled = flag("AUTH_ENABLED", true)
/** Built-in fake messaging API for UI work; refused unless auth is off and not in production. */
const apiMock = flag("MESSAGING_API_MOCK", false) && !authEnabled && process.env.NODE_ENV !== "production"

export const config = {
  messagingApi: {
    /** Serve the built-in sample data instead of calling the service. */
    mock: apiMock,
    /** Base URL of oan_messaging_service (cluster-internal). */
    get url() {
      return apiMock ? "" : trimSlash(required("MESSAGING_API_URL"))
    },
    /** Reader token of this console; held on the server only, never sent to a browser. */
    get token() {
      return apiMock ? "" : required("MESSAGING_API_TOKEN")
    },
  },

  auth: {
    /** Off only for local UI work; every route is open when false. */
    enabled: authEnabled,
    /** The registry's IAM (staff portal API), browser-reachable. */
    get iamUrl() {
      return trimSlash(required("IAM_URL"))
    },
    /** IAM login provider; empty: discovered (server/auth/login-provider.ts). */
    loginProviderId: optional("LOGIN_PROVIDER_ID", ""),
    /** Keycloak client (= IAM application mnemonic) holding the access role. */
    clientId: optional("MESSAGING_CLIENT_ID", "oan-messaging-ui"),
    /** Client role that grants access to this console. */
    role: optional("MESSAGING_ROLE", "Messaging Viewer"),
    /** Domain IAM scopes its session cookies to; logout clears them there. */
    cookieDomain: optional("COOKIE_DOMAIN", ""),
    /**
     * Keycloak's end-session endpoint and IAM's client id. Used to end the
     * Keycloak session when IAM cannot (expired session); empty skips it.
     */
    oidcLogoutUrl: optional("OIDC_LOGOUT_URL", ""),
    oidcClientId: optional("OIDC_CLIENT_ID", ""),
    /** How long a validated session is trusted before IAM is asked again. */
    sessionTtlMs: Math.max(5, Number(process.env.SESSION_CACHE_SECONDS) || 60) * 1000,
  },

  /** Public origin of this console, used to build login return URLs. */
  get publicUrl() {
    return trimSlash(required("PUBLIC_URL"))
  },
  /** Link shown in the header; empty hides it. */
  staffPortalUrl: trimSlash(optional("STAFF_PORTAL_URL", "")),
}
