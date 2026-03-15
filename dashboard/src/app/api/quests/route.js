import { NextResponse } from "next/server.js";
import logger from "@psd/shared/lib/logger";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../_lib/serviceProxy.js";

function toPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const PIN_PATTERN = /^\d{1,6}$/;

export async function GET(request) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const eventId = toPositiveInteger(request.nextUrl.searchParams.get("eventId"));
    if (!eventId) {
      return NextResponse.json({ error: "eventId must be a positive integer." }, { status: 400 });
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/quests?eventId=${eventId}`, {
      headers: buildServiceHeaders(request, { includeAuthorization: true }),
    });
  } catch (error) {
    logger.error("quests proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not load quests." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const payload = await request.json();
    const eventId = toPositiveInteger(payload?.eventId);
    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    const pin = typeof payload?.pin === "string" ? payload.pin.replace(/\D/g, "").slice(0, 6) : "";
    const isActive = typeof payload?.isActive === "boolean" ? payload.isActive : true;

    if (!eventId) {
      return NextResponse.json({ error: "eventId must be a positive integer." }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Quest title cannot be empty." }, { status: 400 });
    }
    if (!pin || !PIN_PATTERN.test(pin)) {
      return NextResponse.json({ error: "PIN must be 1-6 digits." }, { status: 400 });
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/quests`, {
      method: "POST",
      headers: buildServiceHeaders(request, {
        contentType: "application/json",
        includeAuthorization: true,
      }),
      body: JSON.stringify({
        eventId,
        title,
        description: typeof payload?.description === "string" ? payload.description : "",
        pin,
        isActive,
      }),
    });
  } catch (error) {
    logger.error("create quest proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not create quest." }, { status: 500 });
  }
}
