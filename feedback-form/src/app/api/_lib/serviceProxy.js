import { NextResponse } from "next/server.js";

export function getRequestIdHeader(request) {
  return request.headers.get("x-request-id") || "";
}

export function buildServiceHeaders(request, { contentType, extraHeaders = {} } = {}) {
  const headers = new Headers(extraHeaders);
  const requestId = getRequestIdHeader(request);

  if (requestId) {
    headers.set("X-Request-ID", requestId);
  }

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  return headers;
}

export function serviceUnavailable(request) {
  const headers = new Headers();
  const requestId = getRequestIdHeader(request);
  if (requestId) {
    headers.set("X-Request-ID", requestId);
  }

  return NextResponse.json({ error: "Service unavailable" }, { status: 503, headers });
}

export async function proxyJson(url, init = {}) {
  const upstream = await fetch(url, init);
  const text = await upstream.text();

  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text };
    }
  }

  const headers = new Headers();
  const requestId = upstream.headers.get("x-request-id");
  if (requestId) {
    headers.set("X-Request-ID", requestId);
  }

  return NextResponse.json(body, { status: upstream.status, headers });
}
