import Link from "next/link";

export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Nav */}
      <nav style={{ borderBottom: "1px solid var(--border)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "0.1em" }}>TRADEAI</span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/login" style={{ color: "var(--text-secondary)", fontSize: 12, textDecoration: "none", letterSpacing: "0.05em" }}>LOGIN</Link>
          <Link href="/register" className="btn" style={{ textDecoration: "none" }}>REGISTER</Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "60px 20px 60px" }}>
        <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.2em", marginBottom: 16 }}>01  AI-POWERED TRADING SIGNALS</div>
            <h1 style={{ fontSize: "clamp(32px, 6vw, 48px)", fontWeight: 700, lineHeight: 1.1, marginBottom: 24 }}>
              TRADE<br />SMARTER
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.8, marginBottom: 32, maxWidth: 400 }}>
              Market data ingestion, technical indicators, and Claude AI-powered BUY/SELL/HOLD signals with full audit trails.
            </p>
            <div className="mobile-stack" style={{ display: "flex", gap: 12 }}>
              <Link href="/register" className="btn" style={{ textDecoration: "none", textAlign: "center" }}>GET STARTED →</Link>
              <Link href="/login" className="btn-ghost btn" style={{ textDecoration: "none", textAlign: "center" }}>VIEW DEMO</Link>
            </div>
          </div>
          {/* Sample signal JSON */}
          <div className="card" style={{ fontFamily: "monospace", fontSize: 13, overflowX: "auto" }}>
            <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 12 }}>SAMPLE SIGNAL OUTPUT</div>
            <pre style={{ color: "var(--text-secondary)", margin: 0, lineHeight: 1.8 }}>
{`{
  `}<span style={{ color: "var(--text-muted)" }}>"symbol"</span>{`: `}<span style={{ color: "#22c55e" }}>"AAPL"</span>{`,
  `}<span style={{ color: "var(--text-muted)" }}>"direction"</span>{`: `}<span style={{ color: "var(--signal-buy)", fontWeight: 700 }}>"BUY"</span>{`,
  `}<span style={{ color: "var(--text-muted)" }}>"confidence"</span>{`: `}<span style={{ color: "#60a5fa" }}>0.87</span>{`,
  `}<span style={{ color: "var(--text-muted)" }}>"reasoning"</span>{`: `}<span style={{ color: "#a3e635" }}>"RSI oversold at
    28.3, MACD bullish
    crossover detected"</span>{`,
  `}<span style={{ color: "var(--text-muted)" }}>"model"</span>{`: `}<span style={{ color: "var(--text-secondary)" }}>"claude-haiku-4-5"</span>{`
}`}
            </pre>
          </div>
        </div>

        {/* Features */}
        <div style={{ marginTop: 80, borderTop: "1px solid var(--border)", paddingTop: 48 }}>
          <div style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.2em", marginBottom: 32 }}>02  FEATURES</div>
          <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { n: "01", title: "MARKET DATA", desc: "Daily OHLCV from yfinance. RSI, MACD, EMA, Bollinger Bands via pandas-ta." },
              { n: "02", title: "AI SIGNALS", desc: "Claude Haiku/Sonnet generates structured BUY/SELL/HOLD signals with confidence." },
              { n: "03", title: "AUDIT TRAIL", desc: "Every signal request logged: full prompt, response, tokens, cost, latency." },
            ].map((f) => (
              <div key={f.n} className="card">
                <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 8 }}>{f.n}</div>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>{f.title}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
