/**
 * feedback-service — backend service for feedback questions, submissions, and response export.
 *
 * Replaces direct Supabase calls from frontends.
 * Exposes:
 *   GET  /health
 *   GET  /questions?eventId=<n>
 *   POST /submit
 *   GET  /responses/export?eventId=<n>
 *   GET  /questions/manage?eventId=<n>
 *   POST /questions/manage
 *   PUT  /questions/manage/<id>
 *   DELETE /questions/manage/<id>?eventId=<n>
 *   PUT  /questions/manage/<id>/toggle
 *   POST /questions/manage/import
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { createServer } from "http";
import logger from "@psd/shared/lib/logger.js";

const PORT = process.env.PORT ?? 4001;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_DB_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SERVICE_NAME = "feedback-service";

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

function parseBearerToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

async function handleRequest(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const requestLogger = attachRequestLogger(req, res, pathname);

  // CORS for browser clients
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID");
  if (req.method === "OPTIONS") return respond(res, 204, "");

  try {
    // Health
    if (req.method === "GET" && pathname === "/health") {
      return respond(res, 200, { status: "ok", service: "feedback-service" });
    }

    // GET /questions?eventId=<n>  — public: fetch questions for feedback form
    if (req.method === "GET" && pathname === "/questions") {
      return await handleGetQuestions(req, url, res);
    }

    // POST /submit  — public: submit feedback responses
    if (req.method === "POST" && pathname === "/submit") {
      return await handleSubmitFeedback(req, res);
    }

    // GET /responses/export?eventId=<n>  — dashboard: export responses as JSON rows
    if (req.method === "GET" && pathname === "/responses/export") {
      return await handleExportResponses(req, url, res);
    }

    // --- Question management (dashboard admin) ---

    // GET /questions/manage?eventId=<n>
    if (req.method === "GET" && pathname === "/questions/manage") {
      return await handleListManagedQuestions(url, req, res);
    }

    // POST /questions/manage
    if (req.method === "POST" && pathname === "/questions/manage") {
      return await handleCreateQuestion(req, res);
    }

    // POST /questions/manage/import
    if (req.method === "POST" && pathname === "/questions/manage/import") {
      return await handleImportQuestion(req, res);
    }

    // GET /questions/manage/<id>/options
    const optionsMatch = pathname.match(/^\/questions\/manage\/(\d+)\/options$/);
    if (req.method === "GET" && optionsMatch) {
      return await handleGetQuestionOptions(optionsMatch[1], req, res);
    }

    // PUT /questions/manage/<id>/toggle
    const toggleMatch = pathname.match(/^\/questions\/manage\/(\d+)\/toggle$/);
    if (req.method === "PUT" && toggleMatch) {
      return await handleToggleQuestion(toggleMatch[1], req, res);
    }

    // PUT /questions/manage/<id>
    const updateMatch = pathname.match(/^\/questions\/manage\/(\d+)$/);
    if (req.method === "PUT" && updateMatch) {
      return await handleUpdateQuestion(updateMatch[1], req, res);
    }

    // DELETE /questions/manage/<id>?eventId=<n>
    const deleteMatch = pathname.match(/^\/questions\/manage\/(\d+)$/);
    if (req.method === "DELETE" && deleteMatch) {
      return await handleDeleteQuestion(deleteMatch[1], url, req, res);
    }

    return respond(res, 404, { error: "Not found." });
  } catch (err) {
    requestLogger.error("Unhandled request error", { err: String(err), stack: err?.stack });
    return respond(res, 500, { error: "Internal server error." });
  }
}

// ---------------------------------------------------------------------------
// GET /questions?eventId=<n>
// ---------------------------------------------------------------------------

async function handleGetQuestions(req, url, res) {
  const eventId = toPositiveInteger(url.searchParams.get("eventId"));
  if (!eventId) return respond(res, 400, { error: "eventId must be a positive integer." });

  const { data, error } = await admin.rpc("get_feedback_questions_atomic", { p_event_id: eventId });

  if (error) {
    getRequestLogger(req).error("get_feedback_questions_atomic failed", { err: String(error) });
    return respond(res, 500, { error: "Could not load feedback questions." });
  }

  return respond(res, 200, { questions: data ?? [] });
}

// ---------------------------------------------------------------------------
// POST /submit
// ---------------------------------------------------------------------------

async function handleSubmitFeedback(req, res) {
  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return respond(res, 400, { error: "Invalid JSON payload." });
  }

  const eventId = toPositiveInteger(payload?.eventId);
  if (!eventId) return respond(res, 400, { error: "eventId must be a positive integer." });

  const answers = payload?.answers;
  if (!Array.isArray(answers) || answers.length === 0) {
    return respond(res, 400, { error: "answers must be a non-empty array." });
  }

  const submittedAt = typeof payload?.submittedAt === "string" ? payload.submittedAt : new Date().toISOString();

  const { data: responseId, error } = await admin.rpc("submit_feedback", {
    p_event_id: eventId,
    p_answers: answers,
    p_submitted_at: submittedAt,
  });

  if (error || !responseId) {
    getRequestLogger(req).error("submit_feedback failed", { err: String(error) });
    return respond(res, 500, { error: "Could not submit feedback." });
  }

  getRequestLogger(req).info("feedback submitted", { eventId, responseId });
  return respond(res, 200, { responseId });
}

// ---------------------------------------------------------------------------
// GET /responses/export?eventId=<n>
// ---------------------------------------------------------------------------

async function handleExportResponses(req, url, res) {
  const eventId = toPositiveInteger(url.searchParams.get("eventId"));
  if (!eventId) return respond(res, 400, { error: "eventId must be a positive integer." });

  // Fetch responses
  const { data: responses, error: responsesError } = await admin
    .from("responses")
    .select("id, event_id, submitted_at")
    .eq("event_id", eventId)
    .order("submitted_at", { ascending: false });
  if (responsesError) {
    getRequestLogger(req).error("export responses fetch failed", { err: String(responsesError) });
    return respond(res, 500, { error: "Could not export responses." });
  }

  const responseRows = responses ?? [];
  const responseIds = responseRows.map((r) => r.id);
  if (responseIds.length === 0) {
    return respond(res, 200, { rows: [] });
  }

  // Fetch answers
  const { data: answers, error: answersError } = await admin
    .from("answers")
    .select("id, response_id, question_id, option_id, answer_text, answer_numeric, created_at")
    .in("response_id", responseIds);
  if (answersError) {
    getRequestLogger(req).error("export answers fetch failed", { err: String(answersError) });
    return respond(res, 500, { error: "Could not export responses." });
  }
  const answerRows = answers ?? [];

  // Fetch questions and options
  const questionIds = [...new Set(answerRows.map((a) => a.question_id).filter(Boolean))];
  const optionIds = [...new Set(answerRows.map((a) => a.option_id).filter(Boolean))];

  let questions = [];
  if (questionIds.length > 0) {
    const { data, error } = await admin.from("questions").select("id, question_text").in("id", questionIds);
    if (!error) questions = data ?? [];
  }

  let options = [];
  if (optionIds.length > 0) {
    const { data, error } = await admin.from("question_options").select("id, option_text").in("id", optionIds);
    if (!error) options = data ?? [];
  }

  // Build export rows
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const optionById = new Map(options.map((o) => [o.id, o]));
  const responseById = new Map(responseRows.map((r) => [r.id, r]));

  const answersByResponse = new Map();
  answerRows.forEach((a) => {
    const existing = answersByResponse.get(a.response_id) ?? [];
    existing.push(a);
    answersByResponse.set(a.response_id, existing);
  });

  const durationByResponse = new Map();
  responseIds.forEach((rid) => {
    const items = answersByResponse.get(rid) ?? [];
    const times = items.map((a) => new Date(a.created_at).getTime()).filter((t) => Number.isFinite(t));
    const seconds = times.length > 1 ? Math.max(0, Math.round((Math.max(...times) - Math.min(...times)) / 1000)) : 0;
    durationByResponse.set(rid, seconds);
  });

  const rows = answerRows.map((answer) => {
    const response = responseById.get(answer.response_id);
    const question = questionById.get(answer.question_id);
    const option = answer.option_id ? optionById.get(answer.option_id) : null;
    const answerText =
      (answer.answer_text || "").trim() ||
      option?.option_text ||
      (Number.isFinite(answer.answer_numeric) ? String(answer.answer_numeric) : "No answer");
    return {
      event_id: eventId,
      response_id: answer.response_id,
      submitted_at: response?.submitted_at || "",
      question_id: answer.question_id ?? "",
      question_text: question?.question_text ?? "",
      answer: answerText,
      completion_time_seconds: durationByResponse.get(answer.response_id) ?? 0,
      answer_created_at: answer.created_at ?? "",
    };
  });

  getRequestLogger(req).info("responses exported", { eventId, rowCount: rows.length });
  return respond(res, 200, { rows });
}

// ---------------------------------------------------------------------------
// GET /questions/manage/<id>/options
// ---------------------------------------------------------------------------

async function handleGetQuestionOptions(questionId, req, res) {
  const id = toPositiveInteger(questionId);
  if (!id) return respond(res, 400, { error: "Invalid question ID." });

  const userId = await authenticateManageRequest(req, res);
  if (!userId) return;

  const eventId = await resolveQuestionEventId(id, req, res);
  if (!eventId) return;

  const accessCheck = await ensureEventAccess(userId, eventId, res);
  if (!accessCheck) return;

  const { data, error } = await admin
    .from("question_options")
    .select("id, question_id, option_text, sort_order, choice_key, created_at")
    .eq("question_id", id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    getRequestLogger(req).error("fetch question options failed", { err: String(error), questionId: id });
    return respond(res, 500, { error: "Could not load options." });
  }

  return respond(res, 200, { options: data ?? [] });
}

// ---------------------------------------------------------------------------
// GET /questions/manage?eventId=<n>
// ---------------------------------------------------------------------------

async function handleListManagedQuestions(url, req, res) {
  const eventId = toPositiveInteger(url.searchParams.get("eventId"));
  if (!eventId) return respond(res, 400, { error: "eventId must be a positive integer." });

  const userId = await authenticateManageRequest(req, res);
  if (!userId) return;

  const accessCheck = await ensureEventAccess(userId, eventId, res);
  if (!accessCheck) return;

  const { data, error } = await admin
    .from("questions")
    .select("id, event_id, question_text, question_type, is_active, sort_order, created_at")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    getRequestLogger(req).error("list managed questions failed", { err: String(error) });
    return respond(res, 500, { error: "Could not load questions." });
  }

  // Also fetch importable questions (from other events)
  const { data: importable } = await admin
    .from("questions")
    .select("id, event_id, question_text, question_type, category, created_at")
    .neq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(200);

  return respond(res, 200, { questions: data ?? [], importableQuestions: importable ?? [] });
}

// ---------------------------------------------------------------------------
// POST /questions/manage  — create question
// ---------------------------------------------------------------------------

async function handleCreateQuestion(req, res) {
  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return respond(res, 400, { error: "Invalid JSON payload." });
  }

  const eventId = toPositiveInteger(payload?.eventId);
  if (!eventId) return respond(res, 400, { error: "eventId must be a positive integer." });

  const userId = await authenticateManageRequest(req, res);
  if (!userId) return;

  const accessCheck = await ensureEventAccess(userId, eventId, res);
  if (!accessCheck) return;

  const questionText = typeof payload?.questionText === "string" ? payload.questionText.trim() : "";
  if (!questionText) return respond(res, 400, { error: "questionText cannot be empty." });

  const questionType = payload?.questionType || "mcq";
  const { normalizedOptions, error: optionsError } = normalizeQuestionOptions(payload?.options);
  if (optionsError) {
    return respond(res, 400, { error: optionsError });
  }

  // Resolve next sort order
  const { data: lastQuestion, error: sortError } = await admin
    .from("questions")
    .select("sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (sortError) {
    getRequestLogger(req).error("resolve sort order failed", { err: String(sortError) });
    return respond(res, 500, { error: "Could not create question." });
  }

  const nextSortOrder = Number.isFinite(lastQuestion?.sort_order) ? lastQuestion.sort_order + 1 : 0;

  const { data, error } = await admin
    .from("questions")
    .insert({
      event_id: eventId,
      question_text: questionText,
      question_type: questionType,
      is_active: true,
      sort_order: nextSortOrder,
    })
    .select("id, question_text, question_type, is_active, sort_order, created_at")
    .single();

  if (error) {
    getRequestLogger(req).error("create question failed", { err: String(error) });
    return respond(res, 500, { error: "Could not create question." });
  }

  const optionRows = normalizedOptions.map((option) => ({
    question_id: data.id,
    option_text: option.option_text,
    sort_order: option.sort_order,
    choice_key: option.choice_key,
  }));
  const { error: insertOptionsError } = await admin.from("question_options").insert(optionRows);

  if (insertOptionsError) {
    getRequestLogger(req).error("create question options failed", {
      err: String(insertOptionsError),
      eventId,
      questionId: data.id,
    });
    const { error: rollbackError } = await admin.from("questions").delete().eq("id", data.id);
    if (rollbackError) {
      getRequestLogger(req).error("create question rollback failed", {
        err: String(rollbackError),
        eventId,
        questionId: data.id,
      });
    }
    return respond(res, 500, { error: "Could not create question." });
  }

  getRequestLogger(req).info("question created", { eventId, questionId: data.id });
  return respond(res, 201, { question: data });
}

// ---------------------------------------------------------------------------
// PUT /questions/manage/<id>  — update question with options (atomic)
// ---------------------------------------------------------------------------

async function handleUpdateQuestion(questionId, req, res) {
  const id = toPositiveInteger(questionId);
  if (!id) return respond(res, 400, { error: "Invalid question ID." });

  const userId = await authenticateManageRequest(req, res);
  if (!userId) return;

  const eventId = await resolveQuestionEventId(id, req, res);
  if (!eventId) return;

  const accessCheck = await ensureEventAccess(userId, eventId, res);
  if (!accessCheck) return;

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return respond(res, 400, { error: "Invalid JSON payload." });
  }

  const questionText = typeof payload?.questionText === "string" ? payload.questionText.trim() : "";
  if (!questionText) return respond(res, 400, { error: "questionText cannot be empty." });

  const questionType = payload?.questionType || "mcq";
  const { normalizedOptions, error: optionsError } = normalizeQuestionOptions(payload?.options);
  if (optionsError) {
    return respond(res, 400, { error: optionsError });
  }

  const { data, error } = await admin.rpc("update_question_with_options_atomic", {
    p_question_id: id,
    p_question_text: questionText,
    p_question_type: questionType,
    p_options: normalizedOptions,
  });

  if (error) {
    getRequestLogger(req).error("update question failed", { err: String(error), questionId: id });
    return respond(res, 500, { error: "Could not save question changes." });
  }

  const updatedQuestion = data?.question;
  if (!updatedQuestion || typeof updatedQuestion !== "object") {
    return respond(res, 500, { error: "Could not save question changes." });
  }

  getRequestLogger(req).info("question updated", { questionId: id });
  return respond(res, 200, { question: updatedQuestion });
}

// ---------------------------------------------------------------------------
// DELETE /questions/manage/<id>?eventId=<n>
// ---------------------------------------------------------------------------

async function handleDeleteQuestion(questionId, url, req, res) {
  const id = toPositiveInteger(questionId);
  if (!id) return respond(res, 400, { error: "Invalid question ID." });

  const eventId = toPositiveInteger(url.searchParams.get("eventId"));
  if (!eventId) return respond(res, 400, { error: "eventId must be a positive integer." });

  const userId = await authenticateManageRequest(req, res);
  if (!userId) return;

  const accessCheck = await ensureEventAccess(userId, eventId, res);
  if (!accessCheck) return;

  const { data: deletedRows, error } = await admin
    .from("questions")
    .delete()
    .eq("id", id)
    .eq("event_id", eventId)
    .select("id");

  if (error) {
    getRequestLogger(req).error("delete question failed", { err: String(error), questionId: id });
    return respond(res, 500, { error: "Could not delete question." });
  }

  if (!deletedRows || deletedRows.length === 0) {
    return respond(res, 404, { error: "Question not found or not owned by this event." });
  }

  getRequestLogger(req).info("question deleted", { questionId: id, eventId });
  return respond(res, 200, { deleted: true });
}

// ---------------------------------------------------------------------------
// PUT /questions/manage/<id>/toggle
// ---------------------------------------------------------------------------

async function handleToggleQuestion(questionId, req, res) {
  const id = toPositiveInteger(questionId);
  if (!id) return respond(res, 400, { error: "Invalid question ID." });

  const userId = await authenticateManageRequest(req, res);
  if (!userId) return;

  const eventId = await resolveQuestionEventId(id, req, res);
  if (!eventId) return;

  const accessCheck = await ensureEventAccess(userId, eventId, res);
  if (!accessCheck) return;

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return respond(res, 400, { error: "Invalid JSON payload." });
  }

  const isActive = typeof payload?.isActive === "boolean" ? payload.isActive : null;
  if (isActive === null) return respond(res, 400, { error: "isActive must be a boolean." });

  const { data, error } = await admin
    .from("questions")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("id, is_active")
    .single();

  if (error) {
    getRequestLogger(req).error("toggle question failed", { err: String(error), questionId: id });
    return respond(res, 500, { error: "Could not update question status." });
  }

  return respond(res, 200, { question: data });
}

// ---------------------------------------------------------------------------
// POST /questions/manage/import
// ---------------------------------------------------------------------------

async function handleImportQuestion(req, res) {
  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return respond(res, 400, { error: "Invalid JSON payload." });
  }

  const eventId = toPositiveInteger(payload?.eventId);
  const sourceId = toPositiveInteger(payload?.sourceQuestionId);
  if (!eventId) return respond(res, 400, { error: "eventId must be a positive integer." });
  if (!sourceId) return respond(res, 400, { error: "sourceQuestionId must be a positive integer." });

  const userId = await authenticateManageRequest(req, res);
  if (!userId) return;

  const accessCheck = await ensureEventAccess(userId, eventId, res);
  if (!accessCheck) return;

  // Resolve next sort order
  const { data: lastQuestion, error: sortError } = await admin
    .from("questions")
    .select("sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (sortError) {
    getRequestLogger(req).error("import resolve sort order failed", { err: String(sortError) });
    return respond(res, 500, { error: "Could not import question." });
  }
  const nextSortOrder = Number.isFinite(lastQuestion?.sort_order) ? lastQuestion.sort_order + 1 : 0;

  // Fetch source question
  const { data: sourceQuestion, error: sourceError } = await admin
    .from("questions")
    .select("id, question_text, question_type, category, dialogue_1_name, dialogue_1_avatar_url, dialogue_2_name, dialogue_2_avatar_url")
    .eq("id", sourceId)
    .single();
  if (sourceError || !sourceQuestion) {
    return respond(res, 404, { error: "Source question not found." });
  }

  // Insert copy
  const { data: newQuestion, error: insertError } = await admin
    .from("questions")
    .insert({
      event_id: eventId,
      question_text: sourceQuestion.question_text,
      question_type: sourceQuestion.question_type || "mcq",
      category: sourceQuestion.category ?? null,
      sort_order: nextSortOrder,
      is_active: true,
      dialogue_1_name: sourceQuestion.dialogue_1_name ?? null,
      dialogue_1_avatar_url: sourceQuestion.dialogue_1_avatar_url ?? null,
      dialogue_2_name: sourceQuestion.dialogue_2_name ?? null,
      dialogue_2_avatar_url: sourceQuestion.dialogue_2_avatar_url ?? null,
    })
    .select("id, event_id, question_text, question_type, is_active, sort_order, created_at")
    .single();
  if (insertError) {
    getRequestLogger(req).error("import insert question failed", { err: String(insertError) });
    return respond(res, 500, { error: "Could not import question." });
  }

  // Copy options
  const { data: sourceOptions, error: optionsError } = await admin
    .from("question_options")
    .select("option_text, sort_order, choice_key")
    .eq("question_id", sourceId)
    .order("sort_order", { ascending: true });
  if (!optionsError && sourceOptions?.length > 0 && newQuestion?.id) {
    const optionRows = sourceOptions.map((opt) => ({
      question_id: newQuestion.id,
      option_text: opt.option_text,
      sort_order: opt.sort_order ?? 0,
      choice_key: opt.choice_key ?? null,
    }));
    const { error: insertOptError } = await admin.from("question_options").insert(optionRows);
    if (insertOptError) {
      getRequestLogger(req).error("import insert options failed", { err: String(insertOptError) });
    }
  }

  getRequestLogger(req).info("question imported", { eventId, sourceId, newId: newQuestion?.id });
  return respond(res, 201, { question: newQuestion });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function authenticateManageRequest(req, res) {
  const bearerToken = parseBearerToken(req);
  if (!bearerToken) {
    respond(res, 401, { error: "Missing authorization token." });
    return null;
  }

  const { data: authData, error: authError } = await admin.auth.getUser(bearerToken);
  if (authError || !authData?.user?.id) {
    respond(res, 401, { error: "Invalid token." });
    return null;
  }

  return authData.user.id;
}

async function ensureEventAccess(userId, eventId, res) {
  const accessCheck = await assertCanAccessEvent(admin, userId, eventId);
  if (!accessCheck.ok) {
    respond(res, accessCheck.status, { error: accessCheck.error });
    return false;
  }

  return true;
}

async function resolveQuestionEventId(questionId, req, res) {
  const { data: questionRow, error } = await admin
    .from("questions")
    .select("event_id")
    .eq("id", questionId)
    .maybeSingle();

  if (error) {
    getRequestLogger(req).error("resolve question event failed", { err: String(error), questionId });
    respond(res, 500, { error: "Could not verify question access." });
    return null;
  }

  const eventId = toPositiveInteger(questionRow?.event_id);
  if (!eventId) {
    respond(res, 404, { error: "Question not found." });
    return null;
  }

  return eventId;
}

async function assertCanAccessEvent(supabaseAdmin, userId, eventId) {
  const { data: roleRow, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (roleError) throw roleError;

  const role = String(roleRow?.role || "");
  if (role !== "admin" && role !== "superadmin") {
    return { ok: false, status: 403, error: "Insufficient permissions." };
  }
  if (role === "superadmin") return { ok: true };

  const { data: assignmentRow, error: assignmentError } = await supabaseAdmin
    .from("event_admins")
    .select("event_id")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignmentRow) {
    return { ok: false, status: 403, error: "No access to this event." };
  }

  return { ok: true };
}

function normalizeQuestionOptions(options) {
  if (!Array.isArray(options) || options.length !== 2) {
    return { normalizedOptions: null, error: "Exactly 2 options are required." };
  }

  const normalizedOptions = options.map((opt, index) => ({
    id: Number.isFinite(Number(opt?.id)) ? Number(opt.id) : null,
    option_text: String(opt?.option_text ?? "").trim(),
    sort_order: index,
    choice_key: String(opt?.choice_key ?? "").trim().toUpperCase(),
  }));

  if (normalizedOptions.some((option) => !option.option_text)) {
    return { normalizedOptions: null, error: "Option text cannot be empty." };
  }

  const choiceKeys = normalizedOptions.map((option) => option.choice_key);
  if (choiceKeys.some((choiceKey) => choiceKey !== "A" && choiceKey !== "B")) {
    return { normalizedOptions: null, error: "Each option must be assigned to A or B." };
  }

  if (new Set(choiceKeys).size !== choiceKeys.length) {
    return { normalizedOptions: null, error: "Options must have unique A and B assignments." };
  }

  return { normalizedOptions, error: "" };
}

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
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
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
