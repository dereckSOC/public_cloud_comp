import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Set visitor_id cookie for non-dashboard/events pages
  if (!request.cookies.get("visitor_id")) {
    res.cookies.set("visitor_id", crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 5, // 5 Days
    });
  }

  // Add request ID and structured log for API routes
  if (isApiRoute) {
    res.headers.set("x-request-id", requestId);

    const entry = {
      severity: "INFO",
      message: "request",
      requestId,
      method: request.method,
      path: pathname,
      timestamp: new Date().toISOString(),
    };
    process.stdout.write(JSON.stringify(entry) + "\n");
  }

  return res;
}

export const config = {
  matcher: ["/((?!dashboard|events|_next|favicon.ico).*)"],
};
