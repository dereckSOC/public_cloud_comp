"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@psd/shared/lib/supabaseClient";
import { getCurrentUserRole } from "@psd/shared/lib/authClient";
import { fetchJsonWithAdminAuth } from "@/app/lib/apiClient";

export default function SuperadminPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [authLoading, setAuthLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [form, setForm] = useState({
    email: "",
    selectedEventIds: [],
    assigning: false,
  });
  const [notice, setNotice] = useState({ type: "", message: "" });
  const sortEventsByName = (rows) =>
    [...(rows ?? [])].sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));

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
      } catch (authError) {
        router.replace("/login");
      }
    };

    checkAuth();
    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  useEffect(() => {
    if (authLoading) return;
    const loadAssignableUsers = async () => {
      setLoadingUsers(true);
      try {
        const { response, body } = await fetchJsonWithAdminAuth("/api/admin/assignable-users");
        if (!response.ok) {
          throw new Error(body?.error || "Could not load users for dropdown.");
        }
        setAssignableUsers(body.users ?? []);
      } catch (error) {
        setNotice({
          type: "error",
          message: error.message || "Could not load users for dropdown.",
        });
        setAssignableUsers([]);
      }
      setLoadingUsers(false);
    };

    loadAssignableUsers();
  }, [authLoading]);

  useEffect(() => {
    if (authLoading) return;
    const loadEvents = async () => {
      setLoadingEvents(true);
      try {
        const { response, body } = await fetchJsonWithAdminAuth("/api/events");
        if (!response.ok) {
          throw new Error(body?.error || "Could not load events.");
        }
        setEvents(sortEventsByName(body.events ?? []));
      } catch (error) {
        setNotice({ type: "error", message: "Could not load events." });
        setEvents([]);
      }
      setLoadingEvents(false);
    };
    loadEvents();
  }, [authLoading]);

  const selectedCount = useMemo(() => form.selectedEventIds.length, [form.selectedEventIds]);

  const toggleEvent = (eventId) => {
    setForm((prev) => {
      const exists = prev.selectedEventIds.includes(eventId);
      const selectedEventIds = exists
        ? prev.selectedEventIds.filter((id) => id !== eventId)
        : [...prev.selectedEventIds, eventId];
      return { ...prev, selectedEventIds };
    });
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!email) {
      setNotice({ type: "error", message: "Admin email is required." });
      return;
    }
    if (form.selectedEventIds.length === 0) {
      setNotice({ type: "error", message: "Select at least one event." });
      return;
    }

    setForm((prev) => ({ ...prev, assigning: true }));
    setNotice({ type: "", message: "" });

    try {
      const { response, body } = await fetchJsonWithAdminAuth("/api/admin/event-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          eventIds: form.selectedEventIds,
        }),
      });

      if (!response.ok) {
        throw new Error(body?.error || "Could not assign admin.");
      }

      setNotice({ type: "success", message: "Admin role assigned and events mapped successfully." });
      setAssignableUsers((prev) => prev.filter((candidate) => candidate !== email));
      setForm({ email: "", selectedEventIds: [], assigning: false });
      return;
    } catch (error) {
      setNotice({ type: "error", message: error.message || "Could not assign admin." });
    }

    setForm((prev) => ({ ...prev, assigning: false }));
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
          <div>
            <h1 className="text-2xl font-bold">Superadmin Console</h1>
            <p className="text-sm text-[#7A2F38]">Assign admin role and map events.</p>
          </div>
          <Link
            href="/events"
            className="bg-[#ff8c42] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm"
          >
            Back to Events
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <section className="bg-[#FFF7ED] rounded-xl p-6 border-2 border-[#ff8c42] shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">Add Admin and Assign Events</h2>
          <form className="space-y-4" onSubmit={handleAssign}>
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium mb-1">
                Select Admin User
              </label>
              <select
                id="admin-email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                disabled={loadingUsers || form.assigning}
                className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                required
              >
                <option value="">{loadingUsers ? "Loading users..." : "Select admin email"}</option>
                {assignableUsers.map((email) => (
                  <option key={email} value={email}>
                    {email}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Assignable Events</span>
                <span className="text-xs text-[#7A2F38]">
                  {loadingEvents ? "Loading..." : `${selectedCount} selected`}
                </span>
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border-2 border-[#ff8c42] p-3 space-y-2">
                {loadingEvents && <div className="text-sm text-[#7A2F38]">Loading events...</div>}
                {!loadingEvents && events.length === 0 && (
                  <div className="text-sm text-[#7A2F38]">No events found.</div>
                )}
                {events.map((event) => (
                  <label
                    key={event.id}
                    className="flex items-center justify-between rounded-md px-3 py-2 bg-[#FFF7ED] border-2 border-[#ff8c42]"
                  >
                    <span className="text-sm">
                      {event.name} <span className="text-xs text-[#7A2F38]">#{event.id}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={form.selectedEventIds.includes(event.id)}
                      onChange={() => toggleEvent(event.id)}
                    />
                  </label>
                ))}
              </div>
            </div>

            {notice.message && (
              <div
                className={`text-sm rounded-lg p-3 border ${
                  notice.type === "error"
                    ? "text-red-600 bg-red-50 border-red-200"
                    : "text-green-700 bg-green-50 border-green-200"
                }`}
              >
                {notice.message}
              </div>
            )}

            <button
              type="submit"
              disabled={form.assigning}
              className="bg-[#ff8c42] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {form.assigning ? "Assigning..." : "Assign Admin"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
