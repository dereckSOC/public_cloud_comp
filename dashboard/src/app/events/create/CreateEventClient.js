"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@psd/shared/lib/supabaseClient";
import { getCurrentUserRole } from "@psd/shared/lib/authClient";
import { fetchJsonWithAdminAuth } from "@/app/lib/apiClient";

export default function CreateEventClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");
  const queryString = eventId ? `?eventId=${eventId}` : "";

  const [authLoading, setAuthLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    location: "",
    start_date: "",
    end_date: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.user) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      try {
        const role = await getCurrentUserRole(session.user.id);
        if (!mounted) return;

        if (role !== "superadmin") {
          router.replace("/unauthorized");
          return;
        }

        setAuthLoading(false);
      } catch {
        router.replace("/login");
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const datesInvalid =
    form.start_date &&
    form.end_date &&
    new Date(form.end_date) < new Date(form.start_date);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!form.name.trim()) {
      setError("Event name is required.");
      setLoading(false);
      return;
    }

    if (datesInvalid) {
      setError("End date cannot be before start date.");
      setLoading(false);
      return;
    }

    const { response, body } = await fetchJsonWithAdminAuth("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        location: form.location.trim(),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      }),
    });

    if (!response.ok) {
      setError(body?.error || "Could not create event. Please try again.");
      setLoading(false);
      return;
    }

    router.push(`/events${queryString}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#7A2F38] text-xl font-semibold">Checking access...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#7A2F38]">
      <header className="bg-[#FFF7ED] border-b-2 border-[#ff8c42] px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image
              src="/images/SCS-logo.png"
              alt="SCS logo"
              width={80}
              height={80}
              className="w-20 h-20 object-contain"
            />
            <div>
              <h1 className="text-xl font-semibold">Create Event</h1>
              <p className="text-sm text-[#7A2F38]">
                Add a new event to manage feedback.
              </p>
            </div>
          </div>
          <Link
            href={`/events${queryString}`}
            className="text-sm text-[#7A2F38] hover:text-[#7A2F38] transition-colors"
          >
            Back to events
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        <div className="bg-[#FFF7ED] rounded-xl p-6 border-2 border-[#ff8c42] shadow-sm">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <h2 className="text-xl font-semibold text-[#7A2F38]">
                Event details
              </h2>
              <p className="text-sm text-[#7A2F38]">Basics for the new event.</p>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1 text-[#7A2F38]"
                htmlFor="name"
              >
                Event name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={form.name}
                onChange={handleChange}
                className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                placeholder="e.g., World Cancer Day"
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1 text-[#7A2F38]"
                htmlFor="location"
              >
                Location
              </label>
              <input
                id="location"
                name="location"
                type="text"
                value={form.location}
                onChange={handleChange}
                className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                placeholder="e.g., Punggol Coast Mall"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1 text-[#7A2F38]"
                  htmlFor="start_date"
                >
                  Start date
                </label>
                <input
                  id="start_date"
                  name="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={handleChange}
                  className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-1 text-[#7A2F38]"
                  htmlFor="end_date"
                >
                  End date
                </label>
                <input
                  id="end_date"
                  name="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={handleChange}
                  className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                />
                {datesInvalid && (
                  <p className="mt-1 text-xs text-red-600">
                    End date cannot be before start date.
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            <div className="flex items-center space-x-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-[#ff8c42] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create event"}
              </button>
              <Link
                href={`/events${queryString}`}
                className="text-sm text-[#7A2F38] hover:text-[#7A2F38] transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
