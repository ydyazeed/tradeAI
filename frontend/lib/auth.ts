"use client";
import { api, setTokens, clearTokens } from "./api";

export async function login(email: string, password: string) {
  const data = await api.auth.login(email, password);
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export function logout() {
  clearTokens();
  window.location.href = "/login";
}

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("access_token");
}
