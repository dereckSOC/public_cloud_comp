import { NextResponse } from "next/server.js";
import logger from "@psd/shared/lib/logger";
import { reportError } from "@psd/shared/lib/errorMonitor";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../_lib/serviceProxy.js";

function toPositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function POST(request) {
  try {
    const payload = await request.json();

    const eventId = toPositiveInteger(payload?.eventId);
    if (!eventId) {
      return NextResponse.json(
        { error: "eventId must be a positive integer." },
        { status: 400 }
      );
    }

    const answers = payload?.answers;
    if (!Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: "answers must be a non-empty array." },
        { status: 400 }
      );
    }

    const submittedAt = payload?.submittedAt || new Date().toISOString();

    if (!process.env.FEEDBACK_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const url = `${process.env.FEEDBACK_SERVICE_URL}/submit`;
    return await proxyJson(url, {
      method: "POST",
      headers: buildServiceHeaders(request, { contentType: "application/json" }),
      body: JSON.stringify({ eventId, answers, submittedAt }),
    });
  } catch (error) {
    logger.error("feedback submit failed", { err: String(error) });
    reportError(error, { route: "feedback/submit" });
    return NextResponse.json(
      { error: "Could not submit feedback." },
      { status: 500 }
    );
  }
}
