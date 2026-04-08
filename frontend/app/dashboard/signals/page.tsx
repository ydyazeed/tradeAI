"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "../../../lib/api";

const CandlestickChart = dynamic(() => import("../../../components/CandlestickChart"), { ssr: false });

type AddStep = "idle" | "adding" | "fetching" | "indicators" | "done" | "error";

function DirBadge({ direction, confidence }: { direction: string; confidence?: number }) {
  const cls = direction.toLowerCase();
  return (
    <span className={cls} style={{
      fontWeight: 700,
      fontSize: 13,
      padding: "3px 8px",
      border: `1px solid currentColor`,
      letterSpacing: "0.05em",
    }}>
      {direction}{confidence !== undefined ? ` ${(confidence * 100).toFixed(0)}%` : ""}
    </span>
  );
}

function ConfBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.7 ? "var(--signal-buy)" : value >= 0.5 ? "var(--signal-hold)" : "var(--signal-sell)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: "var(--bg-tertiary)", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: color }} />
      </div>
      <span style={{ fontSize: 12, color, fontWeight: 600, minWidth: 36 }}>{pct}%</span>
    </div>
  );
}

export default function SignalsPage() {
  const [symbols, setSymbols] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [signal, setSignal] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<Record<string, number | null>>({});
  const [ohlcv, setOhlcv] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // Add stock
  const [showAdd, setShowAdd] = useState(false);
  const [newTicker, setNewTicker] = useState("");
  const [newName, setNewName] = useState("");
  const [addStep, setAddStep] = useState<AddStep>("idle");
  const [addMsg, setAddMsg] = useState("");

  // Removing
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    const preselect = sessionStorage.getItem("signals_symbol") || undefined;
    if (preselect) sessionStorage.removeItem("signals_symbol");
    loadSymbols(preselect);
  }, []);

  async function loadSymbols(autoSelect?: string) {
    const s = await api.marketData.symbols();
    setSymbols(s);
    const pick = autoSelect || (s.length > 0 ? s[0].symbol : "");
    if (pick) loadData(pick);
  }

  async function loadData(symbol: string) {
    setSelected(symbol);
    setLoading(true);
    setError("");
    setSignal(null);
    setOhlcv([]);
    setHistory([]);
    try {
      const [sig, hist, ind, ohlcvData] = await Promise.allSettled([
        api.signals.latest(symbol),
        api.signals.history(symbol),
        api.indicators.get(symbol),
        api.marketData.ohlcv(symbol, 90),
      ]);
      setSignal(sig.status === "fulfilled" ? sig.value : null);
      setHistory(hist.status === "fulfilled" ? (hist.value as any[]) : []);
      setIndicators(ind.status === "fulfilled" ? (ind.value as any).latest : {});
      setOhlcv(ohlcvData.status === "fulfilled" ? (ohlcvData.value as any[]) : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateSignal() {
    if (!selected) return;
    setGenerating(true);
    setError("");
    try {
      const sig = await api.signals.generate(selected);
      setSignal(sig);
      const [hist, ohlcvData] = await Promise.all([
        api.signals.history(selected),
        api.marketData.ohlcv(selected, 90),
      ]);
      setHistory(hist as any[]);
      setOhlcv(ohlcvData as any[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function addStock(e: React.FormEvent) {
    e.preventDefault();
    const ticker = newTicker.toUpperCase().trim();
    if (!ticker) return;
    setAddStep("adding");
    setAddMsg(`Adding ${ticker}...`);
    try {
      await api.marketData.addSymbol(ticker, newName.trim() || ticker);
      setAddStep("fetching");
      setAddMsg(`Fetching market data for ${ticker}...`);
      await api.marketData.fetch(ticker);
      setAddStep("indicators");
      setAddMsg(`Computing indicators for ${ticker}...`);
      await api.indicators.compute(ticker);
      setAddStep("done");
      setAddMsg(`${ticker} ready.`);
      setNewTicker("");
      setNewName("");
      setTimeout(() => { setShowAdd(false); setAddStep("idle"); setAddMsg(""); loadSymbols(ticker); }, 1000);
    } catch (e: any) {
      setAddStep("error");
      setAddMsg(e.message);
    }
  }

  async function removeStock(symbol: string) {
    if (!confirm(`Remove ${symbol} from tracked symbols?`)) return;
    setRemoving(symbol);
    try {
      await api.marketData.removeSymbol(symbol);
      const remaining = symbols.filter((s) => s.symbol !== symbol);
      setSymbols(remaining);
      if (selected === symbol) {
        if (remaining.length > 0) loadData(remaining[0].symbol);
        else { setSelected(""); setSignal(null); setHistory([]); setOhlcv([]); }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRemoving(null);
    }
  }

  const ta = signal?.risk_params?.timeframe_analysis || {};
  const tc = signal?.risk_params?.technical_context || {};
  const dirClass = signal?.direction?.toLowerCase() || "";

  const STEP_LABELS = [
    { key: "adding", label: "01 TRACK" },
    { key: "fetching", label: "02 FETCH" },
    { key: "indicators", label: "03 INDICATORS" },
    { key: "done", label: "04 READY" },
  ];
  const STEP_ORDER = ["adding", "fetching", "indicators", "done"];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div>
          <div style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.15em" }}>DASHBOARD</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>AI SIGNALS</h1>
        </div>
        <div className="mobile-stack" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
          <button className="btn-ghost btn" onClick={() => { setShowAdd(!showAdd); setAddStep("idle"); setAddMsg(""); }}>
            {showAdd ? "✕ CANCEL" : "+ ADD STOCK"}
          </button>
          {selected && (
            <button className="btn" onClick={generateSignal} disabled={generating}>
              {generating ? "GENERATING..." : "GENERATE SIGNAL ↻"}
            </button>
          )}
        </div>
      </div>

      {/* Symbol tabs */}
      {symbols.length > 0 && (
        <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
          {symbols.map((s) => {
            const active = s.symbol === selected;
            return (
              <div key={s.symbol} style={{ display: "flex", alignItems: "stretch" }}>
                <button
                  onClick={() => loadData(s.symbol)}
                  style={{
                    padding: "10px 18px",
                    fontSize: 12,
                    fontFamily: "inherit",
                    letterSpacing: "0.08em",
                    fontWeight: active ? 700 : 400,
                    background: active ? "var(--bg-secondary)" : "transparent",
                    color: active ? "var(--text-primary)" : "var(--text-muted)",
                    border: "none",
                    borderBottom: active ? "2px solid var(--text-primary)" : "2px solid transparent",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.symbol}
                </button>
                <button
                  onClick={() => removeStock(s.symbol)}
                  disabled={removing === s.symbol}
                  style={{
                    padding: "10px 8px 10px 2px",
                    fontSize: 10,
                    fontFamily: "inherit",
                    background: "transparent",
                    color: "var(--text-muted)",
                    border: "none",
                    borderBottom: active ? "2px solid var(--text-primary)" : "2px solid transparent",
                    cursor: "pointer",
                  }}
                  title={`Remove ${s.symbol}`}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Stock Modal */}
      {showAdd && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && addStep === "idle") { setShowAdd(false); } }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-active)", width: "90%", maxWidth: 480, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em" }}>ADD NEW STOCK</span>
              {addStep === "idle" && (
                <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, fontFamily: "inherit" }}>✕</button>
              )}
            </div>
            <form onSubmit={addStock} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 6, letterSpacing: "0.1em" }}>TICKER SYMBOL *</div>
                <input className="input" value={newTicker} onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                  placeholder="e.g. MSFT, TSLA, NVDA, GOOGL" required autoFocus
                  disabled={addStep !== "idle" && addStep !== "error"} />
              </div>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 6, letterSpacing: "0.1em" }}>COMPANY NAME <span style={{ color: "var(--text-muted)" }}>(optional)</span></div>
                <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Microsoft Corp."
                  disabled={addStep !== "idle" && addStep !== "error"} />
              </div>
              <button className="btn" type="submit" disabled={addStep !== "idle" && addStep !== "error"}
                style={{ width: "100%", padding: "10px", justifyContent: "center" }}>
                {addStep === "idle" || addStep === "error" ? "ADD & FETCH DATA →" : "WORKING..."}
              </button>
            </form>

            {addMsg && (
              <div style={{ marginTop: 14, padding: "10px 12px", fontSize: 12,
                background: addStep === "error" ? "#350a0a" : addStep === "done" ? "#052e16" : "var(--bg-tertiary)",
                border: `1px solid ${addStep === "error" ? "var(--signal-sell)" : addStep === "done" ? "var(--signal-buy)" : "var(--border)"}`,
                color: addStep === "error" ? "var(--signal-sell)" : addStep === "done" ? "var(--signal-buy)" : "var(--text-secondary)" }}>
                {addMsg}
              </div>
            )}

            {addStep !== "idle" && addStep !== "error" && (
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                {STEP_LABELS.map((step) => {
                  const ci = STEP_ORDER.indexOf(addStep), ti = STEP_ORDER.indexOf(step.key);
                  const done = ti < ci || addStep === "done";
                  const active = step.key === addStep;
                  return (
                    <div key={step.key} style={{ flex: 1, textAlign: "center", padding: "4px 0", fontSize: 10,
                      border: `1px solid ${done || active ? "var(--signal-buy)" : "var(--border)"}`,
                      color: done ? "var(--signal-buy)" : active ? "var(--text-primary)" : "var(--text-muted)",
                      background: done ? "#052e16" : "transparent" }}>
                      {done ? "✓ " : ""}{step.label}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: 16, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Fetches 3 months of OHLCV from yfinance and computes RSI, MACD, EMA, Bollinger Bands automatically.
            </div>
          </div>
        </div>
      )}

      {error && <div style={{ color: "var(--signal-sell)", fontSize: 13, padding: "10px 12px", background: "#350a0a", border: "1px solid var(--signal-sell)", marginBottom: 16 }}>{error}</div>}
      {loading && <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>Loading {selected}<span className="cursor" /></div>}

      {symbols.length === 0 && !loading && (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>NO STOCKS TRACKED YET</div>
          <button className="btn" onClick={() => setShowAdd(true)}>+ ADD YOUR FIRST STOCK</button>
        </div>
      )}

      {/* Chart */}
      {ohlcv.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
              01  PRICE CHART — {selected}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {ohlcv.length} bars · BUY <span style={{ color: "var(--signal-buy)" }}>▲</span> SELL <span style={{ color: "var(--signal-sell)" }}>▼</span>
            </span>
          </div>
          <CandlestickChart
            key={selected}
            ohlcv={ohlcv}
            signals={history.filter((s) => s.direction !== "HOLD")}
            height={300}
          />
        </div>
      )}

      {/* Primary signal summary */}
      {signal && !loading && (
        <div className={`card ${dirClass}-bg`} style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--text-muted)" }}>
              02  SIGNAL SUMMARY — {selected}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{signal.timestamp?.slice(0, 10)}</span>
          </div>
          <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 24, alignItems: "start" }}>
            <div>
              <span className={dirClass} style={{ fontSize: 36, fontWeight: 700 }}>{signal.direction}</span>
              <div style={{ marginTop: 6 }}>
                <ConfBar value={signal.confidence} />
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 6, letterSpacing: "0.1em" }}>REASONING</div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary)" }}>{signal.reasoning}</div>
            </div>
            {/* Technical context badges */}
            {Object.keys(tc).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 160 }}>
                {[
                  ["TREND", tc.trend],
                  ["RSI", tc.rsi_zone],
                  ["MACD", tc.macd_momentum],
                  ["BB", tc.bb_position?.replace("_", " ")],
                  ["PRICE vs EMA20", tc.price_vs_ema20],
                ].filter(([, v]) => v).map(([label, val]) => {
                  const isPos = ["UPTREND", "BULLISH", "OVERSOLD", "NEAR_LOWER", "ABOVE"].includes(val as string);
                  const isNeg = ["DOWNTREND", "BEARISH", "OVERBOUGHT", "NEAR_UPPER", "BELOW"].includes(val as string);
                  return (
                    <div key={label as string} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
                      <span style={{ color: "var(--text-muted)" }}>{label}</span>
                      <span style={{ color: isPos ? "var(--signal-buy)" : isNeg ? "var(--signal-sell)" : "var(--signal-hold)", fontWeight: 600 }}>{val}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Risk params */}
          {signal.risk_params?.stop_loss_pct != null && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12, display: "flex", gap: 24, fontSize: 12 }}>
              <div><span style={{ color: "var(--text-muted)" }}>Stop Loss </span><span style={{ color: "var(--signal-sell)", fontWeight: 600 }}>-{signal.risk_params.stop_loss_pct?.toFixed(1)}%</span></div>
              <div><span style={{ color: "var(--text-muted)" }}>Target </span><span style={{ color: "var(--signal-buy)", fontWeight: 600 }}>+{signal.risk_params.take_profit_pct?.toFixed(1)}%</span></div>
              <div><span style={{ color: "var(--text-muted)" }}>R:R </span>{signal.risk_params.risk_reward_ratio?.toFixed(2)}</div>
              <div style={{ marginLeft: "auto", color: "var(--text-muted)" }}>MODEL: {signal.model_used}</div>
            </div>
          )}
        </div>
      )}

      {/* Timeframe analysis */}
      {signal && Object.keys(ta).length > 0 && (
        <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          {[
            { key: "intraday", label: "03  INTRADAY", horizon: ta.intraday?.horizon || "Same day" },
            { key: "swing", label: "04  SWING TRADE", horizon: ta.swing?.horizon || "3-10 days" },
            { key: "long_term", label: "05  LONG TERM", horizon: ta.long_term?.horizon || "4-12 weeks" },
          ].map(({ key, label, horizon }) => {
            const tf = ta[key];
            if (!tf) return null;
            const cls = tf.direction?.toLowerCase() || "hold";
            return (
              <div key={key} className={`card ${cls}-bg`}>
                <div className="card-header">
                  <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.08em" }}>{label}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{horizon}</span>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <DirBadge direction={tf.direction} />
                </div>
                <ConfBar value={tf.confidence} />
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {tf.reasoning}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Indicators + History row */}
      {signal && !loading && (
        <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          {/* Indicators */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em" }}>06  INDICATORS</span>
            </div>
            <table>
              <tbody>
                {Object.entries(indicators).map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ color: "var(--text-muted)", fontSize: 11 }}>{k}</td>
                    <td className="tabular" style={{ fontSize: 13 }}>{v !== null ? (v as number).toFixed(4) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signal History */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em" }}>07  SIGNAL HISTORY — {selected}</span>
            </div>
            {history.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No history yet.</div>
            ) : (
              <div className="table-wrap"><table>
                <thead><tr><th>DATE</th><th>DIR</th><th>CONF</th><th>INTRADAY</th><th>SWING</th><th>LONG TERM</th><th>MODEL</th></tr></thead>
                <tbody>
                  {history.map((s: any) => {
                    const sTA = s.risk_params?.timeframe_analysis || {};
                    return (
                      <tr key={s.id}>
                        <td className="tabular" style={{ color: "var(--text-muted)", fontSize: 11 }}>{s.timestamp?.slice(0, 10)}</td>
                        <td><span className={s.direction.toLowerCase()} style={{ fontWeight: 700 }}>{s.direction}</span></td>
                        <td className="tabular">{(s.confidence * 100).toFixed(0)}%</td>
                        <td><span style={{ fontSize: 11 }} className={sTA.intraday?.direction?.toLowerCase() || ""}>{sTA.intraday?.direction || "—"}</span></td>
                        <td><span style={{ fontSize: 11 }} className={sTA.swing?.direction?.toLowerCase() || ""}>{sTA.swing?.direction || "—"}</span></td>
                        <td><span style={{ fontSize: 11 }} className={sTA.long_term?.direction?.toLowerCase() || ""}>{sTA.long_term?.direction || "—"}</span></td>
                        <td style={{ color: "var(--text-muted)", fontSize: 10 }}>{s.model_used?.replace("claude-", "")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
