import { NextResponse } from "next/server";
import logger from "@psd/shared/lib/logger";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../_lib/serviceProxy";

function toPositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

// GET /api/feedback/questions?eventId=<n> — list questions for management
export async function GET(request) {
  try {
    const eventId = toPositiveInteger(request.nextUrl.searchParams.get("eventId"));
    if (!eventId) {
      return NextResponse.json({ error: "eventId must be a positive integer." }, { status: 400 });
    }

    if (!process.env.FEEDBACK_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const url = `${process.env.FEEDBACK_SERVICE_URL}/questions/manage?eventId=${eventId}`;
    return await proxyJson(url, {
      headers: buildServiceHeaders(request, { includeAuthorization: true }),
    });
  } catch (error) {
    logger.error("list managed questions failed", { err: String(error) });
    return NextResponse.json({ error: "Could not load questions." }, { status: 500 });
  }
}

// POST /api/feedback/questions — create question
export async function POST(request) {
  try {
    const payload = await request.json();
    const eventId = toPositiveInteger(payload?.eventId);
    const questionText = typeof payload?.questionText === "string" ? payload.questionText.trim() : "";

    if (!eventId) return NextResponse.json({ error: "eventId required." }, { status: 400 });
    if (!questionText) return NextResponse.json({ error: "questionText required." }, { status: 400 });

    if (!process.env.FEEDBACK_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const url = `${process.env.FEEDBACK_SERVICE_URL}/questions/manage`;
    return await proxyJson(url, {
      method: "POST",
      headers: buildServiceHeaders(request, {
        contentType: "application/json",
        includeAuthorization: true,
      }),
      body: JSON.stringify({
        eventId,
        questionText,
        questionType: payload?.questionType || "mcq",
        options: payload?.options,
      }),
    });
  } catch (error) {
    logger.error("create question failed", { err: String(error) });
    return NextResponse.json({ error: "Could not create question." }, { status: 500 });
  }
}

// PUT /api/feedback/questions — update or toggle (routed by action field)
export async function PUT(request) {
  try {
    const payload = await request.json();
    const action = payload?.action;
    const questionId = toPositiveInteger(payload?.questionId);
    if (!questionId) return NextResponse.json({ error: "questionId required." }, { status: 400 });

    if (action === "toggle") {
      if (typeof payload?.isActive !== "boolean") {
        return NextResponse.json({ error: "isActive must be a boolean." }, { status: 400 });
      }
    } else {
      const questionText = typeof payload?.questionText === "string" ? payload.questionText.trim() : "";
      if (!questionText) {
        return NextResponse.json({ error: "questionText required." }, { status: 400 });
      }
    }

    if (!process.env.FEEDBACK_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    let url;
    let body;
    if (action === "toggle") {
      url = `${process.env.FEEDBACK_SERVICE_URL}/questions/manage/${questionId}/toggle`;
      body = JSON.stringify({ isActive: payload.isActive });
    } else {
      url = `${process.env.FEEDBACK_SERVICE_URL}/questions/manage/${questionId}`;
      body = JSON.stringify({
        questionId,
        questionText: payload.questionText,
        questionType: payload.questionType || "mcq",
        options: payload.options,
      });
    }

    return await proxyJson(url, {
      method: "PUT",
      headers: buildServiceHeaders(request, {
        contentType: "application/json",
        includeAuthorization: true,
      }),
      body,
    });
  } catch (error) {
    logger.error("update question failed", { err: String(error) });
    return NextResponse.json({ error: "Could not update question." }, { status: 500 });
  }
}

// DELETE /api/feedback/questions?questionId=<n>&eventId=<n>
export async function DELETE(request) {
  try {
    const questionId = toPositiveInteger(request.nextUrl.searchParams.get("questionId"));
    const eventId = toPositiveInteger(request.nextUrl.searchParams.get("eventId"));

    if (!questionId || !eventId) {
      return NextResponse.json({ error: "questionId and eventId required." }, { status: 400 });
    }

    if (!process.env.FEEDBACK_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const url = `${process.env.FEEDBACK_SERVICE_URL}/questions/manage/${questionId}?eventId=${eventId}`;
    return await proxyJson(url, {
      method: "DELETE",
      headers: buildServiceHeaders(request, { includeAuthorization: true }),
    });
  } catch (error) {
    logger.error("delete question failed", { err: String(error) });
    return NextResponse.json({ error: "Could not delete question." }, { status: 500 });
  }
}
