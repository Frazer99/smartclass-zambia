"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "./api";

export type UserForm = {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  role: "student" | "admin";
  form_level?: number | null;
};

type AuthContextType = {
  user: UserForm | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { full_name: string; email: string; password: string; phone?: string; form_level?: number }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserForm | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sc_token") : null;
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/api/auth/me")
      .then((u) => setUser(u))
      .catch(() => {
        localStorage.removeItem("sc_token");
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post("/api/auth/login", { email, password });
    localStorage.setItem("sc_token", res.access_token);
    setUser(res.user);
  }

  async function register(data: { full_name: string; email: string; password: string; phone?: string; form_level?: number }) {
    const res = await api.post("/api/auth/register", data);
    localStorage.setItem("sc_token", res.access_token);
    setUser(res.user);
  }

  function logout() {
    localStorage.removeItem("sc_token");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
