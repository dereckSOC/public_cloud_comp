import { NextResponse } from "next/server";
import logger from "@psd/shared/lib/logger";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../_lib/serviceProxy";

export async function GET(request) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/admin/assignable-users`, {
      headers: buildServiceHeaders(request, { includeAuthorization: true }),
    });
  } catch (error) {
    logger.error("assignable users proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not load assignable users." }, { status: 500 });
  }
}
