"use client";

import Link from "next/link";
import { Suspense } from "react";
import useQueryParams from "../lib/useQueryParams";

function HomeButtonContent() {
  const { buildQueryString } = useQueryParams();
  const queryString = buildQueryString();

  return (
    <Link href={`/questlistpage${queryString}`}>
      <button
        type="button"
        className="px-4 py-3 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition inline-flex items-center justify-center font-silkscreen"
        aria-label="Home"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      </button>
    </Link>
  );
}

export default function HomeButton() {
  return (
    <Suspense
      fallback={
        <button
          type="button"
          className="px-4 py-3 bg-yellow-500 text-white font-semibold rounded-lg opacity-70 inline-flex items-center justify-center font-silkscreen"
          aria-label="Home"
          disabled
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </button>
      }
    >
      <HomeButtonContent />
    </Suspense>
  );
}