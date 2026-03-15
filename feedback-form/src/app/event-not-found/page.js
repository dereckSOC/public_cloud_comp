"use client";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import useQueryParams from "@psd/shared/lib/useQueryParams";

function EventNotFoundContent() {
  const { eventId, buildQueryString } = useQueryParams();
  const eventsQueryString = buildQueryString({ eventId: null, questId: null });
  const startQueryString = buildQueryString({ questId: null });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white/95 border-2 border-purple-300 rounded-xl shadow-xl p-8 text-center">
        <h1 className="text-3xl font-bold text-purple-900 font-silkscreen">
          Event does not exist
        </h1>
        <p className="text-purple-700 mt-4 font-silkscreen">
          The event link is missing, invalid, or no longer active.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          {eventId && (
            <Link
              href={`/${startQueryString}`}
              className="px-5 py-3 rounded-lg bg-yellow-500 text-indigo-950 border-2 border-yellow-400 hover:bg-yellow-400 transition-colors font-silkscreen"
            >
              Back to start
            </Link>
          )}
          <Link
            href={`/eventlistpage${eventsQueryString}`}
            className="px-5 py-3 rounded-lg bg-indigo-700 text-yellow-300 border-2 border-indigo-500 hover:bg-indigo-600 transition-colors font-silkscreen"
          >
            more about us
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function EventNotFoundPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center">
          <div className="text-yellow-300 text-xl font-silkscreen">Loading...</div>
        </div>
      }
    >
      <EventNotFoundContent />
    </Suspense>
  );
}
