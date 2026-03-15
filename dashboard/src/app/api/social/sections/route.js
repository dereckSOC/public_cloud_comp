import { NextResponse } from "next/server.js";
import logger from "@psd/shared/lib/logger";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../_lib/serviceProxy.js";

function toPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/social-sections`, {
      headers: buildServiceHeaders(request),
    });
  } catch (error) {
    logger.error("social sections proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not load social sections." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const payload = await request.json();
    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    const displayOrder = toPositiveInteger(payload?.displayOrder);

    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/social-sections`, {
      method: "POST",
      headers: buildServiceHeaders(request, {
        contentType: "application/json",
        includeAuthorization: true,
      }),
      body: JSON.stringify({
        title,
        ...(displayOrder ? { displayOrder } : {}),
      }),
    });
  } catch (error) {
    logger.error("create social section proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not create social section." }, { status: 500 });
  }
}
