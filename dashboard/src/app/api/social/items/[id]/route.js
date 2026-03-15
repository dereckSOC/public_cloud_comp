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

    const itemId = await getParamId(params);
    if (!itemId) {
      return NextResponse.json({ error: "Invalid item ID." }, { status: 400 });
    }

    const payload = await request.json();
    const updates = {};

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "sectionId")) {
      const sectionId = toPositiveInteger(payload.sectionId);
      if (!sectionId) {
        return NextResponse.json({ error: "sectionId must be a positive integer." }, { status: 400 });
      }
      updates.sectionId = sectionId;
    }

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "title")) {
      const title = typeof payload.title === "string" ? payload.title.trim() : "";
      if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
      updates.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "detail")) {
      updates.detail = typeof payload.detail === "string" ? payload.detail : "";
    }

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "url")) {
      const url = typeof payload.url === "string" ? payload.url.trim() : "";
      if (!url) return NextResponse.json({ error: "URL is required." }, { status: 400 });
      updates.url = url;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No item fields provided." }, { status: 400 });
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/social-items/${itemId}`, {
      method: "PUT",
      headers: buildServiceHeaders(request, {
        contentType: "application/json",
        includeAuthorization: true,
      }),
      body: JSON.stringify(updates),
    });
  } catch (error) {
    logger.error("update social item proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not update social item." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const itemId = await getParamId(params);
    if (!itemId) {
      return NextResponse.json({ error: "Invalid item ID." }, { status: 400 });
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/social-items/${itemId}`, {
      method: "DELETE",
      headers: buildServiceHeaders(request, { includeAuthorization: true }),
    });
  } catch (error) {
    logger.error("delete social item proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not delete social item." }, { status: 500 });
  }
}
