"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";

export default function AuditPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "signals" | "requests">("users");
  const [userStats, setUserStats] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [signalAudits, setSignalAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    // Redirect non-admins
    api.auth.me().then((u: any) => {
      if (u.role !== "admin") router.push("/dashboard/overview");
    }).catch(() => router.push("/login"));

    async function load() {
      try {
        const [stats, l, s] = await Promise.all([
          api.audit.userStats(),
          api.audit.logs(),
          api.audit.signals(),
        ]);
        setUserStats(Array.isArray(stats) ? stats : []);
        setLogs(Array.isArray(l) ? l : (l as any).data || []);
        setSignalAudits(Array.isArray(s) ? s : (s as any).data || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredLogs = selectedUser
    ? logs.filter((l: any) => l.user_id === selectedUser)
    : logs;

  const totalTokensIn = userStats.reduce((s, u) => s + (u.tokens?.input || 0), 0);
  const totalTokensOut = userStats.reduce((s, u) => s + (u.tokens?.output || 0), 0);
  const totalCost = userStats.reduce((s, u) => s + (u.tokens?.cost_usd || 0), 0);
  const totalRequests = userStats.reduce((s, u) => s + (u.requests?.total || 0), 0);

  if (loading) return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading audit data<span className="cursor" /></div>;
  if (error) return <div style={{ color: "var(--signal-sell)", padding: 16 }}>Access denied or error: {error}</div>;

  const TABS = [
    { id: "users", label: "USER OVERVIEW" },
    { id: "signals", label: "SIGNAL AUDIT" },
    { id: "requests", label: "REQUEST LOG" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.15em" }}>ADMIN</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>AUDIT LOG</h1>
      </div>

      {/* Platform summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "TOTAL USERS", value: userStats.length },
          { label: "TOTAL REQUESTS", value: totalRequests.toLocaleString() },
          { label: "TOKENS USED", value: (totalTokensIn + totalTokensOut).toLocaleString() },
          { label: "TOTAL AI COST", value: `$${totalCost.toFixed(4)}` },
        ].map((stat) => (
          <div key={stat.label} className="card" style={{ padding: "12px 16px" }}>
            <div style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.1em", marginBottom: 6 }}>{stat.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            padding: "10px 20px", fontSize: 11, fontFamily: "inherit", letterSpacing: "0.08em",
            background: tab === t.id ? "var(--bg-secondary)" : "transparent",
            color: tab === t.id ? "var(--text-primary)" : "var(--text-muted)",
            border: "none",
            borderBottom: tab === t.id ? "2px solid var(--text-primary)" : "2px solid transparent",
            cursor: "pointer",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* USER OVERVIEW TAB */}
      {tab === "users" && (
        <div>
          {userStats.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No users found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {userStats.map((u: any) => (
                <div key={u.user_id} className="card">
                  {/* User header */}
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto auto", gap: 20, alignItems: "center", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{u.email}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 10, padding: "2px 6px", border: `1px solid ${u.role === "admin" ? "var(--signal-hold)" : "var(--border)"}`, color: u.role === "admin" ? "var(--signal-hold)" : "var(--text-muted)" }}>
                          {u.role?.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 10, color: u.is_active ? "var(--signal-buy)" : "var(--signal-sell)" }}>
                          ● {u.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </div>
                    </div>
                    <div />
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 4 }}>REQUESTS</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{u.requests?.total || 0}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                        <span style={{ color: "var(--signal-buy)" }}>{u.requests?.by_status?.["2xx"] || 0} ok</span>
                        {" · "}
                        <span style={{ color: "var(--signal-sell)" }}>{(u.requests?.by_status?.["4xx"] || 0) + (u.requests?.by_status?.["5xx"] || 0)} err</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 4 }}>SIGNALS</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{u.signals || 0}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 4 }}>TOKENS</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{((u.tokens?.input || 0) + (u.tokens?.output || 0)).toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: "var(--signal-hold)", marginTop: 2 }}>${(u.tokens?.cost_usd || 0).toFixed(4)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 4 }}>LAST SEEN</div>
                      <div style={{ fontSize: 12 }}>{u.last_seen ? u.last_seen.slice(0, 10) : "never"}</div>
                      <div style={{ marginTop: 6 }}>
                        <button className="btn-ghost btn" onClick={() => { setSelectedUser(u.user_id === selectedUser ? null : u.user_id); setTab("requests"); }}
                          style={{ fontSize: 10, padding: "3px 8px" }}>
                          VIEW LOGS →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Top endpoints */}
                  {u.top_endpoints?.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                      <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 8, letterSpacing: "0.1em" }}>TOP ENDPOINTS</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {u.top_endpoints.map((ep: any, i: number) => (
                          <div key={i} style={{ fontSize: 11, padding: "3px 10px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", display: "flex", gap: 8 }}>
                            <span style={{ color: "var(--text-secondary)" }}>{ep.endpoint}</span>
                            <span style={{ color: "var(--text-muted)" }}>×{ep.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SIGNAL AUDIT TAB */}
      {tab === "signals" && (
        <div className="card">
          <div className="card-header">
            <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em" }}>SIGNAL AUDIT TRAIL</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{signalAudits.length} entries</span>
          </div>
          {signalAudits.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0" }}>No signals generated yet.</div>
          ) : (
            <table>
              <thead>
                <tr><th>TIMESTAMP</th><th>TOKENS IN</th><th>TOKENS OUT</th><th>LATENCY</th><th>COST</th><th></th></tr>
              </thead>
              <tbody>
                {signalAudits.map((a: any) => (
                  <>
                    <tr key={a.id}>
                      <td className="tabular" style={{ color: "var(--text-muted)", fontSize: 12 }}>{a.created_at?.slice(0, 19).replace("T", " ")}</td>
                      <td className="tabular">{a.input_tokens?.toLocaleString()}</td>
                      <td className="tabular">{a.output_tokens?.toLocaleString()}</td>
                      <td className="tabular" style={{ color: "var(--text-muted)" }}>{a.latency_ms}ms</td>
                      <td className="tabular" style={{ color: "var(--signal-hold)" }}>${a.cost_usd?.toFixed(4)}</td>
                      <td>
                        <button className="btn-ghost btn" onClick={() => setExpanded(expanded === a.id ? null : a.id)} style={{ fontSize: 10, padding: "3px 8px" }}>
                          {expanded === a.id ? "COLLAPSE" : "EXPAND"}
                        </button>
                      </td>
                    </tr>
                    {expanded === a.id && (
                      <tr key={a.id + "-d"}>
                        <td colSpan={6} style={{ padding: "14px", background: "var(--bg-tertiary)" }}>
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 6, letterSpacing: "0.1em" }}>PROMPT SENT TO CLAUDE</div>
                            <pre style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto", background: "var(--bg-primary)", padding: 12, margin: 0 }}>{a.prompt_text}</pre>
                          </div>
                          <div>
                            <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 6, letterSpacing: "0.1em" }}>CLAUDE RESPONSE</div>
                            <pre style={{ fontSize: 11, color: "var(--signal-buy)", whiteSpace: "pre-wrap", background: "var(--bg-primary)", padding: 12, margin: 0, maxHeight: 200, overflow: "auto" }}>{a.response_text}</pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* REQUEST LOG TAB */}
      {tab === "requests" && (
        <div className="card">
          <div className="card-header">
            <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
              REQUEST LOG {selectedUser && <span style={{ color: "var(--signal-hold)" }}>— FILTERED</span>}
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {selectedUser && (
                <button className="btn-ghost btn" onClick={() => setSelectedUser(null)} style={{ fontSize: 10 }}>CLEAR FILTER ✕</button>
              )}
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{filteredLogs.length} entries</span>
            </div>
          </div>
          {filteredLogs.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No request logs found.</div>
          ) : (
            <table>
              <thead>
                <tr><th>TIME</th><th>USER</th><th>METHOD</th><th>ENDPOINT</th><th>STATUS</th><th>LATENCY</th></tr>
              </thead>
              <tbody>
                {filteredLogs.slice(0, 100).map((l: any) => {
                  const uInfo = userStats.find((u: any) => u.user_id === l.user_id);
                  return (
                    <tr key={l.id}>
                      <td className="tabular" style={{ color: "var(--text-muted)", fontSize: 11 }}>{l.created_at?.slice(11, 19)}</td>
                      <td style={{ fontSize: 11 }}>
                        {uInfo ? (
                          <span
                            onClick={() => setSelectedUser(l.user_id === selectedUser ? null : l.user_id)}
                            style={{ cursor: "pointer", color: "var(--text-secondary)", textDecoration: "underline" }}
                            title="Filter by this user"
                          >
                            {uInfo.email.split("@")[0]}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>anon</span>
                        )}
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: 11 }}>{l.method}</td>
                      <td style={{ fontSize: 12 }}>{l.endpoint}</td>
                      <td style={{ color: l.status_code < 400 ? "var(--signal-buy)" : "var(--signal-sell)", fontWeight: 600, fontSize: 12 }}>{l.status_code}</td>
                      <td className="tabular" style={{ color: "var(--text-muted)", fontSize: 11 }}>{l.response_time_ms}ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
