const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const json = await res.json();

  if (!res.ok || json.status === "error") {
    throw new Error(json?.error?.message || "Request failed");
  }
  return json.data;
}

export const api = {
  auth: {
    register: (email: string, password: string) =>
      request("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ access_token: string; refresh_token: string }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<{ email: string; role: string; id: string }>("/api/v1/auth/me"),
    createApiKey: (name: string, scopes: string[]) =>
      request("/api/v1/auth/api-keys", {
        method: "POST",
        body: JSON.stringify({ name, scopes }),
      }),
    listApiKeys: () => request<any[]>("/api/v1/auth/api-keys"),
    revokeApiKey: (id: string) =>
      request(`/api/v1/auth/api-keys/${id}`, { method: "DELETE" }),
  },
  marketData: {
    symbols: () => request<any[]>("/api/v1/market-data/symbols"),
    ohlcv: (symbol: string, limit = 30) =>
      request<any[]>(`/api/v1/market-data/${symbol}?limit=${limit}`),
    latest: (symbol: string) =>
      request<any>(`/api/v1/market-data/${symbol}/latest`),
    fetch: (symbol: string) =>
      request(`/api/v1/market-data/${symbol}/fetch`, { method: "POST" }),
    addSymbol: (symbol: string, name: string) =>
      request("/api/v1/market-data/symbols", {
        method: "POST",
        body: JSON.stringify({ symbol, name }),
      }),
    removeSymbol: (symbol: string) =>
      request(`/api/v1/market-data/symbols/${symbol}`, { method: "DELETE" }),
  },
  indicators: {
    get: (symbol: string) => request<any>(`/api/v1/indicators/${symbol}`),
    compute: (symbol: string) =>
      request(`/api/v1/indicators/${symbol}/compute`, { method: "POST" }),
  },
  signals: {
    latest: (symbol: string) => request<any>(`/api/v1/signals/${symbol}`),
    history: (symbol: string, page = 1) =>
      request<any[]>(`/api/v1/signals/${symbol}/history?page=${page}`),
    generate: (symbol: string) =>
      request(`/api/v1/signals/${symbol}/generate`, { method: "POST" }),
  },
  audit: {
    logs: (page = 1) => request<any>(`/api/v1/audit/logs?page=${page}`),
    signals: (page = 1) => request<any[]>(`/api/v1/audit/signals?page=${page}`),
    userStats: () => request<any[]>("/api/v1/audit/user-stats"),
  },
  health: () => fetch(`${BASE}/health`).then((r) => r.json()),
};
