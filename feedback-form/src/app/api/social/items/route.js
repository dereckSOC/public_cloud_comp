import { NextResponse } from "next/server.js";
import logger from "@psd/shared/lib/logger";
import { reportError } from "@psd/shared/lib/errorMonitor";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../_lib/serviceProxy.js";

function toPositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function GET(request) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const sectionId = toPositiveInteger(request.nextUrl.searchParams.get("sectionId"));
    const suffix = sectionId ? `?sectionId=${sectionId}` : "";
    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/social-items${suffix}`, {
      headers: buildServiceHeaders(request, { contentType: "application/json" }),
    });
  } catch (error) {
    logger.error("social items fetch failed", { err: String(error) });
    reportError(error, { route: "social/items" });
    return NextResponse.json(
      { error: "Could not load social items." },
      { status: 500 }
    );
  }
}
