import { NextResponse } from "next/server.js";
import logger from "@psd/shared/lib/logger";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../_lib/serviceProxy.js";

function toPositiveInteger(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function POST(request) {
  try {
    const visitorId = request.cookies.get("visitor_id")?.value?.trim();
    if (!visitorId) {
      return NextResponse.json(
        { error: "Missing visitor cookie." },
        { status: 400 }
      );
    }

    let payload = {};
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload." },
        { status: 400 }
      );
    }

    const eventId = toPositiveInteger(payload?.eventId);
    const questId = toPositiveInteger(payload?.questId);
    const method = typeof payload?.method === "string" ? payload.method.trim() : "";

    if (!eventId) return NextResponse.json({ error: "eventId must be a positive integer." }, { status: 400 });
    if (!questId) return NextResponse.json({ error: "questId must be a positive integer." }, { status: 400 });
    if (method !== "pin") return NextResponse.json({ error: "method must be 'pin'." }, { status: 400 });

    if (!process.env.ANALYTICS_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const url = `${process.env.ANALYTICS_SERVICE_URL}/booth-complete`;
    return await proxyJson(url, {
      method: "POST",
      headers: buildServiceHeaders(request, {
        contentType: "application/json",
        extraHeaders: {
          Cookie: `visitor_id=${visitorId}`,
        },
      }),
      body: JSON.stringify({ eventId, questId, method }),
    });
  } catch (error) {
    logger.error("booth-complete tracking failed", { err: String(error) });
    return NextResponse.json({ error: "Could not record booth completion." }, { status: 500 });
  }
}
