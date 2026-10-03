/**
 * Print-agent credential helpers. Server-only: never import from client code.
 * Agent tokens are stored as SHA-256 hashes; the plaintext is shown once at issue time.
 */

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return [...buffer].map((byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 48);
}

export function agentTokenPrefix(token: string): string {
  return token.slice(0, 6);
}

/** Resolves an `Authorization: Bearer <agent token>` header to its agent device row. */
export async function authenticateAgent(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tokenHash = await hashToken(token);
  const { data } = await supabaseAdmin
    .from("agent_devices")
    .select("id, station_id, printer_id, name, revoked")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!data || data.revoked) return null;
  return data;
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
