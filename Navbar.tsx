"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="border-b border-brand-100 bg-white/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center font-bold">S</span>
          <span className="font-bold text-brand-800">SmartClass Zambia</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link href="/dashboard" className="text-brand-700 hover:text-brand-900">
                Dashboard
              </Link>
              <Link href="/progress" className="text-brand-700 hover:text-brand-900">
                Progress
              </Link>
              {user.role === "admin" && (
                <Link href="/admin" className="text-brand-700 hover:text-brand-900">
                  Admin
                </Link>
              )}
              <span className="text-brand-400">|</span>
              <span className="text-brand-800">{user.full_name}</span>
              <button
                onClick={() => {
                  logout();
                  router.push("/");
                }}
                className="btn-secondary py-1.5 px-3"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-secondary py-1.5 px-3">
                Log in
              </Link>
              <Link href="/register" className="btn-primary py-1.5 px-3">
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
