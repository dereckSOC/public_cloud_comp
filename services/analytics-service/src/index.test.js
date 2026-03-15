import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "http";

let analyticsServer;
let mockSupabaseServer;
let baseUrl;
const TOKENS = {
  valid: "test-token",
  invalid: "invalid-token",
};

// Mock Supabase REST
function createMockSupabase() {
  return createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");

      if (req.url?.includes("rest/v1/quest")) {
        if (req.url?.includes("id=eq.404")) {
          res.writeHead(200);
          res.end(JSON.stringify(null));
          return;
        }
        if (req.url?.includes("id=eq.1")) {
          res.writeHead(200);
          res.end(JSON.stringify({ id: 1, event_id: 1, is_active: true }));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify([{ id: 1, title: "Games Booth", is_active: true, created_at: new Date().toISOString() }]));
        return;
      }

      if (req.url?.includes("rest/v1/events")) {
        if (req.url?.includes("id=eq.404")) {
          res.writeHead(200);
          res.end(JSON.stringify(null));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify({ id: 1 }));
        return;
      }

      if (req.url?.includes("rest/v1/event_device_entries")) {
        res.writeHead(200);
        res.end(JSON.stringify([]));
        return;
      }

      if (req.url?.includes("rest/v1/booth_completions")) {
        res.writeHead(200);
        res.end(JSON.stringify([]));
        return;
      }

      if (req.url?.includes("rest/v1/questions")) {
        res.writeHead(200);
        res.end(JSON.stringify([
          {
            id: 1,
            question_text: "How did you hear about the event?",
            question_type: "mcq",
            is_active: true,
            sort_order: 0,
            created_at: new Date().toISOString(),
          },
        ]));
        return;
      }

      if (req.url?.includes("rest/v1/responses")) {
        res.writeHead(200);
        res.end(JSON.stringify([]));
        return;
      }

      if (req.url?.includes("rest/v1/answers")) {
        res.writeHead(200);
        res.end(JSON.stringify([]));
        return;
      }

      if (req.url?.includes("rest/v1/question_options")) {
        res.writeHead(200);
        res.end(JSON.stringify([]));
        return;
      }

      if (req.url?.includes("rest/v1/user_roles")) {
        res.writeHead(200);
        res.end(JSON.stringify({ role: "superadmin" }));
        return;
      }

      if (req.url?.includes("auth/v1/user")) {
        const authorization = req.headers.authorization || "";
        const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
        if (token === TOKENS.invalid) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: "Invalid token" }));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify({ user: { id: "test-user-id" } }));
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

  await new Promise((r) => srv.listen(0, () => r()));
  const port = srv.address().port;
  baseUrl = `http://localhost:${port}`;
  analyticsServer = srv;
});

after(async () => {
  await new Promise((r) => analyticsServer?.close(r) ?? r());
  await new Promise((r) => mockSupabaseServer?.close(r) ?? r());
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.equal(body.service, "analytics-service");
  });
});

describe("POST /device-entry", () => {
  it("returns 400 without visitor cookie", async () => {
    const res = await fetch(`${baseUrl}/device-entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: 1 }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /visitor/i);
  });

  it("returns 400 without eventId", async () => {
    const res = await fetch(`${baseUrl}/device-entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: "visitor_id=test-visitor" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  it("returns 404 when the event does not exist", async () => {
    const res = await fetch(`${baseUrl}/device-entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: "visitor_id=test-visitor" },
      body: JSON.stringify({ eventId: 404 }),
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, "Event not found.");
  });
});

describe("POST /booth-complete", () => {
  it("returns 400 without visitor cookie", async () => {
    const res = await fetch(`${baseUrl}/booth-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: 1, questId: 1, method: "pin" }),
    });
    assert.equal(res.status, 400);
  });

  it("returns 400 without questId", async () => {
    const res = await fetch(`${baseUrl}/booth-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: "visitor_id=test" },
      body: JSON.stringify({ eventId: 1, method: "pin" }),
    });
    assert.equal(res.status, 400);
  });

  it("returns 400 for invalid method", async () => {
    const res = await fetch(`${baseUrl}/booth-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: "visitor_id=test" },
      body: JSON.stringify({ eventId: 1, questId: 1, method: "invalid" }),
    });
    assert.equal(res.status, 400);
  });
});

describe("GET /booth-metrics", () => {
  it("returns 400 without eventId", async () => {
    const res = await fetch(`${baseUrl}/booth-metrics`);
    assert.equal(res.status, 400);
  });

  it("returns 401 without authorization header", async () => {
    const res = await fetch(`${baseUrl}/booth-metrics?eventId=1`);
    assert.equal(res.status, 401);
  });

  it("returns 401 for an invalid authorization token", async () => {
    const res = await fetch(`${baseUrl}/booth-metrics?eventId=1`, {
      headers: { Authorization: `Bearer ${TOKENS.invalid}` },
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, "Invalid token.");
  });
});

describe("GET /analytics", () => {
  it("returns 400 without eventId", async () => {
    const res = await fetch(`${baseUrl}/analytics`);
    assert.equal(res.status, 400);
  });

  it("returns analytics for valid eventId", async () => {
    const res = await fetch(`${baseUrl}/analytics?eventId=1`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(typeof body.totalQuestions, "number");
    assert.equal(typeof body.totalResponses, "number");
    assert.ok(body.completionStats);
    assert.ok(body.completionTime);
    assert.ok(body.quality);
    assert.ok(body.trends);
    assert.ok(Array.isArray(body.questionOptionDistributions));
    assert.ok(Array.isArray(body.recentResponses));
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
