import { createServer } from "node:http";

const QUESTIONS = [
  {
    id: 1,
    question_text: "How did you hear about the event?",
    sort_order: 0,
    options: [
      { id: 10, option_text: "Social media", sort_order: 0, choice_key: "A" },
      { id: 11, option_text: "Friends", sort_order: 1, choice_key: "B" },
    ],
  },
];

function wantsObjectResponse(req) {
  return String(req.headers.accept || "").includes("application/vnd.pgrst.object+json");
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/health") {
    return sendJson(res, 200, { status: "ok" });
  }

  if (url.pathname.endsWith("/rpc/get_feedback_questions_atomic")) {
    return sendJson(res, 200, QUESTIONS);
  }

  if (url.pathname.endsWith("/rpc/submit_feedback")) {
    return sendJson(res, 200, 9001);
  }

  if (url.pathname === "/auth/v1/user") {
    return sendJson(res, 200, { user: { id: "e2e-user" } });
  }

  if (url.pathname === "/rest/v1/events") {
    const eventId = url.searchParams.get("id");
    const exists = eventId === null || eventId === "eq.1";
    const body = exists ? { id: 1, is_active: true, story_mode_enabled: true } : null;
    return sendJson(res, 200, wantsObjectResponse(req) ? body : body ? [body] : []);
  }

  if (url.pathname === "/rest/v1/questions") {
    const questionId = url.searchParams.get("id");
    const body = questionId === "eq.1" ? { event_id: 1, id: 1 } : [];
    return sendJson(res, 200, wantsObjectResponse(req) ? body || null : Array.isArray(body) ? body : [body]);
  }

  if (url.pathname.startsWith("/rest/v1/")) {
    return sendJson(res, 200, wantsObjectResponse(req) ? null : []);
  }

  return sendJson(res, 404, { error: "Not found." });
});

server.listen(54321, "0.0.0.0", () => {
  process.stdout.write("mock-supabase listening on 54321\n");
});
