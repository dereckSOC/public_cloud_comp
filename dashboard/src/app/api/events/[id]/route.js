import { NextResponse } from "next/server.js";
import logger from "@psd/shared/lib/logger";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../_lib/serviceProxy.js";

function toPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function getParamId(params) {
  const resolvedParams = await params;
  return toPositiveInteger(resolvedParams?.id);
}

export async function PUT(request, { params }) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const eventId = await getParamId(params);
    if (!eventId) {
      return NextResponse.json({ error: "Invalid event ID." }, { status: 400 });
    }

    const payload = await request.json();
    const updates = {};

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "name")) {
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      if (!name) return NextResponse.json({ error: "Event name cannot be empty." }, { status: 400 });
      updates.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "location")) {
      const location = typeof payload.location === "string" ? payload.location.trim() : "";
      if (!location) return NextResponse.json({ error: "Location cannot be empty." }, { status: 400 });
      updates.location = location;
    }

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "start_date")) {
      updates.start_date = payload.start_date || null;
    }

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "end_date")) {
      updates.end_date = payload.end_date || null;
    }

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "is_active")) {
      if (typeof payload.is_active !== "boolean") {
        return NextResponse.json({ error: "is_active must be a boolean." }, { status: 400 });
      }
      updates.is_active = payload.is_active;
    }

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "story_mode_enabled")) {
      if (typeof payload.story_mode_enabled !== "boolean") {
        return NextResponse.json({ error: "story_mode_enabled must be a boolean." }, { status: 400 });
      }
      updates.story_mode_enabled = payload.story_mode_enabled;
    }

    if (
      updates.start_date &&
      updates.end_date &&
      new Date(updates.end_date) < new Date(updates.start_date)
    ) {
      return NextResponse.json({ error: "End date cannot be before start date." }, { status: 400 });
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No event fields provided." }, { status: 400 });
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/events/${eventId}`, {
      method: "PUT",
      headers: buildServiceHeaders(request, {
        contentType: "application/json",
        includeAuthorization: true,
      }),
      body: JSON.stringify(updates),
    });
  } catch (error) {
    logger.error("update event proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not update event." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const eventId = await getParamId(params);
    if (!eventId) {
      return NextResponse.json({ error: "Invalid event ID." }, { status: 400 });
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/events/${eventId}`, {
      method: "DELETE",
      headers: buildServiceHeaders(request, { includeAuthorization: true }),
    });
  } catch (error) {
    logger.error("delete event proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not delete event." }, { status: 500 });
  }
}
