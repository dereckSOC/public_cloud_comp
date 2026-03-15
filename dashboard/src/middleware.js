import { NextResponse } from "next/server";

export function middleware(request) {
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("x-request-id", requestId);

  const entry = {
    severity: "INFO",
    message: "request",
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
    timestamp: new Date().toISOString(),
  };
  process.stdout.write(JSON.stringify(entry) + "\n");

  return response;
}

export const config = { matcher: ["/api/:path*"] };
