import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { POST as postBoothComplete } from "../../src/app/api/analytics/booth-complete/route.js";
import { POST as postDeviceEntry } from "../../src/app/api/analytics/device-entry/route.js";
import { GET as getEventAccess } from "../../src/app/api/events/access/route.js";
import { GET as getFeedbackQuestions } from "../../src/app/api/feedback/questions/route.js";
import { POST as postFeedbackSubmit } from "../../src/app/api/feedback/submit/route.js";
import { GET as getSocialItems } from "../../src/app/api/social/items/route.js";
import { GET as getSocialSections } from "../../src/app/api/social/sections/route.js";

const originalFetch = globalThis.fetch;
let fetchCalls = [];

function resetEnv() {
  delete process.env.EVENT_SERVICE_URL;
  delete process.env.FEEDBACK_SERVICE_URL;
  delete process.env.ANALYTICS_SERVICE_URL;
}

function createRequest(url, { method = "GET", headers = {}, json, body } = {}) {
  const requestHeaders = new Headers(headers);
  let requestBody = body;

  if (json !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(json);
  }

  return new NextRequest(url, {
    method,
    headers: requestHeaders,
    body: requestBody,
  });
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function installFetchMock(handler) {
  fetchCalls = [];
  globalThis.fetch = async (url, init = {}) => {
    fetchCalls.push({
      url: String(url),
      method: init.method || "GET",
      headers: new Headers(init.headers),
      body: init.body,
    });
    return handler(url, init);
  };
}

beforeEach(() => {
  resetEnv();
  fetchCalls = [];
  globalThis.fetch = originalFetch;
});

after(() => {
  resetEnv();
  globalThis.fetch = originalFetch;
});

describe("feedback-form proxy routes", () => {
  it("GET /api/events/access validates eventId locally", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";

    const response = await getEventAccess(
      createRequest("http://localhost/api/events/access?eventId=0")
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "eventId must be a positive integer." });
    assert.equal(fetchCalls.length, 0);
  });

  it("GET /api/events/access propagates event-not-found responses", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";
    installFetchMock(() =>
      jsonResponse(
        { exists: false, isActive: false },
        { status: 404, headers: { "X-Request-ID": "event-access-upstream" } }
      )
    );

    const response = await getEventAccess(
      createRequest("http://localhost/api/events/access?eventId=999", {
        headers: { "X-Request-ID": "event-access-client" },
      })
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "http://event-service:4000/events/access?eventId=999");
    assert.equal(fetchCalls[0].headers.get("x-request-id"), "event-access-client");
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("x-request-id"), "event-access-upstream");
    assert.deepEqual(await response.json(), { exists: false, isActive: false });
  });

  it("GET /api/feedback/questions returns 503 when feedback-service is unavailable", async () => {
    const response = await getFeedbackQuestions(
      createRequest("http://localhost/api/feedback/questions?eventId=1", {
        headers: { "X-Request-ID": "questions-unavailable" },
      })
    );

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("x-request-id"), "questions-unavailable");
    assert.deepEqual(await response.json(), { error: "Service unavailable" });
    assert.equal(fetchCalls.length, 0);
  });

  it("POST /api/feedback/submit validates answers locally", async () => {
    process.env.FEEDBACK_SERVICE_URL = "http://feedback-service:4001";

    const response = await postFeedbackSubmit(
      createRequest("http://localhost/api/feedback/submit", {
        method: "POST",
        json: { eventId: 1, answers: [] },
      })
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "answers must be a non-empty array." });
    assert.equal(fetchCalls.length, 0);
  });

  it("POST /api/feedback/submit forwards feedback submissions to feedback-service", async () => {
    process.env.FEEDBACK_SERVICE_URL = "http://feedback-service:4001";
    installFetchMock(() =>
      jsonResponse(
        { responseId: 9001 },
        { status: 200, headers: { "X-Request-ID": "submit-upstream" } }
      )
    );

    const response = await postFeedbackSubmit(
      createRequest("http://localhost/api/feedback/submit", {
        method: "POST",
        headers: { "X-Request-ID": "submit-client" },
        json: {
          eventId: 1,
          answers: [{ question_id: 1, option_id: 10, answer_text: "A" }],
          submittedAt: "2026-03-15T08:00:00.000Z",
        },
      })
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "http://feedback-service:4001/submit");
    assert.equal(fetchCalls[0].headers.get("x-request-id"), "submit-client");
    assert.deepEqual(JSON.parse(fetchCalls[0].body), {
      eventId: 1,
      answers: [{ question_id: 1, option_id: 10, answer_text: "A" }],
      submittedAt: "2026-03-15T08:00:00.000Z",
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-request-id"), "submit-upstream");
    assert.deepEqual(await response.json(), { responseId: 9001 });
  });

  it("GET /api/social/sections proxies public reads", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";
    installFetchMock(() => jsonResponse({ sections: [{ id: 100, title: "Social Media" }] }));

    const response = await getSocialSections(
      createRequest("http://localhost/api/social/sections", {
        headers: { "X-Request-ID": "social-sections-client" },
      })
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "http://event-service:4000/social-sections");
    assert.equal(fetchCalls[0].headers.get("x-request-id"), "social-sections-client");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { sections: [{ id: 100, title: "Social Media" }] });
  });

  it("GET /api/social/items forwards the section filter", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";
    installFetchMock(() => jsonResponse({ items: [{ id: 200, title: "Instagram" }] }));

    const response = await getSocialItems(
      createRequest("http://localhost/api/social/items?sectionId=100")
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "http://event-service:4000/social-items?sectionId=100");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { items: [{ id: 200, title: "Instagram" }] });
  });

  it("POST /api/analytics/device-entry requires a visitor cookie", async () => {
    process.env.ANALYTICS_SERVICE_URL = "http://analytics-service:4002";

    const response = await postDeviceEntry(
      createRequest("http://localhost/api/analytics/device-entry", {
        method: "POST",
        json: { eventId: 1 },
      })
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Missing visitor cookie." });
    assert.equal(fetchCalls.length, 0);
  });

  it("POST /api/analytics/device-entry forwards visitor identity to analytics-service", async () => {
    process.env.ANALYTICS_SERVICE_URL = "http://analytics-service:4002";
    installFetchMock(() =>
      jsonResponse(
        { counted: true },
        { headers: { "X-Request-ID": "device-entry-upstream" } }
      )
    );

    const response = await postDeviceEntry(
      createRequest("http://localhost/api/analytics/device-entry", {
        method: "POST",
        headers: {
          Cookie: "visitor_id=test-visitor",
          "User-Agent": "ProxyTest/1.0",
          "X-Request-ID": "device-entry-client",
        },
        json: { eventId: 1, lang: "en", source: "qr" },
      })
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "http://analytics-service:4002/device-entry");
    assert.equal(fetchCalls[0].headers.get("cookie"), "visitor_id=test-visitor");
    assert.equal(fetchCalls[0].headers.get("user-agent"), "ProxyTest/1.0");
    assert.equal(fetchCalls[0].headers.get("x-request-id"), "device-entry-client");
    assert.deepEqual(JSON.parse(fetchCalls[0].body), { eventId: 1, lang: "en", source: "qr" });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-request-id"), "device-entry-upstream");
    assert.deepEqual(await response.json(), { counted: true });
  });

  it("POST /api/analytics/booth-complete validates questId locally", async () => {
    process.env.ANALYTICS_SERVICE_URL = "http://analytics-service:4002";

    const response = await postBoothComplete(
      createRequest("http://localhost/api/analytics/booth-complete", {
        method: "POST",
        headers: { Cookie: "visitor_id=test-visitor" },
        json: { eventId: 1, method: "pin" },
      })
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "questId must be a positive integer." });
    assert.equal(fetchCalls.length, 0);
  });
});
