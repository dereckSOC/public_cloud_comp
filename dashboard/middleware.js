import { NextResponse } from "next/server";

// Dashboard does not use visitor_id cookies.
// Add auth-guard middleware here if needed in the future.
export function middleware(request) {
  return NextResponse.next();
}

export const config = { matcher: [] };
