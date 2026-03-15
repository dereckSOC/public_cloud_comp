import { NextResponse } from "next/server";
import logger from "@psd/shared/lib/logger";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../_lib/serviceProxy";

function toPositiveInteger(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
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

    if (!process.env.ANALYTICS_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const url = `${process.env.ANALYTICS_SERVICE_URL}/booth-metrics?eventId=${eventId}`;
    return await proxyJson(url, {
      headers: buildServiceHeaders(request, { includeAuthorization: true }),
    });
  } catch (error) {
    logger.error("booth-metrics read failed", { err: String(error) });
    return NextResponse.json(
      { error: "Could not load booth metrics." },
      { status: 500 }
    );
  }
}
