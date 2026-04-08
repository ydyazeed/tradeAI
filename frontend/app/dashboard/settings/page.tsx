"use client";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button className="btn-ghost btn" onClick={copy} style={{ fontSize: 10, padding: "3px 8px" }}>
      {copied ? "✓ COPIED" : "COPY"}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div style={{ position: "relative", background: "var(--bg-primary)", border: "1px solid var(--border)", padding: "12px 14px", marginTop: 6 }}>
      <pre style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", overflowX: "auto", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {code}
      </pre>
      <div style={{ position: "absolute", top: 8, right: 8 }}>
        <CopyButton text={code} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyCreated, setNewKeyCreated] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"keys" | "docs">("keys");

  useEffect(() => {
    api.auth.me().then(setUser);
    api.auth.listApiKeys().then(setApiKeys);
  }, []);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName) return;
    setLoading(true);
    setMsg("");
    try {
      const key = await api.auth.createApiKey(newKeyName, ["read"]);
      setNewKeyCreated(key);
      setNewKeyName("");
      const keys = await api.auth.listApiKeys();
      setApiKeys(keys);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this API key? Any apps using it will stop working.")) return;
    await api.auth.revokeApiKey(id);
    const keys = await api.auth.listApiKeys();
    setApiKeys(keys);
  }

  const exampleKey = newKeyCreated?.key || apiKeys[0] ? "sk-YOUR_API_KEY" : "sk-YOUR_API_KEY";
  const keyForDocs = newKeyCreated?.key || "sk-YOUR_API_KEY";

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.15em" }}>DASHBOARD</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>SETTINGS</h1>
      </div>

      {/* Profile */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em" }}>01  PROFILE</span>
        </div>
        <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, fontSize: 13 }}>
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 4 }}>EMAIL</div>
            <div>{user?.email || "—"}</div>
          </div>
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 4 }}>ROLE</div>
            <div style={{ color: user?.role === "admin" ? "var(--signal-hold)" : "var(--text-secondary)" }}>
              {user?.role?.toUpperCase() || "—"}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 4 }}>API DOCS</div>
            <a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer"
              style={{ color: "var(--text-secondary)", fontSize: 13, textDecoration: "none" }}>
              {API_BASE}/docs →
            </a>
          </div>
        </div>
      </div>

      {/* API Keys section */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em" }}>02  API KEYS</span>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            {[{ id: "keys", label: "MY KEYS" }, { id: "docs", label: "HOW TO USE" }].map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)} style={{
                padding: "4px 14px", fontSize: 11, fontFamily: "inherit", letterSpacing: "0.05em",
                background: activeTab === t.id ? "var(--bg-tertiary)" : "transparent",
                color: activeTab === t.id ? "var(--text-primary)" : "var(--text-muted)",
                border: "1px solid var(--border)",
                borderLeft: t.id === "docs" ? "none" : "1px solid var(--border)",
                cursor: "pointer",
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {activeTab === "keys" && (
          <>
            {/* What is an API key */}
            <div style={{ padding: "12px 14px", background: "var(--bg-tertiary)", marginBottom: 16, fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)" }}>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>What is an API key?</span>
              {" "}API keys let you access TradeAI signals programmatically — from your own scripts, trading bots, or apps — without logging in every time. Each key has <span style={{ color: "var(--signal-hold)" }}>read</span> scope, meaning it can fetch signals, market data, and indicators but cannot modify anything.
            </div>

            {/* New key reveal */}
            {newKeyCreated && (
              <div style={{ padding: "14px", background: "#052e16", border: "1px solid var(--signal-buy)", marginBottom: 16 }}>
                <div style={{ color: "var(--signal-buy)", fontWeight: 700, fontSize: 12, marginBottom: 8 }}>
                  ⚠ SAVE THIS KEY NOW — it will not be shown again
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg-primary)", padding: "10px 12px", border: "1px solid var(--border)" }}>
                  <code style={{ flex: 1, fontSize: 12, color: "var(--text-primary)", wordBreak: "break-all" }}>{newKeyCreated.key}</code>
                  <CopyButton text={newKeyCreated.key} />
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)" }}>
                  Use this in the <code style={{ color: "var(--signal-hold)" }}>X-API-Key</code> header. See the <button onClick={() => setActiveTab("docs")} style={{ background: "none", border: "none", color: "var(--signal-buy)", cursor: "pointer", fontFamily: "inherit", fontSize: 12, padding: 0, textDecoration: "underline" }}>How to Use</button> tab for examples.
                </div>
                <div style={{ marginTop: 10 }}>
                  <button className="btn-ghost btn" onClick={() => setNewKeyCreated(null)} style={{ fontSize: 11 }}>DISMISS</button>
                </div>
              </div>
            )}

            {/* Create form */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 8 }}>CREATE NEW KEY</div>
              <form onSubmit={createKey} style={{ display: "flex", gap: 10 }}>
                <input className="input" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Give it a name, e.g. my-trading-bot" style={{ maxWidth: 320 }} required />
                <button className="btn" type="submit" disabled={loading}>{loading ? "CREATING..." : "CREATE KEY"}</button>
              </form>
              {msg && <div style={{ color: "var(--signal-sell)", fontSize: 12, marginTop: 8 }}>{msg}</div>}
            </div>

            {/* Keys table */}
            {apiKeys.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0" }}>No API keys yet. Create one above.</div>
            ) : (
              <table>
                <thead>
                  <tr><th>NAME</th><th>SCOPE</th><th>CREATED</th><th>STATUS</th><th></th></tr>
                </thead>
                <tbody>
                  {apiKeys.map((k: any) => (
                    <tr key={k.id}>
                      <td style={{ fontWeight: 500 }}>{k.name}</td>
                      <td>
                        <span style={{ fontSize: 11, color: "var(--signal-hold)", border: "1px solid var(--signal-hold)", padding: "2px 6px" }}>
                          {k.scopes.join(", ")}
                        </span>
                      </td>
                      <td className="tabular" style={{ color: "var(--text-muted)", fontSize: 12 }}>{k.created_at?.slice(0, 10)}</td>
                      <td>
                        <span style={{ fontSize: 11, color: k.is_active ? "var(--signal-buy)" : "var(--text-muted)" }}>
                          ● {k.is_active ? "ACTIVE" : "REVOKED"}
                        </span>
                      </td>
                      <td>
                        <button className="btn-ghost btn" onClick={() => revokeKey(k.id)}
                          style={{ fontSize: 11, color: "var(--signal-sell)", borderColor: "var(--signal-sell)" }}>
                          REVOKE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {activeTab === "docs" && (
          <div style={{ fontSize: 13 }}>
            {/* Why use the API */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 8, letterSpacing: "0.1em" }}>WHY USE THE API?</div>
              <div style={{ color: "var(--text-secondary)", lineHeight: 1.8 }}>
                The TradeAI API lets you pull signals, prices, and indicators into your own apps — trading bots, spreadsheets, Python scripts, or mobile apps — without using this dashboard. You authenticate with an API key instead of email/password.
              </div>
            </div>

            {/* Quick start */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 8, letterSpacing: "0.1em" }}>QUICK START — CURL</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 6 }}>1. Get the latest AI signal for a stock:</div>
              <CodeBlock code={`curl -H "X-API-Key: ${keyForDocs}" \\
  ${API_BASE}/api/v1/signals/AAPL`} />
              <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 14, marginBottom: 6 }}>2. Get the latest price:</div>
              <CodeBlock code={`curl -H "X-API-Key: ${keyForDocs}" \\
  ${API_BASE}/api/v1/market-data/AAPL/latest`} />
              <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 14, marginBottom: 6 }}>3. Get technical indicators:</div>
              <CodeBlock code={`curl -H "X-API-Key: ${keyForDocs}" \\
  ${API_BASE}/api/v1/indicators/AAPL`} />
            </div>

            {/* Python */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 8, letterSpacing: "0.1em" }}>PYTHON EXAMPLE</div>
              <CodeBlock code={`import requests

API_KEY = "${keyForDocs}"
BASE = "${API_BASE}"
HEADERS = {"X-API-Key": API_KEY}

# Get signal for AAPL
resp = requests.get(f"{BASE}/api/v1/signals/AAPL", headers=HEADERS)
signal = resp.json()["data"]

print(signal["direction"])    # BUY / SELL / HOLD
print(signal["confidence"])   # 0.0 – 1.0
print(signal["reasoning"])    # Claude's explanation

# Timeframe breakdown
ta = signal["risk_params"]["timeframe_analysis"]
print(ta["intraday"]["direction"])   # intraday
print(ta["swing"]["direction"])      # 3-10 days
print(ta["long_term"]["direction"])  # 4-12 weeks`} />
            </div>

            {/* Available endpoints */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 10, letterSpacing: "0.1em" }}>AVAILABLE ENDPOINTS (READ SCOPE)</div>
              <table>
                <thead><tr><th>METHOD</th><th>PATH</th><th>DESCRIPTION</th></tr></thead>
                <tbody>
                  {[
                    ["GET", "/api/v1/signals/{symbol}", "Latest AI signal"],
                    ["GET", "/api/v1/signals/{symbol}/history", "Signal history (paginated)"],
                    ["GET", "/api/v1/market-data/{symbol}", "OHLCV data"],
                    ["GET", "/api/v1/market-data/{symbol}/latest", "Latest price"],
                    ["GET", "/api/v1/market-data/symbols", "All tracked symbols"],
                    ["GET", "/api/v1/indicators/{symbol}", "Technical indicators"],
                    ["GET", "/health", "System health (no auth needed)"],
                  ].map(([method, path, desc]) => (
                    <tr key={path as string}>
                      <td style={{ color: "var(--signal-hold)", fontSize: 11, fontWeight: 600 }}>{method}</td>
                      <td><code style={{ fontSize: 12 }}>{path}</code></td>
                      <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Interactive docs link */}
            <div style={{ padding: "12px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>INTERACTIVE API EXPLORER</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Try every endpoint in your browser with live responses</div>
              </div>
              <a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer" className="btn" style={{ textDecoration: "none", fontSize: 11 }}>
                OPEN DOCS →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
