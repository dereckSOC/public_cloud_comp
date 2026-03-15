import { NextResponse } from "next/server";
import logger from "@psd/shared/lib/logger";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../_lib/serviceProxy";

function toPositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

// GET /api/feedback/responses?eventId=<n> — export response data as JSON rows
export async function GET(request) {
  try {
    const eventId = toPositiveInteger(request.nextUrl.searchParams.get("eventId"));
    if (!eventId) {
      return NextResponse.json({ error: "eventId must be a positive integer." }, { status: 400 });
    }

    if (!process.env.FEEDBACK_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const url = `${process.env.FEEDBACK_SERVICE_URL}/responses/export?eventId=${eventId}`;
    return await proxyJson(url, {
      headers: buildServiceHeaders(request),
    });
  } catch (error) {
    logger.error("export responses failed", { err: String(error) });
    return NextResponse.json({ error: "Could not export responses." }, { status: 500 });
  }
}
