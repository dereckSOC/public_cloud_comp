import { NextResponse } from "next/server.js";
import logger from "@psd/shared/lib/logger";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../_lib/serviceProxy.js";

function toPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const eventId = request.nextUrl.searchParams.get("eventId");
    if (eventId !== null && !toPositiveInteger(eventId)) {
      return NextResponse.json({ error: "eventId must be a positive integer." }, { status: 400 });
    }

    const suffix = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/events${suffix}`, {
      headers: buildServiceHeaders(request, { includeAuthorization: true }),
    });
  } catch (error) {
    logger.error("events proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not load events." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const payload = await request.json();
    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Event name is required." }, { status: 400 });
    }

    if (payload?.start_date && payload?.end_date && new Date(payload.end_date) < new Date(payload.start_date)) {
      return NextResponse.json({ error: "End date cannot be before start date." }, { status: 400 });
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/events`, {
      method: "POST",
      headers: buildServiceHeaders(request, {
        contentType: "application/json",
        includeAuthorization: true,
      }),
      body: JSON.stringify({
        name,
        location: typeof payload?.location === "string" ? payload.location : "",
        start_date: payload?.start_date || null,
        end_date: payload?.end_date || null,
      }),
    });
  } catch (error) {
    logger.error("create event proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not create event." }, { status: 500 });
  }
}
