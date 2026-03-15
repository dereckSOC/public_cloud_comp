import { NextResponse } from "next/server";

export function middleware(request) {
  const res = NextResponse.next();
  if (!request.cookies.get("visitor_id")) {
    res.cookies.set("visitor_id", crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 5, // 5 Days
    });
  }
  return res;
}

export const config = { matcher: [
    "/((?!dashboard|events|_next|favicon.ico).*)",
  ]};
