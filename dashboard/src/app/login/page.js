"use client";
export const dynamic = "force-dynamic";

import Image from "next/image";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@psd/shared/lib/supabaseClient";
import { getCurrentSession, getCurrentUserRole } from "@psd/shared/lib/authClient";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/events";
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const redirectIfAlreadyLoggedIn = async () => {
      try {
        const session = await getCurrentSession();
        if (!session?.user || !mounted) {
          return;
        }
        const role = await getCurrentUserRole(session.user.id);
        if (!mounted) {
          return;
        }
        if (role === "superadmin" || role === "admin") {
          router.replace(nextPath);
          return;
        }
        router.replace("/unauthorized");
      } catch {
        // Keep user on login page if session/role check fails.
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    };

    redirectIfAlreadyLoggedIn();

    return () => {
      mounted = false;
    };
  }, [nextPath, router]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const email = form.email.trim().toLowerCase();
    const password = form.password;

    if (!email || !password) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError(loginError.message || "Login failed.");
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setError("Login failed. Missing user session.");
      setLoading(false);
      return;
    }

    try {
      const role = await getCurrentUserRole(userId);
      if (role === "superadmin" || role === "admin") {
        router.replace(nextPath);
        return;
      }
      await supabase.auth.signOut();
      setError("Your account is authenticated but not authorized for this dashboard.");
    } catch {
      setError("Could not verify your role. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#7A2F38] text-lg font-semibold">Checking session...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#7A2F38] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#FFF7ED] border-2 border-[#ff8c42] rounded-xl shadow-sm p-6 space-y-5">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/images/SCS-logo.png"
              alt="SCS logo"
              width={70}
              height={70}
              className="w-25 h-20 object-contain"
            />
            <h1 className="text-2xl font-bold">Dashboard Login</h1>
          </div>
          <p className="text-sm text-[#7A2F38] mt-1">Admins and superadmins sign in with email and password.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
              placeholder="name@company.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#ff8c42] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#ff6b1a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#7A2F38] text-lg font-semibold">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
