"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { logout, isLoggedIn } from "../../lib/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [time, setTime] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    api.auth.me().then(setUser).catch(() => router.push("/login"));
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "America/New_York" }) + " ET");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Close menu on navigation
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const isAdmin = user?.role === "admin";

  const NAV = [
    { href: "/dashboard/overview", label: "01  OVERVIEW" },
    { href: "/dashboard/signals", label: "02  SIGNALS" },
    ...(isAdmin ? [{ href: "/dashboard/audit", label: "03  AUDIT" }] : []),
    { href: "/dashboard/settings", label: isAdmin ? "04  SETTINGS" : "03  SETTINGS" },
  ];

  return (
    <div className="grid-sidebar" style={{ display: "grid", gridTemplateColumns: "200px 1fr", minHeight: "100vh" }}>
      {/* Mobile header */}
      <div className="mobile-topbar" style={{ display: "none", borderBottom: "1px solid var(--border)", padding: "12px 16px", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.1em" }}>TRADEAI</span>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "6px 10px", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
        >
          {menuOpen ? "✕" : "≡"}
        </button>
      </div>

      {/* Sidebar */}
      <aside className="sidebar" style={{ borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.1em" }}>TRADEAI</div>
          <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>v1.0.0</div>
        </div>
        <nav style={{ flex: 1, padding: "16px 0" }}>
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "block",
                  padding: "10px 16px",
                  fontSize: 12,
                  letterSpacing: "0.05em",
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  textDecoration: "none",
                  background: active ? "var(--bg-tertiary)" : "transparent",
                  borderLeft: active ? "2px solid var(--text-primary)" : "2px solid transparent",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: "16px", borderTop: "1px solid var(--border)" }}>
          {user && (
            <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </div>
          )}
          {user && (
            <div style={{ fontSize: 10, marginBottom: 10, padding: "2px 6px", display: "inline-block",
              color: isAdmin ? "var(--signal-hold)" : "var(--text-muted)",
              border: `1px solid ${isAdmin ? "var(--signal-hold)" : "var(--border)"}`,
            }}>
              {user.role?.toUpperCase()}
            </div>
          )}
          <button className="btn-ghost btn" onClick={logout} style={{ width: "100%", fontSize: 11 }}>SIGN OUT</button>
        </div>
      </aside>

      {/* Mobile overlay menu */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 40 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 240, height: "100%", background: "var(--bg-primary)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}
          >
            <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.1em" }}>TRADEAI</div>
            </div>
            <nav style={{ flex: 1, padding: "16px 0" }}>
              {NAV.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: "block",
                      padding: "12px 16px",
                      fontSize: 13,
                      color: active ? "var(--text-primary)" : "var(--text-muted)",
                      textDecoration: "none",
                      background: active ? "var(--bg-tertiary)" : "transparent",
                      borderLeft: active ? "2px solid var(--text-primary)" : "2px solid transparent",
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div style={{ padding: "16px", borderTop: "1px solid var(--border)" }}>
              {user && <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>}
              <button className="btn-ghost btn" onClick={logout} style={{ width: "100%", fontSize: 11 }}>SIGN OUT</button>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ borderBottom: "1px solid var(--border)", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
          <span>● <span style={{ color: "var(--signal-buy)" }}>LIVE</span></span>
          <div style={{ color: "var(--text-muted)" }}>{time}</div>
        </header>
        <main style={{ flex: 1, padding: "20px", overflowY: "auto", overflowX: "hidden" }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .grid-sidebar { display: flex !important; flex-direction: column !important; }
          .sidebar { display: none !important; }
          .mobile-topbar { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
