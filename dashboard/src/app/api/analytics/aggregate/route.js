import { NextResponse } from "next/server";
import logger from "@psd/shared/lib/logger";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../_lib/serviceProxy";

function toPositiveInteger(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

// GET /api/analytics/aggregate?eventId=<n> — full response analytics
export async function GET(request) {
  try {
    const eventId = toPositiveInteger(
      request.nextUrl.searchParams.get("eventId")
    );
    if (!eventId) {
      return NextResponse.json(
        { error: "eventId must be a positive integer." },
        { status: 400 }
      );
    }

    if (process.env.ANALYTICS_SERVICE_URL) {
      const url = `${process.env.ANALYTICS_SERVICE_URL}/analytics?eventId=${eventId}`;
      return await proxyJson(url, {
        headers: buildServiceHeaders(request),
      });
    }

    // No fallback — analytics aggregation requires the analytics-service
    return serviceUnavailable(request);
  } catch (error) {
    logger.error("analytics aggregate failed", { err: String(error) });
    return NextResponse.json(
      { error: "Could not load analytics." },
      { status: 500 }
    );
  }
}
