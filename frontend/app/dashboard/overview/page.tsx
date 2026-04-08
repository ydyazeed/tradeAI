"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";

export default function OverviewPage() {
  const router = useRouter();
  const [symbols, setSymbols] = useState<any[]>([]);
  const [latestPrices, setLatestPrices] = useState<Record<string, any>>({});
  const [latestSignals, setLatestSignals] = useState<Record<string, any>>({});
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const syms = await api.marketData.symbols();
        setSymbols(syms);
        const h = await api.health();
        setHealth(h);

        const pricePromises = syms.map(async (s: any) => {
          try { return [s.symbol, await api.marketData.latest(s.symbol)]; }
          catch { return [s.symbol, null]; }
        });
        setLatestPrices(Object.fromEntries(await Promise.all(pricePromises)));

        const signalPromises = syms.map(async (s: any) => {
          try { return [s.symbol, await api.signals.latest(s.symbol)]; }
          catch { return [s.symbol, null]; }
        });
        setLatestSignals(Object.fromEntries(await Promise.all(signalPromises)));
      } finally { setLoading(false); }
    }
    load();
  }, []);

  function goToSignal(symbol: string) {
    // Store selected symbol so signals page auto-selects it
    sessionStorage.setItem("signals_symbol", symbol);
    router.push("/dashboard/signals");
  }

  if (loading) return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading market data<span className="cursor" /></div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.15em" }}>DASHBOARD</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>MARKET OVERVIEW</h1>
      </div>

      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Market Overview */}
        <div className="card">
          <div className="card-header">
            <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em" }}>01  TRACKED SYMBOLS</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{symbols.length} symbols</span>
          </div>
          {symbols.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0", textAlign: "center" }}>
              No symbols tracked. Go to Signals to add stocks.
            </div>
          ) : (
            <div className="table-wrap"><table>
              <thead><tr><th>SYMBOL</th><th>CLOSE</th><th>VOLUME</th><th></th></tr></thead>
              <tbody>
                {symbols.map((s: any) => {
                  const p = latestPrices[s.symbol];
                  return (
                    <tr key={s.symbol} style={{ cursor: "pointer" }} onClick={() => goToSignal(s.symbol)}>
                      <td><span style={{ fontWeight: 600 }}>{s.symbol}</span><span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 8 }}>{s.name}</span></td>
                      <td className="tabular">{p ? `$${p.close.toFixed(2)}` : "—"}</td>
                      <td className="tabular" style={{ color: "var(--text-muted)" }}>{p ? (p.volume / 1e6).toFixed(1) + "M" : "—"}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: 11 }}>→</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>

        {/* Latest Signals */}
        <div className="card">
          <div className="card-header">
            <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em" }}>02  LATEST SIGNALS</span>
          </div>
          {symbols.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0", textAlign: "center" }}>No signals yet.</div>
          ) : (
            <div className="table-wrap"><table>
              <thead><tr><th>SYMBOL</th><th>SIGNAL</th><th>CONF.</th><th>INTRADAY</th><th>SWING</th><th>LONG TERM</th><th></th></tr></thead>
              <tbody>
                {symbols.map((s: any) => {
                  const sig = latestSignals[s.symbol];
                  const ta = sig?.risk_params?.timeframe_analysis || {};
                  return (
                    <tr key={s.symbol} style={{ cursor: "pointer" }} onClick={() => goToSignal(s.symbol)}>
                      <td style={{ fontWeight: 600 }}>{s.symbol}</td>
                      <td>
                        {sig ? (
                          <span className={sig.direction.toLowerCase()} style={{ fontWeight: 700 }}>{sig.direction}</span>
                        ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </td>
                      <td className="tabular" style={{ color: "var(--text-muted)" }}>{sig ? (sig.confidence * 100).toFixed(0) + "%" : "—"}</td>
                      <td><span style={{ fontSize: 11 }} className={ta.intraday?.direction?.toLowerCase() || ""}>{ta.intraday?.direction || "—"}</span></td>
                      <td><span style={{ fontSize: 11 }} className={ta.swing?.direction?.toLowerCase() || ""}>{ta.swing?.direction || "—"}</span></td>
                      <td><span style={{ fontSize: 11 }} className={ta.long_term?.direction?.toLowerCase() || ""}>{ta.long_term?.direction || "—"}</span></td>
                      <td style={{ color: "var(--text-muted)", fontSize: 11 }}>→</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      {/* System Status */}
      <div className="card">
        <div className="card-header">
          <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em" }}>03  SYSTEM STATUS</span>
        </div>
        <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, fontSize: 13 }}>
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 4 }}>DATABASE</div>
            <div style={{ color: health?.checks?.database?.status === "up" ? "var(--signal-buy)" : "var(--signal-sell)" }}>
              ● {health?.checks?.database?.status?.toUpperCase() || "UNKNOWN"}
            </div>
            {health?.checks?.database?.latency_ms !== undefined && (
              <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>{health.checks.database.latency_ms}ms latency</div>
            )}
          </div>
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 4 }}>SCHEDULER</div>
            <div style={{ color: health?.checks?.scheduler?.status === "running" ? "var(--signal-buy)" : "var(--signal-sell)" }}>
              ● {health?.checks?.scheduler?.status?.toUpperCase() || "UNKNOWN"}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 4 }}>API VERSION</div>
            <div>{health?.version || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
