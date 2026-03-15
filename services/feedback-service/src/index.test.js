import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "http";

let feedbackServer;
let mockSupabaseServer;
let baseUrl;
const mockState = {
  questionInsert: null,
  questionOptionsInsert: null,
};

function parseRequestBody(body) {
  try {
    return JSON.parse(body || "null");
  } catch {
    return null;
  }
}

// Mock Supabase REST — returns canned responses for known RPC endpoints
function createMockSupabase() {
  return createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");

      if (req.url?.includes("rpc/get_feedback_questions_atomic")) {
        res.writeHead(200);
        res.end(JSON.stringify([
          { id: 1, question_text: "Q1", sort_order: 0, options: [{ id: 10, option_text: "A", sort_order: 0 }] },
        ]));
        return;
      }

      if (req.url?.includes("rpc/submit_feedback")) {
        res.writeHead(200);
        res.end(JSON.stringify(99));
        return;
      }

      if (req.url?.includes("rest/v1/responses")) {
        res.writeHead(200);
        res.end(JSON.stringify([]));
        return;
      }

      if (req.url?.includes("rest/v1/user_roles")) {
        res.writeHead(200);
        res.end(JSON.stringify({ role: "superadmin" }));
        return;
      }

      if (req.url?.includes("rest/v1/event_admins")) {
        res.writeHead(200);
        res.end(JSON.stringify({ event_id: 1 }));
        return;
      }

      if (req.url?.includes("rest/v1/questions")) {
        if (req.method === "GET" && req.url?.includes("select=event_id")) {
          res.writeHead(200);
          res.end(JSON.stringify({ event_id: 1 }));
          return;
        }
        if (req.method === "POST") {
          const payload = parseRequestBody(body);
          const row = Array.isArray(payload) ? payload[0] : payload;
          mockState.questionInsert = row;
          res.writeHead(201);
          res.end(JSON.stringify({
            id: 5,
            question_text: row?.question_text ?? "New Q",
            question_type: row?.question_type ?? "mcq",
            is_active: row?.is_active ?? true,
            sort_order: row?.sort_order ?? 0,
            created_at: new Date().toISOString(),
          }));
          return;
        }
        if (req.method === "DELETE") {
          res.writeHead(200);
          res.end(JSON.stringify([{ id: 1 }]));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify([]));
        return;
      }

      if (req.url?.includes("auth/v1/user")) {
        const authorization = req.headers.authorization || "";
        const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
        if (token === "invalid-token") {
          res.writeHead(401);
          res.end(JSON.stringify({ error: "Invalid token" }));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify({ user: { id: "test-user-id" } }));
        return;
      }

      if (req.url?.includes("rest/v1/question_options")) {
        if (req.method === "POST") {
          const payload = parseRequestBody(body);
          mockState.questionOptionsInsert = payload;
          res.writeHead(201);
          res.end(JSON.stringify(payload ?? []));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify([]));
        return;
      }

      // Default
      res.writeHead(200);
      res.end(JSON.stringify([]));
    });
  });
}

before(async () => {
  const mockSupabase = createMockSupabase();
  mockSupabaseServer = mockSupabase;
  const mockPort = await new Promise((r) => mockSupabase.listen(0, () => r(mockSupabase.address().port)));

  process.env.SUPABASE_URL = `http://localhost:${mockPort}`;
  delete process.env.NEXT_PUBLIC_DB_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.PORT = "0";
  process.env.NODE_TEST_CONTEXT = "1";

  const mod = await import("./index.js");
  const srv = mod.server;

  // Start on random port
  await new Promise((r) => srv.listen(0, () => r()));
  const port = srv.address().port;
  baseUrl = `http://localhost:${port}`;
  feedbackServer = srv;
});

const authHeaders = {
  Authorization: "Bearer test-token",
};

after(async () => {
  await new Promise((r) => feedbackServer?.close(r) ?? r());
  await new Promise((r) => mockSupabaseServer?.close(r) ?? r());
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.equal(body.service, "feedback-service");
  });
});

describe("GET /questions", () => {
  it("returns 400 without eventId", async () => {
    const res = await fetch(`${baseUrl}/questions`);
    assert.equal(res.status, 400);
  });

  it("returns 400 for non-integer eventId", async () => {
    const res = await fetch(`${baseUrl}/questions?eventId=abc`);
    assert.equal(res.status, 400);
  });

  it("returns questions for valid eventId", async () => {
    const res = await fetch(`${baseUrl}/questions?eventId=1`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.questions));
  });
});

describe("POST /submit", () => {
  it("returns 400 without body", async () => {
    const res = await fetch(`${baseUrl}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 400);
  });

  it("returns 400 without answers", async () => {
    const res = await fetch(`${baseUrl}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: 1 }),
    });
    assert.equal(res.status, 400);
  });

  it("submits feedback with valid payload", async () => {
    const res = await fetch(`${baseUrl}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: 1,
        answers: [{ question_id: 1, option_id: 10, answer_text: "A", answer_numeric: 0, created_at: new Date().toISOString() }],
        submittedAt: new Date().toISOString(),
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.responseId);
  });
});

describe("GET /responses/export", () => {
  it("returns 400 without eventId", async () => {
    const res = await fetch(`${baseUrl}/responses/export`);
    assert.equal(res.status, 400);
  });

  it("returns rows array for valid eventId", async () => {
    const res = await fetch(`${baseUrl}/responses/export?eventId=1`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.rows));
  });
});

describe("question management", () => {
  it("GET /questions/manage returns 401 without authorization", async () => {
    const res = await fetch(`${baseUrl}/questions/manage?eventId=1`);
    assert.equal(res.status, 401);
  });

  it("GET /questions/manage returns 401 for an invalid token", async () => {
    const res = await fetch(`${baseUrl}/questions/manage?eventId=1`, {
      headers: { Authorization: "Bearer invalid-token" },
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, "Invalid token.");
  });

  it("POST /questions/manage returns 401 without authorization", async () => {
    const res = await fetch(`${baseUrl}/questions/manage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: 1, questionText: "Q1" }),
    });
    assert.equal(res.status, 401);
  });

  it("POST /questions/manage/import returns 401 without authorization", async () => {
    const res = await fetch(`${baseUrl}/questions/manage/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: 1, sourceQuestionId: 2 }),
    });
    assert.equal(res.status, 401);
  });

  it("GET /questions/manage/:id/options returns 401 without authorization", async () => {
    const res = await fetch(`${baseUrl}/questions/manage/1/options`);
    assert.equal(res.status, 401);
  });

  it("PUT /questions/manage/:id returns 401 without authorization", async () => {
    const res = await fetch(`${baseUrl}/questions/manage/1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionText: "Updated Q",
        questionType: "mcq",
        options: [
          { id: 1, option_text: "Cell A", choice_key: "A" },
          { id: 2, option_text: "Cell B", choice_key: "B" },
        ],
      }),
    });
    assert.equal(res.status, 401);
  });

  it("PUT /questions/manage/:id/toggle returns 401 without authorization", async () => {
    const res = await fetch(`${baseUrl}/questions/manage/1/toggle`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(res.status, 401);
  });

  it("DELETE /questions/manage/:id returns 401 without authorization", async () => {
    const res = await fetch(`${baseUrl}/questions/manage/1?eventId=1`, { method: "DELETE" });
    assert.equal(res.status, 401);
  });

  it("GET /questions/manage returns 400 without eventId", async () => {
    const res = await fetch(`${baseUrl}/questions/manage`, {
      headers: authHeaders,
    });
    assert.equal(res.status, 400);
  });

  it("POST /questions/manage returns 400 without questionText", async () => {
    const res = await fetch(`${baseUrl}/questions/manage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ eventId: 1 }),
    });
    assert.equal(res.status, 400);
  });

  it("POST /questions/manage creates a question with options", async () => {
    mockState.questionInsert = null;
    mockState.questionOptionsInsert = null;

    const res = await fetch(`${baseUrl}/questions/manage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        eventId: 1,
        questionText: "Where should visitors go first?",
        questionType: "mcq",
        options: [
          { option_text: "Games booth", choice_key: "A" },
          { option_text: "Cancer booth", choice_key: "B" },
        ],
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.question?.question_text, "Where should visitors go first?");
    assert.equal(mockState.questionInsert?.question_text, "Where should visitors go first?");
    assert.ok(Array.isArray(mockState.questionOptionsInsert));
    assert.equal(mockState.questionOptionsInsert.length, 2);
    assert.equal(mockState.questionOptionsInsert[0]?.question_id, 5);
    assert.equal(mockState.questionOptionsInsert[0]?.choice_key, "A");
    assert.equal(mockState.questionOptionsInsert[1]?.choice_key, "B");
  });

  it("POST /questions/manage returns 400 without valid options", async () => {
    const res = await fetch(`${baseUrl}/questions/manage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        eventId: 1,
        questionText: "Broken question",
        questionType: "mcq",
        options: [{ option_text: "Only one option", choice_key: "A" }],
      }),
    });

    assert.equal(res.status, 400);
  });

  it("DELETE /questions/manage/:id returns 400 without eventId", async () => {
    const res = await fetch(`${baseUrl}/questions/manage/1`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert.equal(res.status, 400);
  });

  it("PUT /questions/manage/:id/toggle returns 400 without isActive", async () => {
    const res = await fetch(`${baseUrl}/questions/manage/1/toggle`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });
});

describe("404 handling", () => {
  it("returns 404 for unknown path", async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    assert.equal(res.status, 404);
  });
});

describe("CORS", () => {
  it("responds to OPTIONS with 204", async () => {
    const res = await fetch(`${baseUrl}/health`, { method: "OPTIONS" });
    assert.equal(res.status, 204);
  });
});
