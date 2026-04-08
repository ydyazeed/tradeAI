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

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    api.auth.me().then(setUser).catch(() => router.push("/login"));
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "America/New_York" }) + " ET");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const isAdmin = user?.role === "admin";

  const NAV = [
    { href: "/dashboard/overview", label: "01  OVERVIEW" },
    { href: "/dashboard/signals", label: "02  SIGNALS" },
    ...(isAdmin ? [{ href: "/dashboard/audit", label: "03  AUDIT" }] : []),
    { href: "/dashboard/settings", label: isAdmin ? "04  SETTINGS" : "03  SETTINGS" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside style={{ borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
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

      {/* Main */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <header style={{ borderBottom: "1px solid var(--border)", padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
          <span>● <span style={{ color: "var(--signal-buy)" }}>LIVE</span></span>
          <div style={{ color: "var(--text-muted)" }}>{time}</div>
        </header>
        <main style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
