import { NextResponse } from "next/server";
import logger from "@psd/shared/lib/logger";
import { reportError } from "@psd/shared/lib/errorMonitor";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../_lib/serviceProxy";

function toPositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

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

    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const url = `${process.env.EVENT_SERVICE_URL}/events/access?eventId=${eventId}`;
    return await proxyJson(url, {
      headers: buildServiceHeaders(request, { contentType: "application/json" }),
    });
  } catch (error) {
    logger.error("event-access lookup failed", { err: String(error) });
    reportError(error, { route: "events/access" });
    return NextResponse.json(
      { error: "Could not validate event access." },
      { status: 500 }
    );
  }
}
