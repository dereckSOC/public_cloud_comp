import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { DELETE as deleteEvent, PUT as updateEvent } from "../../src/app/api/events/[id]/route.js";
import { GET as getEvents, POST as postEvents } from "../../src/app/api/events/route.js";
import { DELETE as deleteQuest, PUT as updateQuest } from "../../src/app/api/quests/[id]/route.js";
import { GET as getQuests, POST as postQuests } from "../../src/app/api/quests/route.js";
import { DELETE as deleteSection, PUT as updateSection } from "../../src/app/api/social/sections/[id]/route.js";
import { GET as getSections, POST as postSections } from "../../src/app/api/social/sections/route.js";
import { DELETE as deleteItem, PUT as updateItem } from "../../src/app/api/social/items/[id]/route.js";
import { GET as getItems, POST as postItems } from "../../src/app/api/social/items/route.js";

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

describe("dashboard proxy routes", () => {
  it("GET /api/events returns 503 when event-service is unavailable", async () => {
    const response = await getEvents(
      createRequest("http://localhost/api/events", {
        headers: { "X-Request-ID": "events-missing-service" },
      })
    );

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("x-request-id"), "events-missing-service");
    assert.deepEqual(await response.json(), { error: "Service unavailable" });
    assert.equal(fetchCalls.length, 0);
  });

  it("GET /api/events validates eventId locally", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";

    const response = await getEvents(
      createRequest("http://localhost/api/events?eventId=abc")
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "eventId must be a positive integer." });
    assert.equal(fetchCalls.length, 0);
  });

  it("POST /api/events forwards authorization, request ID, and body to event-service", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";
    installFetchMock(() =>
      jsonResponse(
        { event: { id: 3, name: "Launch Day" } },
        { status: 201, headers: { "X-Request-ID": "upstream-events" } }
      )
    );

    const response = await postEvents(
      createRequest("http://localhost/api/events", {
        method: "POST",
        headers: {
          Authorization: "Bearer superadmin-token",
          "X-Request-ID": "dashboard-events",
        },
        json: {
          name: " Launch Day ",
          location: "Hall A",
          start_date: "2026-03-20",
          end_date: "2026-03-21",
        },
      })
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "http://event-service:4000/events");
    assert.equal(fetchCalls[0].method, "POST");
    assert.equal(fetchCalls[0].headers.get("authorization"), "Bearer superadmin-token");
    assert.equal(fetchCalls[0].headers.get("x-request-id"), "dashboard-events");
    assert.deepEqual(JSON.parse(fetchCalls[0].body), {
      name: "Launch Day",
      location: "Hall A",
      start_date: "2026-03-20",
      end_date: "2026-03-21",
    });
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("x-request-id"), "upstream-events");
    assert.deepEqual(await response.json(), { event: { id: 3, name: "Launch Day" } });
  });

  it("PUT /api/events/[id] rejects an invalid event ID", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";

    const response = await updateEvent(
      createRequest("http://localhost/api/events/not-a-number", {
        method: "PUT",
        json: { name: "Bad Event" },
      }),
      { params: Promise.resolve({ id: "abc" }) }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid event ID." });
    assert.equal(fetchCalls.length, 0);
  });

  it("DELETE /api/events/[id] propagates upstream event-not-found responses", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";
    installFetchMock(() => jsonResponse({ error: "Event not found." }, { status: 404 }));

    const response = await deleteEvent(
      createRequest("http://localhost/api/events/999", {
        method: "DELETE",
        headers: { Authorization: "Bearer superadmin-token" },
      }),
      { params: Promise.resolve({ id: "999" }) }
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "http://event-service:4000/events/999");
    assert.equal(fetchCalls[0].headers.get("authorization"), "Bearer superadmin-token");
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Event not found." });
  });

  it("GET /api/quests propagates invalid auth from event-service", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";
    installFetchMock(() => jsonResponse({ error: "Invalid token." }, { status: 401 }));

    const response = await getQuests(
      createRequest("http://localhost/api/quests?eventId=1", {
        headers: { Authorization: "Bearer invalid-token" },
      })
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "http://event-service:4000/quests?eventId=1");
    assert.equal(fetchCalls[0].headers.get("authorization"), "Bearer invalid-token");
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Invalid token." });
  });

  it("POST /api/quests forwards normalized quest payload", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";
    installFetchMock(() => jsonResponse({ quest: { id: 11, title: "Cancer Booth" } }, { status: 201 }));

    const response = await postQuests(
      createRequest("http://localhost/api/quests", {
        method: "POST",
        headers: {
          Authorization: "Bearer admin-token",
          "X-Request-ID": "dashboard-quests",
        },
        json: {
          eventId: 1,
          title: "Cancer Booth",
          description: "Learn more",
          pin: "56-78",
          isActive: false,
        },
      })
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "http://event-service:4000/quests");
    assert.deepEqual(JSON.parse(fetchCalls[0].body), {
      eventId: 1,
      title: "Cancer Booth",
      description: "Learn more",
      pin: "5678",
      isActive: false,
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { quest: { id: 11, title: "Cancer Booth" } });
  });

  it("PUT /api/quests/[id] forwards quest updates", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";
    installFetchMock(() => jsonResponse({ quest: { id: 10, is_active: false } }));

    const response = await updateQuest(
      createRequest("http://localhost/api/quests/10", {
        method: "PUT",
        headers: { Authorization: "Bearer admin-token" },
        json: { isActive: false },
      }),
      { params: Promise.resolve({ id: "10" }) }
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "http://event-service:4000/quests/10");
    assert.deepEqual(JSON.parse(fetchCalls[0].body), { isActive: false });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { quest: { id: 10, is_active: false } });
  });

  it("DELETE /api/quests/[id] rejects an invalid quest ID", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";

    const response = await deleteQuest(
      createRequest("http://localhost/api/quests/not-a-number", { method: "DELETE" }),
      { params: Promise.resolve({ id: "bad" }) }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid quest ID." });
    assert.equal(fetchCalls.length, 0);
  });

  it("GET /api/social/sections proxies public reads", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";
    installFetchMock(() =>
      jsonResponse({ sections: [{ id: 100, title: "Social Media" }] }, { headers: { "X-Request-ID": "sections-upstream" } })
    );

    const response = await getSections(
      createRequest("http://localhost/api/social/sections", {
        headers: { "X-Request-ID": "sections-client" },
      })
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "http://event-service:4000/social-sections");
    assert.equal(fetchCalls[0].headers.get("x-request-id"), "sections-client");
    assert.equal(response.headers.get("x-request-id"), "sections-upstream");
    assert.deepEqual(await response.json(), { sections: [{ id: 100, title: "Social Media" }] });
  });

  it("POST /api/social/sections validates required fields locally", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";

    const response = await postSections(
      createRequest("http://localhost/api/social/sections", {
        method: "POST",
        json: { title: "   " },
      })
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Title is required." });
    assert.equal(fetchCalls.length, 0);
  });

  it("DELETE /api/social/sections/[id] forwards authorization headers", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";
    installFetchMock(() => jsonResponse({ deleted: true }));

    const response = await deleteSection(
      createRequest("http://localhost/api/social/sections/100", {
        method: "DELETE",
        headers: { Authorization: "Bearer superadmin-token" },
      }),
      { params: Promise.resolve({ id: "100" }) }
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "http://event-service:4000/social-sections/100");
    assert.equal(fetchCalls[0].headers.get("authorization"), "Bearer superadmin-token");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { deleted: true });
  });

  it("PUT /api/social/sections/[id] validates display order locally", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";

    const response = await updateSection(
      createRequest("http://localhost/api/social/sections/100", {
        method: "PUT",
        json: { displayOrder: 0 },
      }),
      { params: Promise.resolve({ id: "100" }) }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "displayOrder must be a positive integer." });
    assert.equal(fetchCalls.length, 0);
  });

  it("GET /api/social/items forwards the section filter", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";
    installFetchMock(() => jsonResponse({ items: [{ id: 200, title: "Instagram" }] }));

    const response = await getItems(
      createRequest("http://localhost/api/social/items?sectionId=100")
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "http://event-service:4000/social-items?sectionId=100");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { items: [{ id: 200, title: "Instagram" }] });
  });

  it("POST /api/social/items validates required fields locally", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";

    const response = await postItems(
      createRequest("http://localhost/api/social/items", {
        method: "POST",
        json: { sectionId: 100, title: "Instagram" },
      })
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Title and URL are required." });
    assert.equal(fetchCalls.length, 0);
  });

  it("PUT /api/social/items/[id] forwards item updates", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";
    installFetchMock(() => jsonResponse({ item: { id: 200, title: "Updated Instagram" } }));

    const response = await updateItem(
      createRequest("http://localhost/api/social/items/200", {
        method: "PUT",
        headers: { Authorization: "Bearer superadmin-token" },
        json: { title: "Updated Instagram", url: "https://example.com" },
      }),
      { params: Promise.resolve({ id: "200" }) }
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "http://event-service:4000/social-items/200");
    assert.deepEqual(JSON.parse(fetchCalls[0].body), {
      title: "Updated Instagram",
      url: "https://example.com",
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { item: { id: 200, title: "Updated Instagram" } });
  });

  it("DELETE /api/social/items/[id] forwards authorization headers", async () => {
    process.env.EVENT_SERVICE_URL = "http://event-service:4000";
    installFetchMock(() => jsonResponse({ deleted: true }, { headers: { "X-Request-ID": "items-delete" } }));

    const response = await deleteItem(
      createRequest("http://localhost/api/social/items/200", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer superadmin-token",
          "X-Request-ID": "items-client",
        },
      }),
      { params: Promise.resolve({ id: "200" }) }
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "http://event-service:4000/social-items/200");
    assert.equal(fetchCalls[0].headers.get("authorization"), "Bearer superadmin-token");
    assert.equal(fetchCalls[0].headers.get("x-request-id"), "items-client");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-request-id"), "items-delete");
    assert.deepEqual(await response.json(), { deleted: true });
  });
});
