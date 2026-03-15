import { NextResponse } from "next/server";
import logger from "@psd/shared/lib/logger";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../../_lib/serviceProxy";

function toPositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

// GET /api/feedback/questions/options?questionId=<n>
export async function GET(request) {
  try {
    const questionId = toPositiveInteger(request.nextUrl.searchParams.get("questionId"));
    if (!questionId) {
      return NextResponse.json({ error: "questionId must be a positive integer." }, { status: 400 });
    }

    if (!process.env.FEEDBACK_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const url = `${process.env.FEEDBACK_SERVICE_URL}/questions/manage/${questionId}/options`;
    return await proxyJson(url, {
      headers: buildServiceHeaders(request, { includeAuthorization: true }),
    });
  } catch (error) {
    logger.error("fetch question options failed", { err: String(error) });
    return NextResponse.json({ error: "Could not load options." }, { status: 500 });
  }
}
