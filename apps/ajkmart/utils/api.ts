const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (!domain) {
  console.error(
    "[API] FATAL: EXPO_PUBLIC_DOMAIN is not set. All API calls will fail. " +
    "Set this environment variable to your Replit dev domain before building."
  );
}
export const API_BASE = domain ? `https://${domain}/api` : "";
export const SOCKET_BASE = domain ? `https://${domain}` : "";

export function unwrapApiResponse<T>(json: unknown): T {
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if ("data" in obj) return obj.data as T;
    if ("success" in obj && typeof obj.success === "boolean") return json as T;
  }
  return json as T;
}

export async function apiPost(
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}
