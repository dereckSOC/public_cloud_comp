import { NextResponse } from "next/server.js";
import logger from "@psd/shared/lib/logger";
import { buildServiceHeaders, proxyJson, serviceUnavailable } from "../../_lib/serviceProxy.js";

function toPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const PIN_PATTERN = /^\d{1,6}$/;

async function getParamId(params) {
  const resolvedParams = await params;
  return toPositiveInteger(resolvedParams?.id);
}

export async function PUT(request, { params }) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const questId = await getParamId(params);
    if (!questId) {
      return NextResponse.json({ error: "Invalid quest ID." }, { status: 400 });
    }

    const payload = await request.json();
    const updates = {};

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "title")) {
      const title = typeof payload.title === "string" ? payload.title.trim() : "";
      if (!title) return NextResponse.json({ error: "Quest title cannot be empty." }, { status: 400 });
      updates.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "description")) {
      updates.description = typeof payload.description === "string" ? payload.description : "";
    }

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "pin")) {
      const pin = payload.pin === null ? null : String(payload.pin).replace(/\D/g, "").slice(0, 6);
      if (pin && !PIN_PATTERN.test(pin)) {
        return NextResponse.json({ error: "PIN must be 1-6 digits." }, { status: 400 });
      }
      updates.pin = pin;
    }

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "isActive")) {
      if (typeof payload.isActive !== "boolean") {
        return NextResponse.json({ error: "isActive must be a boolean." }, { status: 400 });
      }
      updates.isActive = payload.isActive;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No quest fields provided." }, { status: 400 });
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/quests/${questId}`, {
      method: "PUT",
      headers: buildServiceHeaders(request, {
        contentType: "application/json",
        includeAuthorization: true,
      }),
      body: JSON.stringify(updates),
    });
  } catch (error) {
    logger.error("update quest proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not update quest." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    if (!process.env.EVENT_SERVICE_URL) {
      return serviceUnavailable(request);
    }

    const questId = await getParamId(params);
    if (!questId) {
      return NextResponse.json({ error: "Invalid quest ID." }, { status: 400 });
    }

    return await proxyJson(`${process.env.EVENT_SERVICE_URL}/quests/${questId}`, {
      method: "DELETE",
      headers: buildServiceHeaders(request, { includeAuthorization: true }),
    });
  } catch (error) {
    logger.error("delete quest proxy failed", { err: String(error) });
    return NextResponse.json({ error: "Could not delete quest." }, { status: 500 });
  }
}
