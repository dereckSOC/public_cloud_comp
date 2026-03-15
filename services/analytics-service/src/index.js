/**
 * analytics-service — backend service for booth tracking and response analytics.
 *
 * Replaces direct Supabase queries and heavy client-side computation.
 * Exposes:
 *   GET  /health
 *   POST /booth-complete
 *   GET  /booth-metrics?eventId=<n>
 *   GET  /analytics?eventId=<n>
 */

import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";
import { createServer } from "http";
import logger from "@psd/shared/lib/logger.js";

const PORT = process.env.PORT ?? 4002;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_DB_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SERVICE_NAME = "analytics-service";

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

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDurationMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0s";
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  return `${minutes.toFixed(1)} min`;
}

function formatRelativeTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Just now";
  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function buildDateBuckets(days) {
  const buckets = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);
    buckets.push({ key: date.toISOString().slice(0, 10), date });
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

async function handleRequest(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const requestLogger = attachRequestLogger(req, res, pathname);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID");
  if (req.method === "OPTIONS") return respond(res, 204, "");

  try {
    if (req.method === "GET" && pathname === "/health") {
      return respond(res, 200, { status: "ok", service: "analytics-service" });
    }

    if (req.method === "POST" && pathname === "/device-entry") {
      return await handleDeviceEntry(req, res);
    }

    if (req.method === "POST" && pathname === "/booth-complete") {
      return await handleBoothComplete(req, res);
    }

    if (req.method === "GET" && pathname === "/booth-metrics") {
      return await handleBoothMetrics(url, req, res);
    }

    if (req.method === "GET" && pathname === "/analytics") {
      return await handleAnalytics(req, url, res);
    }

    return respond(res, 404, { error: "Not found." });
  } catch (err) {
    requestLogger.error("Unhandled request error", { err: String(err), stack: err?.stack });
    return respond(res, 500, { error: "Internal server error." });
  }
}

// ---------------------------------------------------------------------------
// POST /device-entry
// ---------------------------------------------------------------------------

async function handleDeviceEntry(req, res) {
  const visitorId = parseCookie(req.headers.cookie, "visitor_id");
  if (!visitorId) return respond(res, 400, { error: "Missing visitor cookie." });

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return respond(res, 400, { error: "Invalid JSON payload." });
  }

  const eventId = toPositiveInteger(payload?.eventId);
  if (!eventId) return respond(res, 400, { error: "eventId must be a positive integer." });

  const source = typeof payload?.source === "string" ? payload.source.trim().slice(0, 64) || null : null;
  const lang = typeof payload?.lang === "string" ? payload.lang.trim().slice(0, 16) || null : null;
  const ua = req.headers["user-agent"] || "";
  const userAgentHash = ua ? createHash("sha256").update(ua).digest("hex") : null;

  const { data: eventRow, error: eventError } = await admin
    .from("events").select("id").eq("id", eventId).maybeSingle();
  if (eventError) {
    getRequestLogger(req).error("device-entry event lookup failed", { err: String(eventError) });
    return respond(res, 500, { error: "Could not record device entry." });
  }
  if (!eventRow) return respond(res, 404, { error: "Event not found." });

  const { error: insertError } = await admin
    .from("event_device_entries")
    .insert({ event_id: eventId, visitor_id: visitorId, source, lang, user_agent_hash: userAgentHash });

  if (!insertError) {
    getRequestLogger(req).info("device entry recorded", { eventId, visitorId });
    return respond(res, 200, { counted: true });
  }
  if (insertError.code === "23505") return respond(res, 200, { counted: false });

  getRequestLogger(req).error("device-entry insert failed", { err: String(insertError) });
  return respond(res, 500, { error: "Could not record device entry." });
}

// ---------------------------------------------------------------------------
// POST /booth-complete
// ---------------------------------------------------------------------------

async function handleBoothComplete(req, res) {
  const visitorId = parseCookie(req.headers.cookie, "visitor_id");
  if (!visitorId) return respond(res, 400, { error: "Missing visitor cookie." });

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return respond(res, 400, { error: "Invalid JSON payload." });
  }

  const eventId = toPositiveInteger(payload?.eventId);
  const questId = toPositiveInteger(payload?.questId);
  const method = typeof payload?.method === "string" ? payload.method.trim() : "";

  if (!eventId) return respond(res, 400, { error: "eventId must be a positive integer." });
  if (!questId) return respond(res, 400, { error: "questId must be a positive integer." });
  if (method !== "pin") return respond(res, 400, { error: "method must be 'pin'." });

  const { data: questRow, error: questError } = await admin
    .from("quest")
    .select("id, event_id, is_active")
    .eq("id", questId)
    .maybeSingle();

  if (questError) {
    getRequestLogger(req).error("booth-complete quest lookup failed", { err: String(questError) });
    return respond(res, 500, { error: "Could not record booth completion." });
  }
  if (!questRow) return respond(res, 404, { error: "Quest not found." });
  if (Number(questRow.event_id) !== eventId) return respond(res, 400, { error: "questId does not belong to eventId." });
  if (questRow.is_active === false) return respond(res, 409, { error: "Quest is inactive." });

  const { error: insertError } = await admin
    .from("booth_completions")
    .insert({ event_id: eventId, quest_id: questId, visitor_id: visitorId, method });

  if (!insertError) {
    getRequestLogger(req).info("booth completion recorded", { eventId, questId, visitorId });
    return respond(res, 200, { counted: true });
  }
  if (insertError.code === "23505") return respond(res, 200, { counted: false });

  getRequestLogger(req).error("booth-complete insert failed", { err: String(insertError) });
  return respond(res, 500, { error: "Could not record booth completion." });
}

// ---------------------------------------------------------------------------
// GET /booth-metrics?eventId=<n>
// ---------------------------------------------------------------------------

async function handleBoothMetrics(url, req, res) {
  const eventId = toPositiveInteger(url.searchParams.get("eventId"));
  if (!eventId) return respond(res, 400, { error: "eventId must be a positive integer." });

  // Auth check — require Bearer token
  const bearerToken = parseBearerToken(req);
  if (!bearerToken) return respond(res, 401, { error: "Missing authorization token." });

  const { data: authData, error: authError } = await admin.auth.getUser(bearerToken);
  if (authError || !authData?.user?.id) return respond(res, 401, { error: "Invalid token." });

  const accessCheck = await assertCanAccessEvent(admin, authData.user.id, eventId);
  if (!accessCheck.ok) return respond(res, accessCheck.status, { error: accessCheck.error });

  // Fetch quests
  const { data: questRows, error: questError } = await admin
    .from("quest")
    .select("id, title, is_active, created_at")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (questError) {
    getRequestLogger(req).error("booth-metrics quest fetch failed", { err: String(questError) });
    return respond(res, 500, { error: "Could not load booth metrics." });
  }

  // Fetch entrants
  const { data: entrantRows, error: entrantError } = await admin
    .from("event_device_entries")
    .select("visitor_id")
    .eq("event_id", eventId);
  if (entrantError) {
    getRequestLogger(req).error("booth-metrics entrant fetch failed", { err: String(entrantError) });
    return respond(res, 500, { error: "Could not load booth metrics." });
  }

  const entrantSet = new Set(
    (entrantRows ?? []).map((r) => (typeof r?.visitor_id === "string" ? r.visitor_id.trim() : "")).filter(Boolean)
  );
  const eventEntrants = entrantSet.size;

  const questIds = (questRows ?? []).map((q) => Number(q.id)).filter((id) => Number.isInteger(id) && id > 0);

  let completionRows = [];
  if (questIds.length > 0) {
    const { data, error } = await admin
      .from("booth_completions")
      .select("quest_id, visitor_id")
      .eq("event_id", eventId)
      .in("quest_id", questIds);
    if (!error) completionRows = data ?? [];
  }

  const boothCompletionRows = buildBoothMetricsRows(questRows ?? [], completionRows, eventEntrants);
  const boothCompletionAveragePct = boothCompletionRows.length > 0
    ? clampPercent(boothCompletionRows.reduce((sum, r) => sum + r.completionRatePct, 0) / boothCompletionRows.length)
    : 0;

  return respond(res, 200, { eventEntrants, boothCompletionRows, boothCompletionAveragePct });
}

function buildBoothMetricsRows(quests, completionRows, eventEntrants) {
  const completionsByQuest = new Map();
  (completionRows ?? []).forEach((row) => {
    const questId = Number(row?.quest_id);
    const visitorId = typeof row?.visitor_id === "string" ? row.visitor_id.trim() : "";
    if (!Number.isInteger(questId) || questId <= 0 || !visitorId) return;
    const existing = completionsByQuest.get(questId) ?? new Set();
    existing.add(visitorId);
    completionsByQuest.set(questId, existing);
  });

  return (quests ?? []).map((quest) => {
    const questId = Number(quest.id);
    const completedDevices = completionsByQuest.get(questId)?.size ?? 0;
    const completionRatePct = eventEntrants > 0 ? clampPercent((completedDevices / eventEntrants) * 100) : 0;
    const title = typeof quest.title === "string" && quest.title.trim() ? quest.title.trim() : `Quest #${questId}`;
    return { questId, questTitle: title, completedDevices, entrants: eventEntrants, completionRatePct };
  });
}

async function assertCanAccessEvent(supabaseAdmin, userId, eventId) {
  const { data: roleRow, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (roleError) throw roleError;

  const role = String(roleRow?.role || "");
  if (role !== "admin" && role !== "superadmin") return { ok: false, status: 403, error: "Insufficient permissions." };
  if (role === "superadmin") return { ok: true };

  const { data: assignmentRow, error: assignmentError } = await supabaseAdmin
    .from("event_admins")
    .select("event_id")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignmentRow) return { ok: false, status: 403, error: "No access to this event." };
  return { ok: true };
}

function parseBearerToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

// ---------------------------------------------------------------------------
// GET /analytics?eventId=<n>  — full response analytics (moved from useAnalytics.js)
// ---------------------------------------------------------------------------

async function handleAnalytics(req, url, res) {
  const eventId = toPositiveInteger(url.searchParams.get("eventId"));
  if (!eventId) return respond(res, 400, { error: "eventId must be a positive integer." });

  // Fetch questions
  const { data: questionRows, error: questionError } = await admin
    .from("questions")
    .select("id, question_text, question_type, is_active, sort_order, created_at")
    .eq("event_id", eventId);
  if (questionError) {
    getRequestLogger(req).error("analytics question fetch failed", { err: String(questionError) });
    return respond(res, 500, { error: "Could not load analytics." });
  }

  const questions = Array.isArray(questionRows)
    ? questionRows
    : questionRows
      ? [questionRows]
      : [];
  const activeQuestions = questions
    .filter((q) => q.is_active !== false)
    .sort((a, b) => {
      const aO = Number(a.sort_order), bO = Number(b.sort_order);
      const aH = Number.isFinite(aO), bH = Number.isFinite(bO);
      if (aH && bH && aO !== bO) return aO - bO;
      if (aH !== bH) return aH ? -1 : 1;
      const aT = new Date(a.created_at).getTime(), bT = new Date(b.created_at).getTime();
      if (Number.isFinite(aT) && Number.isFinite(bT) && aT !== bT) return aT - bT;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });

  const totalQuestions = activeQuestions.length;

  // Fetch responses
  const { data: responseRows, error: responseError } = await admin
    .from("responses")
    .select("id, submitted_at")
    .eq("event_id", eventId)
    .order("submitted_at", { ascending: false });
  if (responseError) {
    getRequestLogger(req).error("analytics response fetch failed", { err: String(responseError) });
    return respond(res, 500, { error: "Could not load analytics." });
  }

  const responses = responseRows ?? [];
  const responseIds = responses.map((r) => r.id);

  // Fetch answers
  let answerRows = [];
  if (responseIds.length > 0) {
    const { data, error } = await admin
      .from("answers")
      .select("id, response_id, question_id, option_id, answer_text, answer_numeric, created_at")
      .in("response_id", responseIds);
    if (!error) answerRows = data ?? [];
  }

  // Fetch options
  const activeQuestionIds = activeQuestions.map((q) => q.id);
  const questionIdsWithAnswers = [...new Set(answerRows.map((a) => a.question_id).filter(Boolean))];
  const optionQuestionIds = [...new Set([...activeQuestionIds, ...questionIdsWithAnswers])];

  let optionRows = [];
  if (optionQuestionIds.length > 0) {
    const { data, error } = await admin
      .from("question_options")
      .select("id, question_id, option_text, sort_order, created_at")
      .in("question_id", optionQuestionIds);
    if (!error) optionRows = data ?? [];
  }

  // Build maps
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const optionsByQuestion = new Map();
  optionRows.forEach((opt) => {
    const arr = optionsByQuestion.get(opt.question_id) ?? [];
    arr.push(opt);
    optionsByQuestion.set(opt.question_id, arr);
  });
  optionsByQuestion.forEach((opts) => {
    opts.sort((a, b) => {
      const aO = Number(a.sort_order), bO = Number(b.sort_order);
      const aH = Number.isFinite(aO), bH = Number.isFinite(bO);
      if (aH && bH && aO !== bO) return aO - bO;
      if (aH !== bH) return aH ? -1 : 1;
      const aT = new Date(a.created_at).getTime(), bT = new Date(b.created_at).getTime();
      if (Number.isFinite(aT) && Number.isFinite(bT) && aT !== bT) return aT - bT;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });
  });

  const optionMap = new Map();
  const optionByQuestionOrder = new Map();
  optionsByQuestion.forEach((opts, qId) => {
    opts.forEach((opt, idx) => {
      const label = (opt.option_text || "").trim() || `Option ${idx + 1}`;
      optionMap.set(opt.id, label);
      const order = Number.isFinite(Number(opt.sort_order)) ? Number(opt.sort_order) : idx;
      const key = `${qId}-${order}`;
      if (!optionByQuestionOrder.has(key)) optionByQuestionOrder.set(key, label);
    });
  });

  // Group answers
  const answersByResponse = new Map();
  const answersByQuestion = new Map();
  answerRows.forEach((a) => {
    const byR = answersByResponse.get(a.response_id) ?? [];
    byR.push(a);
    answersByResponse.set(a.response_id, byR);
    const byQ = answersByQuestion.get(a.question_id) ?? [];
    byQ.push(a);
    answersByQuestion.set(a.question_id, byQ);
  });

  // Question option distributions
  const questionOptionDistributions = activeQuestions.map((question) => {
    const configuredOptions = (optionsByQuestion.get(question.id) ?? []).map((opt, idx) => ({
      ...opt, label: (opt.option_text || "").trim() || `Option ${idx + 1}`,
    }));
    const answersForQ = answersByQuestion.get(question.id) ?? [];
    const optionCountById = new Map(configuredOptions.map((o) => [o.id, 0]));
    const optionBySortOrder = new Map();
    const optionByLowerLabel = new Map();
    configuredOptions.forEach((opt, idx) => {
      const order = Number.isFinite(Number(opt.sort_order)) ? Number(opt.sort_order) : idx;
      if (!optionBySortOrder.has(order)) optionBySortOrder.set(order, opt);
      const nl = opt.label.toLowerCase();
      if (!optionByLowerLabel.has(nl)) optionByLowerLabel.set(nl, opt);
    });

    let deletedCount = 0, unmappedCount = 0;
    answersForQ.forEach((answer) => {
      const optId = Number(answer.option_id);
      if (Number.isFinite(optId) && optId > 0) {
        if (optionCountById.has(optId)) optionCountById.set(optId, (optionCountById.get(optId) ?? 0) + 1);
        else deletedCount++;
        return;
      }
      const numA = Number(answer.answer_numeric);
      if (Number.isFinite(numA)) {
        const m = optionBySortOrder.get(numA);
        if (m) optionCountById.set(m.id, (optionCountById.get(m.id) ?? 0) + 1);
        else unmappedCount++;
        return;
      }
      const txt = (answer.answer_text || "").trim();
      if (!txt) return;
      const m = optionByLowerLabel.get(txt.toLowerCase());
      if (m) optionCountById.set(m.id, (optionCountById.get(m.id) ?? 0) + 1);
      else unmappedCount++;
    });

    const slices = configuredOptions.map((opt) => ({
      id: `option-${opt.id}`, optionId: opt.id, label: opt.label,
      count: optionCountById.get(opt.id) ?? 0, bucketType: "option",
    }));
    if (deletedCount > 0) slices.push({ id: `deleted-${question.id}`, optionId: null, label: "Deleted option", count: deletedCount, bucketType: "deleted" });
    if (unmappedCount > 0) slices.push({ id: `unmapped-${question.id}`, optionId: null, label: "Other / Unmapped", count: unmappedCount, bucketType: "unmapped" });

    const totalCount = slices.reduce((s, sl) => s + sl.count, 0);
    return {
      questionId: question.id,
      questionText: question.question_text ?? `Question #${question.id}`,
      hasOptions: configuredOptions.length > 0,
      totalCount,
      totalAnswers: answersForQ.length,
      slices: slices.map((sl) => ({ ...sl, percentage: totalCount > 0 ? clampPercent((sl.count / totalCount) * 100) : 0 })),
    };
  });

  // Response stats
  const responseStats = responses.map((response) => {
    const answersForR = answersByResponse.get(response.id) ?? [];
    const uniqueQs = new Set(answersForR.map((a) => a.question_id).filter(Boolean));
    const times = answersForR.map((a) => new Date(a.created_at).getTime()).filter(Number.isFinite);
    const durationMinutes = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / 60000 : 0;
    return { responseId: response.id, submittedAt: response.submitted_at, answeredCount: uniqueQs.size, durationMinutes };
  });

  const totalResponses = responses.length;
  const completedCount = totalQuestions > 0 ? responseStats.filter((r) => r.answeredCount >= totalQuestions).length : 0;
  const partialCount = responseStats.filter((r) => r.answeredCount > 0 && r.answeredCount < totalQuestions).length;
  const abandonedCount = responseStats.filter((r) => r.answeredCount === 0).length;
  const responseRate = totalResponses > 0 ? clampPercent((completedCount / totalResponses) * 100) : 0;

  const totalAnswered = responseStats.reduce((s, r) => s + r.answeredCount, 0);
  const skipRate = totalQuestions > 0 && totalResponses > 0 ? clampPercent((1 - totalAnswered / (totalQuestions * totalResponses)) * 100) : 0;

  const durations = responseStats.map((r) => r.durationMinutes).filter(Number.isFinite);
  const averageMinutes = durations.length > 0 ? durations.reduce((s, v) => s + v, 0) / durations.length : 0;
  const fastestMinutes = durations.length > 0 ? Math.min(...durations) : 0;
  const slowestMinutes = durations.length > 0 ? Math.max(...durations) : 0;

  const detailedResponseIds = new Set();
  answerRows.forEach((a) => { if ((a.answer_text || "").trim().length >= 30) detailedResponseIds.add(a.response_id); });
  const detailedResponsesPct = totalResponses > 0 ? clampPercent((detailedResponseIds.size / totalResponses) * 100) : 0;
  const qualityScorePct = totalResponses > 0 ? clampPercent((responseRate + detailedResponsesPct) / 2) : 0;

  // Trends
  const responseDateKey = new Map();
  responses.forEach((r) => {
    if (r.submitted_at) {
      const d = new Date(r.submitted_at);
      if (Number.isFinite(d.getTime())) { responseDateKey.set(r.id, d.toISOString().slice(0, 10)); return; }
    }
    const answersForR = answersByResponse.get(r.id) ?? [];
    const times = answersForR.map((a) => new Date(a.created_at).getTime()).filter(Number.isFinite);
    if (times.length > 0) responseDateKey.set(r.id, new Date(Math.max(...times)).toISOString().slice(0, 10));
  });

  const dateBuckets = buildDateBuckets(11);
  const trendCounts = new Map();
  const ctTotals = new Map();
  const ctCounts = new Map();
  responseStats.forEach((r) => {
    const key = responseDateKey.get(r.responseId);
    if (!key) return;
    trendCounts.set(key, (trendCounts.get(key) ?? 0) + 1);
    ctTotals.set(key, (ctTotals.get(key) ?? 0) + r.durationMinutes);
    ctCounts.set(key, (ctCounts.get(key) ?? 0) + 1);
  });

  const responseTrends = dateBuckets.map((b, i) => ({ x: i, y: trendCounts.get(b.key) ?? 0 }));
  const completionTimeTrends = dateBuckets.map((b, i) => {
    const total = ctTotals.get(b.key) ?? 0;
    const count = ctCounts.get(b.key) ?? 0;
    return { x: i, y: count > 0 ? Number((total / count).toFixed(2)) : 0 };
  });

  // Recent responses
  const sortedAnswers = [...answerRows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const recentResponses = sortedAnswers.slice(0, 8).map((answer) => {
    const question = questionMap.get(answer.question_id);
    const optionText = answer.option_id ? optionMap.get(answer.option_id) : "";
    const fallbackOptionText = Number.isFinite(answer.answer_numeric)
      ? optionByQuestionOrder.get(`${answer.question_id}-${answer.answer_numeric}`) || "" : "";
    const answerText = (answer.answer_text || "").trim() || optionText || fallbackOptionText
      || (Number.isFinite(answer.answer_numeric) ? String(answer.answer_numeric) : "No answer");
    const stat = responseStats.find((r) => r.responseId === answer.response_id);
    return {
      answerId: answer.id, responseId: answer.response_id, questionId: answer.question_id,
      questionText: question?.question_text ?? `Question #${answer.question_id}`,
      answerText, durationLabel: formatDurationMinutes(stat?.durationMinutes ?? 0),
      timeAgo: formatRelativeTime(answer.created_at), createdAt: answer.created_at,
    };
  });

  const recentActivity = recentResponses.slice(0, 4).map((e) => ({
    action: `New response to "${e.questionText}"`, time: e.timeAgo,
  }));

  getRequestLogger(req).info("analytics computed", { eventId, totalResponses, totalQuestions });

  return respond(res, 200, {
    totalQuestions, totalResponses, responseRate,
    avgCompletionMinutes: averageMinutes,
    avgCompletionLabel: formatDurationMinutes(averageMinutes),
    completionStats: { completed: completedCount, partial: partialCount, abandoned: abandonedCount },
    completionTime: { averageMinutes, fastestMinutes, slowestMinutes },
    quality: { completeAnswersPct: responseRate, detailedResponsesPct, skipRatePct: skipRate, qualityScorePct },
    trends: { responseTrends, completionTimeTrends },
    questionOptionDistributions, recentResponses, recentActivity,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function respond(res, status, body) {
  if (body === "") {
    res.statusCode = status;
    res.end();
    return;
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

function parseCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v ?? "").trim() || null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export { handleRequest };

const server = createServer(handleRequest);
if (!process.env.NODE_TEST_CONTEXT) {
  server.listen(PORT, () => logger.info("service listening", { service: SERVICE_NAME, port: PORT }));
}
export { server };
