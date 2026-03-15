"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@psd/shared/lib/supabaseClient";
import { getCurrentUserRole, signOutCurrentUser } from "@psd/shared/lib/authClient";
import SocialTab from "@/app/dashboard/components/SocialTab";
import { fetchJson, fetchJsonWithAdminAuth } from "@/app/lib/apiClient";

export default function EventPickerClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");
  const queryString = eventId ? `?eventId=${eventId}` : "";

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [socialEditing, setSocialEditing] = useState(false);
  const [exportingKey, setExportingKey] = useState("");
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

        if (role !== "superadmin" && role !== "admin") {
          router.replace("/unauthorized");
          return;
        }

        setUserRole(role);
        setUserEmail(session.user.email || "");
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

  useEffect(() => {
    if (authLoading || !userRole) return;

    const fetchEvents = async () => {
      setLoading(true);
      setError("");
      const { response, body } = await fetchJsonWithAdminAuth("/api/events");
      if (!response.ok) {
        setError("Could not load events. Please try again.");
        setEvents([]);
      } else {
        setEvents(body.events ?? []);
      }

      setLoading(false);
    };

    fetchEvents();
  }, [authLoading, userRole]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOutCurrentUser();
    } catch {
      // Sign out failed; redirect to login anyway
    } finally {
      router.replace("/login");
    }
  };

  const toCsv = (rows) => {
    if (!rows || rows.length === 0) {
      return "event_id,event_name,response_id,submitted_at,question_id,question_text,answer,option_text,answer_created_at";
    }
    const headers = Object.keys(rows[0]);
    const escapeCsv = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes('"') || s.includes(",") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [
      headers.join(","),
      ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(",")),
    ];
    return lines.join("\n");
  };

  const downloadCsv = (filename, rows) => {
    const csv = toCsv(rows);
    const bom = "\ufeff";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const fetchExportRows = async (exportEvents) => {
    const eventNameById = new Map(exportEvents.map((event) => [event.id, event.name ?? ""]));
    const rowsPerEvent = await Promise.all(
      exportEvents.map(async (event) => {
        const { response, body } = await fetchJson(`/api/feedback/responses?eventId=${event.id}`);
        if (!response.ok) {
          throw new Error(body?.error || `Could not export responses for ${event.name || `event ${event.id}`}.`);
        }

        return (body.rows ?? []).map((row) => ({
          event_id: row.event_id ?? event.id,
          event_name: eventNameById.get(event.id) || "",
          response_id: row.response_id ?? "",
          submitted_at: row.submitted_at ?? "",
          question_id: row.question_id ?? "",
          question_text: row.question_text ?? "",
          answer: row.answer ?? "",
          option_text: "",
          answer_created_at: row.answer_created_at ?? "",
        }));
      })
    );

    return rowsPerEvent.flat();
  };

  const handleExportAllData = async () => {
    if (events.length === 0) {
      setError("No events available to export.");
      return;
    }

    setExportingKey("all");
    setError("");
    try {
      const rows = await fetchExportRows(events);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadCsv(`all-events-responses-${stamp}.csv`, rows);
    } catch (exportError) {
      const details = [exportError?.message, exportError?.details, exportError?.hint]
        .filter(Boolean)
        .join(" | ");
      setError(details || "Could not export data. Please try again.");
    } finally {
      setExportingKey("");
    }
  };

  const eventCount = events.length;

  const formatDateRange = (start, end) => {
    if (!start && !end) return "Date TBC";
    const options = { month: "short", day: "numeric", year: "numeric" };
    const startStr = start ? new Date(start).toLocaleDateString(undefined, options) : "";
    const endStr = end ? new Date(end).toLocaleDateString(undefined, options) : "";
    if (startStr && endStr) return `${startStr} - ${endStr}`;
    return startStr || endStr;
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
              <h1 className="text-xl font-semibold">Select an Event</h1>
              <p className="text-sm text-[#7A2F38]">Choose an event to view its dashboard</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-sm text-[#7A2F38]">{userEmail || "User"}</span>
            {userRole === "superadmin" && (
              <Link
                href="/superadmin"
                className="bg-[#ff8c42] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm"
              >
                Admin Console
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="cursor-pointer bg-white border-2 border-[#ff8c42] text-[#7A2F38] px-4 py-2 rounded-md text-sm font-medium hover:bg-[#FFF7ED] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="bg-[#FFF7ED] rounded-xl p-6 border-2 border-[#ff8c42] shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold mb-1">Your Events</h2>
              <p className="text-sm text-[#7A2F38]">
                Pick one to jump into its analytics dashboard.
              </p>
            </div>
            <span className="text-xs bg-white border-2 border-[#ff8c42] text-[#7A2F38] px-3 py-1 rounded-full">
              {loading ? "Loading..." : `${eventCount} available`}
            </span>
          </div>

          {error && (
            <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {loading && (
              <div className="col-span-1 md:col-span-2 text-center text-sm text-[#7A2F38] py-6">
                Loading events...
              </div>
            )}

            {!loading && events.length === 0 && !error && (
              <div className="col-span-1 md:col-span-2 text-center text-sm text-[#7A2F38] py-6">
                No accessible events assigned.
              </div>
            )}

            {events.map((event) => (
              <div
                key={event.id}
                className="bg-[#FFF7ED] border-2 border-[#ff8c42] rounded-lg p-5 hover:border-[#ff8c42] transition-colors shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#7A2F38]">{event.name}</h3>
                    <p className="text-sm text-[#7A2F38] mt-1">
                      {event.location || "Location TBC"} • {formatDateRange(event.start_date, event.end_date)}
                    </p>
                  </div>
                  <div
                    className={`w-3 h-3 rounded-full ${
                      event.is_active ? "bg-green-500" : "bg-[#ff8c42]"
                    }`}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-[#7A2F38]">View feedback, responses, and trends.</span>
                  <Link
                    href={`/dashboard?eventId=${encodeURIComponent(event.id)}&eventName=${encodeURIComponent(
                      event.name
                    )}`}
                    className="bg-[#ff8c42] text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-[#ff6b1a] transition-colors"
                  >
                    View dashboard
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {userRole === "superadmin" && (
            <div className="mt-6 pt-4 border-t-2 border-[#ff8c42] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-[#7A2F38]">
                Export includes only answered responses across all events you can access.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <Link
                  href={`/events/create${queryString}`}
                  className="bg-[#ff8c42] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm text-center"
                >
                  Create Event
                </Link>
                <button
                  type="button"
                  onClick={handleExportAllData}
                  disabled={!!exportingKey || loading}
                  className="cursor-pointer bg-[#ff8c42] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {exportingKey === "all" ? "Exporting all events..." : "Export All Events (CSV)"}
                </button>
              </div>
            </div>
          )}
        </div>
        {userRole === "superadmin" && (
          <div className="bg-[#FFF7ED] rounded-xl p-6 border-2 border-[#ff8c42] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-[#7A2F38]">Manage Social Content</h2>
              <button
                className="bg-[#ff8c42] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm"
                onClick={() => setSocialEditing(e => !e)}
              >
                {socialEditing ? "Done" : "Edit"}
              </button>
            </div>
            <SocialTab isEditing={socialEditing} setIsEditing={setSocialEditing} />
          </div>
        )}
      </main>
    </div>
  );
}
