"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOutCurrentUser } from "@psd/shared/lib/authClient";

export default function UnauthorizedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOutCurrentUser();
    } finally {
      router.replace("/login");
    }
  };

  return (
    <div className="min-h-screen bg-[#e8d5e8] flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white border border-[#d4b3d4] rounded-xl shadow-sm p-6 space-y-4 text-[#5a3d7a]">
        <h1 className="text-2xl font-bold">Access not allowed</h1>
        <p className="text-sm text-[#8b6fa0]">
          This account is authenticated, but does not have permission to use the admin dashboard.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={loading}
            className="bg-[#ff8c42] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#ff6b1a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Signing out..." : "Sign out"}
          </button>
          <Link href="/login" className="text-sm text-[#8b6fa0] hover:text-[#5a3d7a]">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
