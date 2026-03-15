/**
 * event-service — backend service for event metadata, social content, and quest management.
 *
 * Frontends call this instead of hitting Supabase directly.
 * Exposes:
 *   GET    /health
 *   GET    /events/access?eventId=<n>
 *   GET    /events[?eventId=<n>]
 *   POST   /events
 *   PUT    /events/<id>
 *   DELETE /events/<id>
 *   GET    /quests?eventId=<n>
 *   POST   /quests
 *   PUT    /quests/<id>
 *   DELETE /quests/<id>
 *   GET    /social-sections
 *   POST   /social-sections
 *   PUT    /social-sections/<id>
 *   DELETE /social-sections/<id>
 *   GET    /social-items
 *   POST   /social-items
 *   PUT    /social-items/<id>
 *   DELETE /social-items/<id>
 *   GET    /admin/assignable-users
 *   POST   /admin/event-admins
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { createServer } from "http";
import logger from "@psd/shared/lib/logger.js";

const PORT = process.env.PORT ?? 4000;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_DB_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SERVICE_NAME = "event-service";

const EVENT_FIELDS = "id, name, location, start_date, end_date, created_at, is_active, story_mode_enabled";
const QUEST_FIELDS = "id, event_id, title, description, pin, is_active, created_at";
const SOCIAL_SECTION_FIELDS = "id, title, display_order";
const SOCIAL_ITEM_FIELDS = "id, section_id, title, detail, url";
const PIN_PATTERN = /^\d{1,6}$/;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "SUPABASE_URL (preferred) or NEXT_PUBLIC_DB_URL, plus SUPABASE_SERVICE_ROLE_KEY, must be set"
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function getRequestId(req) {
  const header = req.headers["x-request-id"];
  const candidate = Array.isArray(header) ? header[0] : header;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : randomUUID();
}

function attachRequestLogger(req, res, pathname) {
  const requestId = getRequestId(req);
  const requestLogger = logger.child({
    service: SERVICE_NAME,
    requestId,
    method: req.method,
    path: pathname,
  });

  req.requestId = requestId;
  req.requestLogger = requestLogger;
  res.setHeader("X-Request-ID", requestId);

  return requestLogger;
}

function getRequestLogger(req) {
  return req.requestLogger || logger.child({ service: SERVICE_NAME, requestId: req.requestId });
}

function toPositiveInteger(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function normalizeRequiredText(value, maxLength = 255) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.slice(0, maxLength);
}

function normalizeOptionalText(value, maxLength = 255) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function normalizeOptionalDate(value) {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizePin(value) {
  if (value === null) return null;
  if (typeof value !== "string") return "";
  return value.replace(/\D/g, "").slice(0, 6);
}

function parseBearerToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj ?? {}, key);
}

function getBoolean(payload, camelKey, snakeKey) {
  if (hasOwn(payload, camelKey)) {
    return typeof payload[camelKey] === "boolean" ? payload[camelKey] : null;
  }
  if (snakeKey && hasOwn(payload, snakeKey)) {
    return typeof payload[snakeKey] === "boolean" ? payload[snakeKey] : null;
  }
  return undefined;
}

function sortEvents(rows) {
  return [...(rows ?? [])].sort((a, b) => {
    const aStart = typeof a?.start_date === "string" ? a.start_date : "";
    const bStart = typeof b?.start_date === "string" ? b.start_date : "";
    if (!aStart && bStart) return -1;
    if (aStart && !bStart) return 1;
    if (aStart && bStart && aStart !== bStart) return aStart.localeCompare(bStart);

    const aCreated = typeof a?.created_at === "string" ? a.created_at : "";
    const bCreated = typeof b?.created_at === "string" ? b.created_at : "";
    if (aCreated !== bCreated) return aCreated.localeCompare(bCreated);
    return Number(a?.id ?? 0) - Number(b?.id ?? 0);
  });
}

function sortQuests(rows) {
  return [...(rows ?? [])].sort((a, b) => {
    const aCreated = typeof a?.created_at === "string" ? a.created_at : "";
    const bCreated = typeof b?.created_at === "string" ? b.created_at : "";
    if (aCreated !== bCreated) return aCreated.localeCompare(bCreated);
    return Number(a?.id ?? 0) - Number(b?.id ?? 0);
  });
}

function sortSocialSections(rows) {
  return [...(rows ?? [])].sort((a, b) => {
    const aOrder = Number.isFinite(Number(a?.display_order)) ? Number(a.display_order) : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(Number(b?.display_order)) ? Number(b.display_order) : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return Number(a?.id ?? 0) - Number(b?.id ?? 0);
  });
}

function sortSocialItems(rows) {
  return [...(rows ?? [])].sort((a, b) => Number(a?.id ?? 0) - Number(b?.id ?? 0));
}

async function handleRequest(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const requestLogger = attachRequestLogger(req, res, pathname);

  try {
    if (req.method === "GET" && pathname === "/health") {
      return respond(res, 200, { status: "ok", service: "event-service" });
    }

    if (req.method === "GET" && pathname === "/events/access") {
      return await handleEventAccess(req, url, res);
    }

    if (req.method === "GET" && pathname === "/events") {
      return await handleGetEvents(url, req, res);
    }

    if (req.method === "POST" && pathname === "/events") {
      return await handleCreateEvent(req, res);
    }

    const eventMatch = pathname.match(/^\/events\/(\d+)$/);
    if (eventMatch && req.method === "PUT") {
      return await handleUpdateEvent(eventMatch[1], req, res);
    }
    if (eventMatch && req.method === "DELETE") {
      return await handleDeleteEvent(eventMatch[1], req, res);
    }

    if (req.method === "GET" && pathname === "/quests") {
      return await handleGetQuests(url, req, res);
    }

    if (req.method === "POST" && pathname === "/quests") {
      return await handleCreateQuest(req, res);
    }

    const questMatch = pathname.match(/^\/quests\/(\d+)$/);
    if (questMatch && req.method === "PUT") {
      return await handleUpdateQuest(questMatch[1], req, res);
    }
    if (questMatch && req.method === "DELETE") {
      return await handleDeleteQuest(questMatch[1], req, res);
    }

    if (req.method === "GET" && pathname === "/social-sections") {
      return await handleGetSocialSections(req, res);
    }

    if (req.method === "POST" && pathname === "/social-sections") {
      return await handleCreateSocialSection(req, res);
    }

    const socialSectionMatch = pathname.match(/^\/social-sections\/(\d+)$/);
    if (socialSectionMatch && req.method === "PUT") {
      return await handleUpdateSocialSection(socialSectionMatch[1], req, res);
    }
    if (socialSectionMatch && req.method === "DELETE") {
      return await handleDeleteSocialSection(socialSectionMatch[1], req, res);
    }

    if (req.method === "GET" && pathname === "/social-items") {
      return await handleGetSocialItems(req, url, res);
    }

    if (req.method === "POST" && pathname === "/social-items") {
      return await handleCreateSocialItem(req, res);
    }

    const socialItemMatch = pathname.match(/^\/social-items\/(\d+)$/);
    if (socialItemMatch && req.method === "PUT") {
      return await handleUpdateSocialItem(socialItemMatch[1], req, res);
    }
    if (socialItemMatch && req.method === "DELETE") {
      return await handleDeleteSocialItem(socialItemMatch[1], req, res);
    }

    if (req.method === "GET" && pathname === "/admin/assignable-users") {
      return await handleGetAssignableUsers(req, res);
    }

    if (req.method === "POST" && pathname === "/admin/event-admins") {
      return await handleAssignEventAdmins(req, res);
    }

    return respond(res, 404, { error: "Not found." });
  } catch (error) {
    requestLogger.error("Unhandled request error", { err: String(error), stack: error?.stack });
    return respond(res, 500, { error: "Internal server error." });
  }
}

async function handleEventAccess(req, url, res) {
  const eventId = toPositiveInteger(url.searchParams.get("eventId"));
  if (!eventId) return respond(res, 400, { error: "eventId must be a positive integer." });

  const event = await loadEventById(eventId);
  if (!event) return respond(res, 404, { exists: false, isActive: false });

  return respond(res, 200, {
    exists: true,
    isActive: event.is_active === true,
    storyModeEnabled: event.story_mode_enabled !== false,
  });
}

async function handleGetEvents(url, req, res) {
  const requestedEventId = url.searchParams.get("eventId");
  if (requestedEventId !== null) {
    const eventId = toPositiveInteger(requestedEventId);
    if (!eventId) return respond(res, 400, { error: "eventId must be a positive integer." });

    const event = await loadEventById(eventId);
    if (!event) return respond(res, 404, { error: "Event not found." });

    const session = await requireEventAccess(req, res, eventId);
    if (!session) return;

    return respond(res, 200, { event });
  }

  const session = await requireAdmin(req, res);
  if (!session) return;

  let events = [];
  if (session.role === "superadmin") {
    events = await loadAllEvents();
  } else {
    const eventIds = await loadAssignedEventIds(session.userId);
    if (eventIds.length > 0) {
      const { data, error } = await admin.from("events").select(EVENT_FIELDS).in("id", eventIds);
      if (error) throw error;
      events = sortEvents(data ?? []);
    }
  }

  return respond(res, 200, { events });
}

async function handleCreateEvent(req, res) {
  const session = await requireAdmin(req, res, { superadminOnly: true });
  if (!session) return;

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return respond(res, 400, { error: "Invalid JSON payload." });
  }

  const name = normalizeRequiredText(payload?.name, 160);
  if (!name) return respond(res, 400, { error: "Event name is required." });

  const startDate = normalizeOptionalDate(payload?.start_date ?? payload?.startDate);
  const endDate = normalizeOptionalDate(payload?.end_date ?? payload?.endDate);
  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    return respond(res, 400, { error: "End date cannot be before start date." });
  }

  const nameConflict = await findEventNameConflict(name);
  if (nameConflict) {
    return respond(res, 409, { error: "An event with this name already exists." });
  }

  const location = normalizeOptionalText(payload?.location, 255);
  const isActive = getBoolean(payload, "isActive", "is_active");
  const storyModeEnabled = getBoolean(payload, "storyModeEnabled", "story_mode_enabled");

  const { data, error } = await admin
    .from("events")
    .insert({
      name,
      location,
      start_date: startDate,
      end_date: endDate,
      is_active: isActive === undefined ? true : isActive,
      story_mode_enabled: storyModeEnabled === undefined ? true : storyModeEnabled,
    })
    .select(EVENT_FIELDS)
    .single();

  if (error) {
    getRequestLogger(req).error("create event failed", { err: String(error), actor: session.userId });
    return respond(res, 500, { error: "Could not create event." });
  }

  return respond(res, 201, { event: data });
}

async function handleUpdateEvent(eventIdValue, req, res) {
  const eventId = toPositiveInteger(eventIdValue);
  if (!eventId) return respond(res, 400, { error: "Invalid event ID." });

  const existingEvent = await loadEventById(eventId);
  if (!existingEvent) return respond(res, 404, { error: "Event not found." });

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return respond(res, 400, { error: "Invalid JSON payload." });
  }

  const wantsStoryModeChange =
    hasOwn(payload, "storyModeEnabled") || hasOwn(payload, "story_mode_enabled");

  const session = await requireEventAccess(req, res, eventId, {
    superadminOnly: wantsStoryModeChange,
  });
  if (!session) return;

  const updates = {};

  if (hasOwn(payload, "name")) {
    const name = normalizeRequiredText(payload.name, 160);
    if (!name) return respond(res, 400, { error: "Event name cannot be empty." });

    const nameConflict = await findEventNameConflict(name, eventId);
    if (nameConflict) {
      return respond(res, 409, { error: "An event with this name already exists." });
    }
    updates.name = name;
  }

  if (hasOwn(payload, "location")) {
    const location = normalizeOptionalText(payload.location, 255);
    if (!location) return respond(res, 400, { error: "Location cannot be empty." });
    updates.location = location;
  }

  if (hasOwn(payload, "start_date") || hasOwn(payload, "startDate")) {
    updates.start_date = normalizeOptionalDate(payload.start_date ?? payload.startDate);
  }

  if (hasOwn(payload, "end_date") || hasOwn(payload, "endDate")) {
    updates.end_date = normalizeOptionalDate(payload.end_date ?? payload.endDate);
  }

  const nextIsActive = getBoolean(payload, "isActive", "is_active");
  if (nextIsActive === null) {
    return respond(res, 400, { error: "isActive must be a boolean." });
  }
  if (nextIsActive !== undefined) {
    updates.is_active = nextIsActive;
  }

  const nextStoryMode = getBoolean(payload, "storyModeEnabled", "story_mode_enabled");
  if (nextStoryMode === null) {
    return respond(res, 400, { error: "storyModeEnabled must be a boolean." });
  }
  if (nextStoryMode !== undefined) {
    updates.story_mode_enabled = nextStoryMode;
  }

  if (Object.keys(updates).length === 0) {
    return respond(res, 400, { error: "No event fields provided." });
  }

  const effectiveStartDate = hasOwn(updates, "start_date") ? updates.start_date : existingEvent.start_date;
  const effectiveEndDate = hasOwn(updates, "end_date") ? updates.end_date : existingEvent.end_date;
  if (effectiveStartDate && effectiveEndDate && new Date(effectiveEndDate) < new Date(effectiveStartDate)) {
    return respond(res, 400, { error: "End date cannot be before start date." });
  }

  const { data, error } = await admin
    .from("events")
    .update(updates)
    .eq("id", eventId)
    .select(EVENT_FIELDS)
    .single();

  if (error || !data) {
    getRequestLogger(req).error("update event failed", { err: String(error), eventId, actor: session.userId });
    return respond(res, 500, { error: "Could not update event." });
  }

  return respond(res, 200, { event: data });
}

async function handleDeleteEvent(eventIdValue, req, res) {
  const eventId = toPositiveInteger(eventIdValue);
  if (!eventId) return respond(res, 400, { error: "Invalid event ID." });

  const existingEvent = await loadEventById(eventId);
  if (!existingEvent) return respond(res, 404, { error: "Event not found." });

  const session = await requireAdmin(req, res, { superadminOnly: true });
  if (!session) return;

  const { data: deletedRows, error } = await admin
    .from("events")
    .delete()
    .eq("id", eventId)
    .select("id");

  if (error) {
    getRequestLogger(req).error("delete event failed", { err: String(error), eventId, actor: session.userId });
    return respond(res, 500, { error: "Could not delete event." });
  }

  if (!deletedRows || deletedRows.length === 0) {
    return respond(res, 404, { error: "Event not found." });
  }

  return respond(res, 200, { deleted: true });
}

async function handleGetQuests(url, req, res) {
  const eventId = toPositiveInteger(url.searchParams.get("eventId"));
  if (!eventId) return respond(res, 400, { error: "eventId must be a positive integer." });

  const session = await requireEventAccess(req, res, eventId);
  if (!session) return;

  const { data, error } = await admin
    .from("quest")
    .select(QUEST_FIELDS)
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) {
    getRequestLogger(req).error("list quests failed", { err: String(error), eventId, actor: session.userId });
    return respond(res, 500, { error: "Could not load quests." });
  }

  return respond(res, 200, { quests: sortQuests(data ?? []) });
}

async function handleCreateQuest(req, res) {
  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return respond(res, 400, { error: "Invalid JSON payload." });
  }

  const eventId = toPositiveInteger(payload?.eventId ?? payload?.event_id);
  if (!eventId) return respond(res, 400, { error: "eventId must be a positive integer." });

  const session = await requireEventAccess(req, res, eventId);
  if (!session) return;

  const title = normalizeRequiredText(payload?.title, 160);
  if (!title) return respond(res, 400, { error: "Quest title cannot be empty." });

  const pin = normalizePin(payload?.pin);
  if (!pin) return respond(res, 400, { error: "PIN is required." });
  if (!PIN_PATTERN.test(pin)) return respond(res, 400, { error: "PIN must be 1-6 digits." });

  const isActive = getBoolean(payload, "isActive", "is_active");
  if (isActive === null) return respond(res, 400, { error: "isActive must be a boolean." });

  const { data, error } = await admin
    .from("quest")
    .insert({
      event_id: eventId,
      title,
      description: normalizeOptionalText(payload?.description, 2000) ?? "",
      pin,
      is_active: isActive === undefined ? true : isActive,
    })
    .select(QUEST_FIELDS)
    .single();

  if (error) {
    getRequestLogger(req).error("create quest failed", { err: String(error), eventId, actor: session.userId });
    return respond(res, 500, { error: "Could not create quest." });
  }

  return respond(res, 201, { quest: data });
}

async function handleUpdateQuest(questIdValue, req, res) {
  const questId = toPositiveInteger(questIdValue);
  if (!questId) return respond(res, 400, { error: "Invalid quest ID." });

  const existingQuest = await loadQuestById(questId);
  if (!existingQuest) return respond(res, 404, { error: "Quest not found." });

  const session = await requireEventAccess(req, res, existingQuest.event_id);
  if (!session) return;

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return respond(res, 400, { error: "Invalid JSON payload." });
  }

  const updates = {};

  if (hasOwn(payload, "title")) {
    const title = normalizeRequiredText(payload.title, 160);
    if (!title) return respond(res, 400, { error: "Quest title cannot be empty." });
    updates.title = title;
  }

  if (hasOwn(payload, "description")) {
    updates.description = normalizeOptionalText(payload.description, 2000) ?? "";
  }

  if (hasOwn(payload, "pin")) {
    const pin = payload.pin === null ? null : normalizePin(payload.pin);
    if (pin !== null && pin !== "" && !PIN_PATTERN.test(pin)) {
      return respond(res, 400, { error: "PIN must be 1-6 digits." });
    }
    updates.pin = pin || null;
  }

  const nextIsActive = getBoolean(payload, "isActive", "is_active");
  if (nextIsActive === null) {
    return respond(res, 400, { error: "isActive must be a boolean." });
  }
  if (nextIsActive !== undefined) {
    updates.is_active = nextIsActive;
  }

  if (Object.keys(updates).length === 0) {
    return respond(res, 400, { error: "No quest fields provided." });
  }

  const effectivePin = hasOwn(updates, "pin") ? updates.pin : existingQuest.pin;
  const effectiveIsActive = hasOwn(updates, "is_active") ? updates.is_active : existingQuest.is_active !== false;

  if (effectiveIsActive && !PIN_PATTERN.test(String(effectivePin || ""))) {
    return respond(res, 400, { error: "Active quests require a PIN of 1-6 digits." });
  }

  const { data, error } = await admin
    .from("quest")
    .update(updates)
    .eq("id", questId)
    .select(QUEST_FIELDS)
    .single();

  if (error || !data) {
    getRequestLogger(req).error("update quest failed", { err: String(error), questId, actor: session.userId });
    return respond(res, 500, { error: "Could not update quest." });
  }

  return respond(res, 200, { quest: data });
}

async function handleDeleteQuest(questIdValue, req, res) {
  const questId = toPositiveInteger(questIdValue);
  if (!questId) return respond(res, 400, { error: "Invalid quest ID." });

  const existingQuest = await loadQuestById(questId);
  if (!existingQuest) return respond(res, 404, { error: "Quest not found." });

  const session = await requireEventAccess(req, res, existingQuest.event_id);
  if (!session) return;

  const { data: deletedRows, error } = await admin
    .from("quest")
    .delete()
    .eq("id", questId)
    .select("id");

  if (error) {
    getRequestLogger(req).error("delete quest failed", { err: String(error), questId, actor: session.userId });
    return respond(res, 500, { error: "Could not delete quest." });
  }

  if (!deletedRows || deletedRows.length === 0) {
    return respond(res, 404, { error: "Quest not found." });
  }

  return respond(res, 200, { deleted: true });
}

async function handleGetSocialSections(req, res) {
  const { data, error } = await admin
    .from("social_sections")
    .select(SOCIAL_SECTION_FIELDS)
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    getRequestLogger(req).error("list social sections failed", { err: String(error) });
    return respond(res, 500, { error: "Could not load social sections." });
  }

  return respond(res, 200, { sections: sortSocialSections(data ?? []) });
}

async function handleCreateSocialSection(req, res) {
  const session = await requireAdmin(req, res, { superadminOnly: true });
  if (!session) return;

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return respond(res, 400, { error: "Invalid JSON payload." });
  }

  const title = normalizeRequiredText(payload?.title, 160);
  if (!title) return respond(res, 400, { error: "Title is required." });

  let displayOrder = toPositiveInteger(payload?.displayOrder ?? payload?.display_order);
  if (!displayOrder) {
    const sections = await loadAllSocialSections();
    const maxOrder = sections.reduce((max, section) => Math.max(max, Number(section.display_order) || 0), 0);
    displayOrder = maxOrder + 1;
  }

  const { data, error } = await admin
    .from("social_sections")
    .insert({ title, display_order: displayOrder })
    .select(SOCIAL_SECTION_FIELDS)
    .single();

  if (error) {
    getRequestLogger(req).error("create social section failed", { err: String(error), actor: session.userId });
    return respond(res, 500, { error: "Could not create social section." });
  }

  return respond(res, 201, { section: data });
}

async function handleUpdateSocialSection(sectionIdValue, req, res) {
  const sectionId = toPositiveInteger(sectionIdValue);
  if (!sectionId) return respond(res, 400, { error: "Invalid section ID." });

  const session = await requireAdmin(req, res, { superadminOnly: true });
  if (!session) return;

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return respond(res, 400, { error: "Invalid JSON payload." });
  }

  const updates = {};
  if (hasOwn(payload, "title")) {
    const title = normalizeRequiredText(payload.title, 160);
    if (!title) return respond(res, 400, { error: "Title is required." });
    updates.title = title;
  }

  if (hasOwn(payload, "displayOrder") || hasOwn(payload, "display_order")) {
    const displayOrder = toPositiveInteger(payload.displayOrder ?? payload.display_order);
    if (!displayOrder) return respond(res, 400, { error: "displayOrder must be a positive integer." });
    updates.display_order = displayOrder;
  }

  if (Object.keys(updates).length === 0) {
    return respond(res, 400, { error: "No section fields provided." });
  }

  const { data, error } = await admin
    .from("social_sections")
    .update(updates)
    .eq("id", sectionId)
    .select(SOCIAL_SECTION_FIELDS)
    .single();

  if (error || !data) {
    getRequestLogger(req).error("update social section failed", { err: String(error), sectionId, actor: session.userId });
    return respond(res, 500, { error: "Could not update social section." });
  }

  return respond(res, 200, { section: data });
}

async function handleDeleteSocialSection(sectionIdValue, req, res) {
  const sectionId = toPositiveInteger(sectionIdValue);
  if (!sectionId) return respond(res, 400, { error: "Invalid section ID." });

  const session = await requireAdmin(req, res, { superadminOnly: true });
  if (!session) return;

  const { error: deleteItemsError } = await admin
    .from("social_items")
    .delete()
    .eq("section_id", sectionId);

  if (deleteItemsError) {
    getRequestLogger(req).error("delete social section items failed", {
      err: String(deleteItemsError),
      sectionId,
      actor: session.userId,
    });
    return respond(res, 500, { error: "Could not delete social section." });
  }

  const { data: deletedRows, error } = await admin
    .from("social_sections")
    .delete()
    .eq("id", sectionId)
    .select("id");

  if (error) {
    getRequestLogger(req).error("delete social section failed", { err: String(error), sectionId, actor: session.userId });
    return respond(res, 500, { error: "Could not delete social section." });
  }

  if (!deletedRows || deletedRows.length === 0) {
    return respond(res, 404, { error: "Section not found." });
  }

  return respond(res, 200, { deleted: true });
}

async function handleGetSocialItems(req, url, res) {
  const sectionId = toPositiveInteger(url.searchParams.get("sectionId"));

  let query = admin.from("social_items").select(SOCIAL_ITEM_FIELDS).order("id", { ascending: true });
  if (sectionId) query = query.eq("section_id", sectionId);

  const { data, error } = await query;
  if (error) {
    getRequestLogger(req).error("list social items failed", { err: String(error), sectionId });
    return respond(res, 500, { error: "Could not load social items." });
  }

  return respond(res, 200, { items: sortSocialItems(data ?? []) });
}

async function handleCreateSocialItem(req, res) {
  const session = await requireAdmin(req, res, { superadminOnly: true });
  if (!session) return;

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return respond(res, 400, { error: "Invalid JSON payload." });
  }

  const sectionId = toPositiveInteger(payload?.sectionId ?? payload?.section_id);
  if (!sectionId) return respond(res, 400, { error: "sectionId must be a positive integer." });

  const title = normalizeRequiredText(payload?.title, 160);
  const url = normalizeRequiredText(payload?.url, 2048);
  if (!title || !url) return respond(res, 400, { error: "Title and URL are required." });

  const { data, error } = await admin
    .from("social_items")
    .insert({
      section_id: sectionId,
      title,
      detail: normalizeOptionalText(payload?.detail, 1000) ?? "",
      url,
    })
    .select(SOCIAL_ITEM_FIELDS)
    .single();

  if (error) {
    getRequestLogger(req).error("create social item failed", { err: String(error), actor: session.userId });
    return respond(res, 500, { error: "Could not create social item." });
  }

  return respond(res, 201, { item: data });
}

async function handleUpdateSocialItem(itemIdValue, req, res) {
  const itemId = toPositiveInteger(itemIdValue);
  if (!itemId) return respond(res, 400, { error: "Invalid item ID." });

  const session = await requireAdmin(req, res, { superadminOnly: true });
  if (!session) return;

  const existingItem = await loadSocialItemById(itemId);
  if (!existingItem) return respond(res, 404, { error: "Item not found." });

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return respond(res, 400, { error: "Invalid JSON payload." });
  }

  const updates = {};

  if (hasOwn(payload, "sectionId") || hasOwn(payload, "section_id")) {
    const sectionId = toPositiveInteger(payload.sectionId ?? payload.section_id);
    if (!sectionId) return respond(res, 400, { error: "sectionId must be a positive integer." });
    updates.section_id = sectionId;
  }

  if (hasOwn(payload, "title")) {
    const title = normalizeRequiredText(payload.title, 160);
    if (!title) return respond(res, 400, { error: "Title is required." });
    updates.title = title;
  }

  if (hasOwn(payload, "detail")) {
    updates.detail = normalizeOptionalText(payload.detail, 1000) ?? "";
  }

  if (hasOwn(payload, "url")) {
    const url = normalizeRequiredText(payload.url, 2048);
    if (!url) return respond(res, 400, { error: "URL is required." });
    updates.url = url;
  }

  if (Object.keys(updates).length === 0) {
    return respond(res, 400, { error: "No item fields provided." });
  }

  const effectiveTitle = hasOwn(updates, "title") ? updates.title : existingItem.title;
  const effectiveUrl = hasOwn(updates, "url") ? updates.url : existingItem.url;
  if (!effectiveTitle || !effectiveUrl) {
    return respond(res, 400, { error: "Title and URL are required." });
  }

  const { data, error } = await admin
    .from("social_items")
    .update(updates)
    .eq("id", itemId)
    .select(SOCIAL_ITEM_FIELDS)
    .single();

  if (error || !data) {
    getRequestLogger(req).error("update social item failed", { err: String(error), itemId, actor: session.userId });
    return respond(res, 500, { error: "Could not update social item." });
  }

  return respond(res, 200, { item: data });
}

async function handleDeleteSocialItem(itemIdValue, req, res) {
  const itemId = toPositiveInteger(itemIdValue);
  if (!itemId) return respond(res, 400, { error: "Invalid item ID." });

  const session = await requireAdmin(req, res, { superadminOnly: true });
  if (!session) return;

  const { data: deletedRows, error } = await admin
    .from("social_items")
    .delete()
    .eq("id", itemId)
    .select("id");

  if (error) {
    getRequestLogger(req).error("delete social item failed", { err: String(error), itemId, actor: session.userId });
    return respond(res, 500, { error: "Could not delete social item." });
  }

  if (!deletedRows || deletedRows.length === 0) {
    return respond(res, 404, { error: "Item not found." });
  }

  return respond(res, 200, { deleted: true });
}

async function handleGetAssignableUsers(req, res) {
  const session = await requireAdmin(req, res, { superadminOnly: true });
  if (!session) return;

  try {
    const users = await loadAssignableUsers();
    return respond(res, 200, { users });
  } catch (error) {
    getRequestLogger(req).error("load assignable users failed", {
      err: error?.message || String(error),
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      actor: session.userId,
    });
    return respond(res, 500, { error: "Could not load assignable users." });
  }
}

async function handleAssignEventAdmins(req, res) {
  const session = await requireAdmin(req, res, { superadminOnly: true });
  if (!session) return;

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return respond(res, 400, { error: "Invalid JSON payload." });
  }

  const email = normalizeRequiredText(payload?.email, 320).toLowerCase();
  if (!email) return respond(res, 400, { error: "Admin email is required." });

  const eventIds = [...new Set(
    (Array.isArray(payload?.eventIds) ? payload.eventIds : [])
      .map((value) => toPositiveInteger(value))
      .filter(Boolean)
  )];

  if (eventIds.length === 0) {
    return respond(res, 400, { error: "Select at least one event." });
  }

  try {
    const targetUser = await loadAuthUserByEmail(email);
    if (!targetUser?.id) {
      return respond(res, 404, { error: "User not found." });
    }

    const existingEvents = await loadEventsByIds(eventIds);
    if (existingEvents.length !== eventIds.length) {
      return respond(res, 404, { error: "One or more selected events were not found." });
    }

    const existingRole = await loadUserRole(targetUser.id);
    if (existingRole === "superadmin") {
      return respond(res, 400, { error: "Cannot reassign a superadmin." });
    }

    await ensureAdminRole(targetUser.id, existingRole);
    await assignEventsToAdmin(targetUser.id, eventIds);
  } catch (error) {
    getRequestLogger(req).error("assign admin by email failed", {
      err: error?.message || String(error),
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      actor: session.userId,
      email,
      eventIds,
    });
    return respond(res, 400, { error: error?.message || "Could not assign admin." });
  }

  return respond(res, 200, { assigned: true });
}

async function requireAdmin(req, res, options = {}) {
  const userId = await authenticateRequest(req, res);
  if (!userId) return null;

  const role = await loadUserRole(userId);
  if (role !== "admin" && role !== "superadmin") {
    respond(res, 403, { error: "Insufficient permissions." });
    return null;
  }

  if (options.superadminOnly && role !== "superadmin") {
    respond(res, 403, { error: "Insufficient permissions." });
    return null;
  }

  return { userId, role };
}

async function requireEventAccess(req, res, eventId, options = {}) {
  const session = await requireAdmin(req, res, options);
  if (!session) return null;
  if (session.role === "superadmin") return session;

  const { data: assignmentRow, error } = await admin
    .from("event_admins")
    .select("event_id")
    .eq("user_id", session.userId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) throw error;
  if (!assignmentRow) {
    respond(res, 403, { error: "No access to this event." });
    return null;
  }

  return session;
}

async function authenticateRequest(req, res) {
  const bearerToken = parseBearerToken(req);
  if (!bearerToken) {
    respond(res, 401, { error: "Missing authorization token." });
    return null;
  }

  const { data: authData, error } = await admin.auth.getUser(bearerToken);
  if (error || !authData?.user?.id) {
    respond(res, 401, { error: "Invalid token." });
    return null;
  }

  return authData.user.id;
}

async function loadUserRole(userId) {
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return String(data?.role || "");
}

async function loadAssignedEventIds(userId) {
  const { data, error } = await admin
    .from("event_admins")
    .select("event_id")
    .eq("user_id", userId);

  if (error) throw error;
  return [...new Set((data ?? []).map((row) => toPositiveInteger(row?.event_id)).filter(Boolean))];
}

async function loadEventsByIds(eventIds) {
  if (!Array.isArray(eventIds) || eventIds.length === 0) return [];

  const { data, error } = await admin
    .from("events")
    .select(EVENT_FIELDS)
    .in("id", eventIds);

  if (error) throw error;
  return sortEvents(data ?? []);
}

async function loadAllEvents() {
  const { data, error } = await admin
    .from("events")
    .select(EVENT_FIELDS)
    .order("start_date", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return sortEvents(data ?? []);
}

async function loadEventById(eventId) {
  const { data, error } = await admin
    .from("events")
    .select(EVENT_FIELDS)
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

async function loadQuestById(questId) {
  const { data, error } = await admin
    .from("quest")
    .select(QUEST_FIELDS)
    .eq("id", questId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

async function loadSocialItemById(itemId) {
  const { data, error } = await admin
    .from("social_items")
    .select(SOCIAL_ITEM_FIELDS)
    .eq("id", itemId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

async function loadAllSocialSections() {
  const { data, error } = await admin
    .from("social_sections")
    .select(SOCIAL_SECTION_FIELDS)
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return sortSocialSections(data ?? []);
}

async function loadAllUserRoles() {
  const { data, error } = await admin
    .from("user_roles")
    .select("user_id, role");

  if (error) throw error;
  return data ?? [];
}

async function loadAllAuthUsers() {
  const perPage = 1000;
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const batch = data?.users ?? [];
    users.push(...batch);

    if (batch.length < perPage || page >= (data?.lastPage ?? page)) {
      break;
    }

    page += 1;
  }

  return users;
}

async function loadAssignableUsers() {
  const [authUsers, roleRows] = await Promise.all([
    loadAllAuthUsers(),
    loadAllUserRoles(),
  ]);

  const roleByUserId = new Map(
    roleRows.map((row) => [String(row.user_id), String(row.role || "")])
  );

  return [...new Set(
    authUsers
      .filter((user) => roleByUserId.get(String(user?.id)) !== "superadmin")
      .map((user) => normalizeOptionalText(user?.email, 320))
      .filter(Boolean)
      .map((email) => email.toLowerCase())
  )].sort((a, b) => a.localeCompare(b));
}

async function loadAuthUserByEmail(email) {
  const normalizedEmail = normalizeRequiredText(email, 320).toLowerCase();
  if (!normalizedEmail) return null;

  const users = await loadAllAuthUsers();
  return users.find((user) => String(user?.email || "").trim().toLowerCase() === normalizedEmail) ?? null;
}

async function ensureAdminRole(userId, existingRole = "") {
  if (!userId) throw new Error("Missing user ID.");
  if (existingRole === "admin") return;

  if (existingRole) {
    const { error } = await admin
      .from("user_roles")
      .update({ role: "admin" })
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }

  const { error } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: "admin" });

  if (error) throw error;
}

async function assignEventsToAdmin(userId, eventIds) {
  if (!userId || !Array.isArray(eventIds) || eventIds.length === 0) return;

  const { data, error } = await admin
    .from("event_admins")
    .select("event_id")
    .eq("user_id", userId)
    .in("event_id", eventIds);

  if (error) throw error;

  const existingEventIds = new Set(
    (data ?? []).map((row) => toPositiveInteger(row?.event_id)).filter(Boolean)
  );

  const missingAssignments = eventIds
    .filter((eventId) => !existingEventIds.has(eventId))
    .map((eventId) => ({ user_id: userId, event_id: eventId }));

  if (missingAssignments.length === 0) return;

  const { error: insertError } = await admin
    .from("event_admins")
    .insert(missingAssignments);

  if (insertError) throw insertError;
}

async function findEventNameConflict(name, excludeId = null) {
  const events = await loadAllEvents();
  const normalized = name.trim().toLowerCase();
  return events.find((event) => {
    if (!event?.name) return false;
    if (excludeId && Number(event.id) === Number(excludeId)) return false;
    return String(event.name).trim().toLowerCase() === normalized;
  }) ?? null;
}

function respond(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(handleRequest);
if (!process.env.NODE_TEST_CONTEXT) {
  server.listen(PORT, () => logger.info("service listening", { service: SERVICE_NAME, port: PORT }));
}

export { handleRequest, server };
