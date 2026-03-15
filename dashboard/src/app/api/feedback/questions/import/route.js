import { NextResponse } from "next/server";
import logger from "@psd/shared/lib/logger";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../../_lib/serviceProxy";

// POST /api/feedback/questions/import — import a question from another event
export async function POST(request) {
  try {
    const payload = await request.json();

    if (process.env.FEEDBACK_SERVICE_URL) {
      const url = `${process.env.FEEDBACK_SERVICE_URL}/questions/manage/import`;
      return await proxyJson(url, {
        method: "POST",
        headers: buildServiceHeaders(request, {
          contentType: "application/json",
          includeAuthorization: true,
        }),
        body: JSON.stringify(payload),
      });
    }

    // No fallback — import requires service
    return serviceUnavailable(request);
  } catch (error) {
    logger.error("import question failed", { err: String(error) });
    return NextResponse.json({ error: "Could not import question." }, { status: 500 });
  }
}
