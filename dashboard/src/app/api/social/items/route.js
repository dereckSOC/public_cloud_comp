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

    const sectionId = toPositiveInteger(request.nextUrl.searchParams.get("sectionId"));
    const suffix = sectionId ? `?sectionId=${sectionId}` : "";

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/social-items${suffix}`, {
      headers: buildServiceHeaders(request),
    });
  } catch (error) {
    logger.error("social items proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not load social items." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const payload = await request.json();
    const sectionId = toPositiveInteger(payload?.sectionId);
    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    const url = typeof payload?.url === "string" ? payload.url.trim() : "";

    if (!sectionId) {
      return NextResponse.json({ error: "sectionId must be a positive integer." }, { status: 400 });
    }
    if (!title || !url) {
      return NextResponse.json({ error: "Title and URL are required." }, { status: 400 });
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/social-items`, {
      method: "POST",
      headers: buildServiceHeaders(request, {
        contentType: "application/json",
        includeAuthorization: true,
      }),
      body: JSON.stringify({
        sectionId,
        title,
        detail: typeof payload?.detail === "string" ? payload.detail : "",
        url,
      }),
    });
  } catch (error) {
    logger.error("create social item proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not create social item." }, { status: 500 });
  }
}
