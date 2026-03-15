import { NextResponse } from "next/server";
import logger from "@psd/shared/lib/logger";
import { reportError } from "@psd/shared/lib/errorMonitor";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../_lib/serviceProxy";

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
    if (!eventId) {
      return NextResponse.json(
        { error: "eventId must be a positive integer." },
        { status: 400 }
      );
    }

    if (!process.env.ANALYTICS_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    return await proxyJson(`${process.env.ANALYTICS_SERVICE_URL}/device-entry`, {
      method: "POST",
      headers: buildServiceHeaders(request, {
        contentType: "application/json",
        extraHeaders: {
          Cookie: `visitor_id=${visitorId}`,
          "User-Agent": request.headers.get("user-agent") || "",
        },
      }),
      body: JSON.stringify(payload),
    });
  } catch (error) {
    logger.error("device-entry tracking failed", { err: String(error) });
    reportError(error, { route: "analytics/device-entry" });
    return NextResponse.json(
      { error: "Could not record device entry." },
      { status: 500 }
    );
  }
}
