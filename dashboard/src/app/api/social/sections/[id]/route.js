import { NextResponse } from "next/server.js";
import logger from "@psd/shared/lib/logger";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../../_lib/serviceProxy.js";

function toPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function getParamId(params) {
  const resolvedParams = await params;
  return toPositiveInteger(resolvedParams?.id);
}

export async function PUT(request, { params }) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const sectionId = await getParamId(params);
    if (!sectionId) {
      return NextResponse.json({ error: "Invalid section ID." }, { status: 400 });
    }

    const payload = await request.json();
    const updates = {};

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "title")) {
      const title = typeof payload.title === "string" ? payload.title.trim() : "";
      if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
      updates.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "displayOrder")) {
      const displayOrder = toPositiveInteger(payload.displayOrder);
      if (!displayOrder) {
        return NextResponse.json({ error: "displayOrder must be a positive integer." }, { status: 400 });
      }
      updates.displayOrder = displayOrder;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No section fields provided." }, { status: 400 });
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/social-sections/${sectionId}`, {
      method: "PUT",
      headers: buildServiceHeaders(request, {
        contentType: "application/json",
        includeAuthorization: true,
      }),
      body: JSON.stringify(updates),
    });
  } catch (error) {
    logger.error("update social section proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not update social section." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const sectionId = await getParamId(params);
    if (!sectionId) {
      return NextResponse.json({ error: "Invalid section ID." }, { status: 400 });
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/social-sections/${sectionId}`, {
      method: "DELETE",
      headers: buildServiceHeaders(request, { includeAuthorization: true }),
    });
  } catch (error) {
    logger.error("delete social section proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not delete social section." }, { status: 500 });
  }
}
