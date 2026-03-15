import { NextResponse } from "next/server";
import logger from "@psd/shared/lib/logger";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../_lib/serviceProxy";

function toPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(request) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const payload = await request.json();
    const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
    const eventIds = Array.isArray(payload?.eventIds)
      ? [...new Set(payload.eventIds.map((value) => toPositiveInteger(value)).filter(Boolean))]
      : [];

    if (!email) {
      return NextResponse.json({ error: "Admin email is required." }, { status: 400 });
    }

    if (eventIds.length === 0) {
      return NextResponse.json({ error: "Select at least one event." }, { status: 400 });
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/admin/event-admins`, {
      method: "POST",
      headers: buildServiceHeaders(request, {
        contentType: "application/json",
        includeAuthorization: true,
      }),
      body: JSON.stringify({ email, eventIds }),
    });
  } catch (error) {
    logger.error("assign event admins proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not assign admin." }, { status: 500 });
  }
}
