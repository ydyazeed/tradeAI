"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      router.push("/dashboard/overview");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: "0.1em", marginBottom: 8 }}>TRADEAI</div>
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>SIGN IN TO YOUR ACCOUNT</div>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 6, letterSpacing: "0.1em" }}>EMAIL</div>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" required />
            </div>
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 6, letterSpacing: "0.1em" }}>PASSWORD</div>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            {error && <div style={{ color: "var(--signal-sell)", fontSize: 13, padding: "8px", background: "#350a0a", border: "1px solid var(--signal-sell)" }}>{error}</div>}
            <button className="btn" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "10px" }}>
              {loading ? "SIGNING IN..." : "SIGN IN →"}
            </button>
          </form>
        </div>
        <div style={{ textAlign: "center", marginTop: 16, color: "var(--text-muted)", fontSize: 13 }}>
          No account?{" "}
          <Link href="/register" style={{ color: "var(--text-secondary)" }}>Register here</Link>
        </div>
      </div>
    </div>
  );
}
