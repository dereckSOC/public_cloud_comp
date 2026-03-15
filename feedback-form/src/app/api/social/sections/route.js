import { NextResponse } from "next/server.js";
import logger from "@psd/shared/lib/logger";
import { reportError } from "@psd/shared/lib/errorMonitor";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../_lib/serviceProxy.js";

export async function GET(request) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/social-sections`, {
      headers: buildServiceHeaders(request, { contentType: "application/json" }),
    });
  } catch (error) {
    logger.error("social sections fetch failed", { err: String(error) });
    reportError(error, { route: "social/sections" });
    return NextResponse.json(
      { error: "Could not load social sections." },
      { status: 500 }
    );
  }
}
