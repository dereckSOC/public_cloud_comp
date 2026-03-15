import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "http";

let eventServer;
let mockSupabaseServer;
let baseUrl;
let state;
let nextIds;

const TOKENS = {
  superadmin: "superadmin-token",
  admin: "admin-token",
  stranger: "stranger-token",
};

function resetState() {
  state = {
    events: [
      {
        id: 1,
        name: "Alpha Event",
        location: "Expo Hall",
        start_date: "2026-03-15",
        end_date: "2026-03-16",
        created_at: "2026-03-01T09:00:00.000Z",
        is_active: true,
        story_mode_enabled: true,
      },
      {
        id: 2,
        name: "Beta Event",
        location: "Campus",
        start_date: null,
        end_date: null,
        created_at: "2026-03-02T09:00:00.000Z",
        is_active: false,
        story_mode_enabled: false,
      },
    ],
    quests: [
      {
        id: 10,
        event_id: 1,
        title: "Games Booth",
        description: "Play the game",
        pin: "1234",
        is_active: true,
        created_at: "2026-03-03T09:00:00.000Z",
      },
    ],
    social_sections: [
      { id: 100, title: "Social Media", display_order: 1 },
      { id: 101, title: "Resources", display_order: 2 },
    ],
    social_items: [
      { id: 200, section_id: 100, title: "Instagram", detail: "", url: "https://instagram.com/scs" },
      { id: 201, section_id: 101, title: "Website", detail: "Official site", url: "https://scs.org.sg" },
    ],
    auth_users: [
      { id: "superadmin-user", email: "superadmin@example.com" },
      { id: "admin-user", email: "existing-admin@example.com" },
      { id: "new-admin-user", email: "new-admin@example.com" },
      { id: "visitor-user", email: "visitor@example.com" },
    ],
    event_admins: [
      { user_id: "admin-user", event_id: 1 },
    ],
    user_roles: [
      { user_id: "superadmin-user", role: "superadmin" },
      { user_id: "admin-user", role: "admin" },
      { user_id: "stranger-user", role: "visitor" },
    ],
  };

  nextIds = {
    events: 3,
    quests: 11,
    social_sections: 102,
    social_items: 202,
  };
}

function parseRequestBody(body) {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function parseEq(params, key) {
  const raw = params.get(key);
  if (!raw?.startsWith("eq.")) return null;
  return decodeURIComponent(raw.slice(3));
}

function parseIn(params, key) {
  const raw = params.get(key);
  if (!raw?.startsWith("in.(") || !raw.endsWith(")")) return null;
  return raw
    .slice(4, -1)
    .split(",")
    .map((value) => decodeURIComponent(value));
}

function wantsObjectResponse(req) {
  return String(req.headers.accept || "").includes("application/vnd.pgrst.object+json");
}

function filterRows(rows, params) {
  let filtered = [...rows];

  for (const [key, value] of params.entries()) {
    if (key === "select" || key === "order" || key === "limit" || key === "offset") continue;

    if (value.startsWith("eq.")) {
      const expected = decodeURIComponent(value.slice(3));
      filtered = filtered.filter((row) => String(row[key]) === expected);
      continue;
    }

    if (value.startsWith("neq.")) {
      const expected = decodeURIComponent(value.slice(4));
      filtered = filtered.filter((row) => String(row[key]) !== expected);
      continue;
    }

    if (value.startsWith("in.(") && value.endsWith(")")) {
      const expected = new Set(
        value
          .slice(4, -1)
          .split(",")
          .map((item) => decodeURIComponent(item))
      );
      filtered = filtered.filter((row) => expected.has(String(row[key])));
    }
  }

  return filtered;
}

function respondJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function handleTable(req, res, pathname, params, body) {
  const table = pathname.split("/").pop();
  const tableName = table === "quest" ? "quests" : table;
  const rows = state[tableName];

  if (!Array.isArray(rows)) {
    respondJson(res, 404, { error: "Unknown table" });
    return;
  }

  const wantsObject = wantsObjectResponse(req);

  if (req.method === "GET") {
    const filtered = filterRows(rows, params);
    respondJson(res, 200, wantsObject ? filtered[0] ?? null : filtered);
    return;
  }

  if (req.method === "POST") {
    const payload = parseRequestBody(body);
    const inserts = Array.isArray(payload) ? payload : [payload];
    const inserted = inserts.map((row) => {
      const nextId = nextIds[tableName];
      nextIds[tableName] += 1;
      return {
        ...row,
        id: nextId,
        created_at: row.created_at ?? new Date("2026-03-15T08:00:00.000Z").toISOString(),
      };
    });
    rows.push(...inserted);
    respondJson(res, 201, wantsObject ? inserted[0] : inserted);
    return;
  }

  if (req.method === "PATCH") {
    const updates = parseRequestBody(body);
    const filtered = filterRows(rows, params);
    const updated = filtered.map((row) => {
      Object.assign(row, updates);
      return { ...row };
    });
    respondJson(res, 200, wantsObject ? updated[0] ?? null : updated);
    return;
  }

  if (req.method === "DELETE") {
    const filtered = filterRows(rows, params);
    const deletedIds = new Set(filtered.map((row) => String(row.id)));
    const deleted = rows.filter((row) => deletedIds.has(String(row.id))).map((row) => ({ ...row }));
    state[tableName] = rows.filter((row) => !deletedIds.has(String(row.id)));
    respondJson(res, 200, wantsObject ? deleted[0] ?? null : deleted);
    return;
  }

  respondJson(res, 405, { error: "Method not allowed" });
}

function createMockSupabase() {
  return createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      const url = new URL(req.url, "http://localhost");
      const pathname = url.pathname;

      if (pathname === "/auth/v1/user") {
        const authorization = req.headers.authorization || "";
        const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";

        if (token === TOKENS.superadmin) {
          return respondJson(res, 200, { user: { id: "superadmin-user" } });
        }
        if (token === TOKENS.admin) {
          return respondJson(res, 200, { user: { id: "admin-user" } });
        }
        if (token === TOKENS.stranger) {
          return respondJson(res, 200, { user: { id: "stranger-user" } });
        }
        return respondJson(res, 401, { error: "Invalid token" });
      }

      if (pathname === "/auth/v1/admin/users") {
        return respondJson(res, 200, { users: state.auth_users });
      }

      if (pathname.startsWith("/rest/v1/")) {
        return handleTable(req, res, pathname, url.searchParams, body);
      }

      return respondJson(res, 404, { error: "Not found" });
    });
  });
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

beforeEach(() => {
  resetState();
});

before(async () => {
  resetState();

  mockSupabaseServer = createMockSupabase();
  const mockPort = await new Promise((resolve) =>
    mockSupabaseServer.listen(0, () => resolve(mockSupabaseServer.address().port))
  );

  process.env.SUPABASE_URL = `http://localhost:${mockPort}`;
  delete process.env.NEXT_PUBLIC_DB_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.PORT = "0";
  process.env.NODE_TEST_CONTEXT = "1";

  const mod = await import("./index.js");
  const srv = mod.server;

  await new Promise((resolve) => srv.listen(0, () => resolve()));
  const port = srv.address().port;
  baseUrl = `http://localhost:${port}`;
  eventServer = srv;
});

after(async () => {
  await new Promise((resolve) => eventServer?.close(resolve) ?? resolve());
  await new Promise((resolve) => mockSupabaseServer?.close(resolve) ?? resolve());
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.equal(body.service, "event-service");
  });
});

describe("GET /events/access", () => {
  it("returns 400 without eventId", async () => {
    const res = await fetch(`${baseUrl}/events/access`);
    assert.equal(res.status, 400);
  });

  it("returns event data for valid eventId", async () => {
    const res = await fetch(`${baseUrl}/events/access?eventId=1`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.exists, true);
    assert.equal(body.isActive, true);
    assert.equal(body.storyModeEnabled, true);
  });
});

describe("event management", () => {
  it("GET /events returns 401 without auth", async () => {
    const res = await fetch(`${baseUrl}/events`);
    assert.equal(res.status, 401);
  });

  it("GET /events returns 401 for an invalid bearer token", async () => {
    const res = await fetch(`${baseUrl}/events`, {
      headers: authHeaders("invalid-token"),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, "Invalid token.");
  });

  it("GET /events returns only assigned events for admin", async () => {
    const res = await fetch(`${baseUrl}/events`, {
      headers: authHeaders(TOKENS.admin),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.events.map((event) => event.id), [1]);
  });

  it("GET /events returns all events for superadmin", async () => {
    const res = await fetch(`${baseUrl}/events`, {
      headers: authHeaders(TOKENS.superadmin),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.events.map((event) => event.id), [2, 1]);
  });

  it("GET /events?eventId=<n> returns event details", async () => {
    const res = await fetch(`${baseUrl}/events?eventId=1`, {
      headers: authHeaders(TOKENS.admin),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.event.id, 1);
    assert.equal(body.event.name, "Alpha Event");
  });

  it("GET /events?eventId=<n> returns 404 for an unknown event", async () => {
    const res = await fetch(`${baseUrl}/events?eventId=999`, {
      headers: authHeaders(TOKENS.superadmin),
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, "Event not found.");
  });

  it("POST /events creates a new event for superadmin", async () => {
    const res = await fetch(`${baseUrl}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(TOKENS.superadmin),
      },
      body: JSON.stringify({
        name: "Gamma Event",
        location: "Town Hall",
        start_date: "2026-03-20",
        end_date: "2026-03-21",
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.event.name, "Gamma Event");
    assert.equal(body.event.story_mode_enabled, true);
  });

  it("PUT /events/:id updates basic fields for admin with access", async () => {
    const res = await fetch(`${baseUrl}/events/1`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(TOKENS.admin),
      },
      body: JSON.stringify({
        name: "Alpha Event Updated",
        location: "Updated Hall",
        is_active: false,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.event.name, "Alpha Event Updated");
    assert.equal(body.event.location, "Updated Hall");
    assert.equal(body.event.is_active, false);
  });

  it("PUT /events/:id rejects story mode updates from admin", async () => {
    const res = await fetch(`${baseUrl}/events/1`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(TOKENS.admin),
      },
      body: JSON.stringify({ story_mode_enabled: false }),
    });
    assert.equal(res.status, 403);
  });

  it("DELETE /events/:id requires superadmin", async () => {
    const adminRes = await fetch(`${baseUrl}/events/1`, {
      method: "DELETE",
      headers: authHeaders(TOKENS.admin),
    });
    assert.equal(adminRes.status, 403);

    const superadminRes = await fetch(`${baseUrl}/events/2`, {
      method: "DELETE",
      headers: authHeaders(TOKENS.superadmin),
    });
    assert.equal(superadminRes.status, 200);
    const body = await superadminRes.json();
    assert.equal(body.deleted, true);
  });
});

describe("quest management", () => {
  it("GET /quests returns 401 without auth", async () => {
    const res = await fetch(`${baseUrl}/quests?eventId=1`);
    assert.equal(res.status, 401);
  });

  it("GET /quests returns quests for accessible event", async () => {
    const res = await fetch(`${baseUrl}/quests?eventId=1`, {
      headers: authHeaders(TOKENS.admin),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.quests.length, 1);
    assert.equal(body.quests[0].title, "Games Booth");
  });

  it("POST /quests creates a quest", async () => {
    const res = await fetch(`${baseUrl}/quests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(TOKENS.admin),
      },
      body: JSON.stringify({
        eventId: 1,
        title: "Cancer Booth",
        description: "Learn more",
        pin: "5678",
        isActive: true,
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.quest.title, "Cancer Booth");
    assert.equal(body.quest.pin, "5678");
  });

  it("PUT /quests/:id toggles quest status", async () => {
    const res = await fetch(`${baseUrl}/quests/10`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(TOKENS.admin),
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.quest.is_active, false);
  });

  it("DELETE /quests/:id deletes quest", async () => {
    const res = await fetch(`${baseUrl}/quests/10`, {
      method: "DELETE",
      headers: authHeaders(TOKENS.admin),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.deleted, true);
  });
});

describe("social content", () => {
  it("GET /social-sections is public", async () => {
    const res = await fetch(`${baseUrl}/social-sections`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.sections.map((section) => section.id), [100, 101]);
  });

  it("GET /social-items is public", async () => {
    const res = await fetch(`${baseUrl}/social-items`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.items.length, 2);
  });

  it("POST /social-sections requires superadmin", async () => {
    const adminRes = await fetch(`${baseUrl}/social-sections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(TOKENS.admin),
      },
      body: JSON.stringify({ title: "Videos" }),
    });
    assert.equal(adminRes.status, 403);

    const superadminRes = await fetch(`${baseUrl}/social-sections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(TOKENS.superadmin),
      },
      body: JSON.stringify({ title: "Videos" }),
    });
    assert.equal(superadminRes.status, 201);
    const body = await superadminRes.json();
    assert.equal(body.section.title, "Videos");
  });

  it("PUT /social-sections/:id updates the section title and order", async () => {
    const res = await fetch(`${baseUrl}/social-sections/100`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(TOKENS.superadmin),
      },
      body: JSON.stringify({ title: "Updated Social Media", displayOrder: 3 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.section.title, "Updated Social Media");
    assert.equal(body.section.display_order, 3);
  });

  it("POST /social-items creates an item for superadmin", async () => {
    const res = await fetch(`${baseUrl}/social-items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(TOKENS.superadmin),
      },
      body: JSON.stringify({
        sectionId: 100,
        title: "TikTok",
        detail: "Video updates",
        url: "https://tiktok.com/@psd",
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.item.section_id, 100);
    assert.equal(body.item.title, "TikTok");
  });

  it("PUT /social-items/:id updates an item", async () => {
    const res = await fetch(`${baseUrl}/social-items/200`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(TOKENS.superadmin),
      },
      body: JSON.stringify({
        title: "Instagram Updated",
        detail: "New detail",
        url: "https://instagram.com/updated",
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.item.title, "Instagram Updated");
    assert.equal(body.item.url, "https://instagram.com/updated");
  });

  it("DELETE /social-items/:id deletes the targeted item only", async () => {
    const res = await fetch(`${baseUrl}/social-items/200`, {
      method: "DELETE",
      headers: authHeaders(TOKENS.superadmin),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.deleted, true);

    const itemsRes = await fetch(`${baseUrl}/social-items`);
    const itemsBody = await itemsRes.json();
    assert.deepEqual(itemsBody.items.map((item) => item.id), [201]);
  });

  it("DELETE /social-sections/:id deletes the section and its items", async () => {
    const res = await fetch(`${baseUrl}/social-sections/100`, {
      method: "DELETE",
      headers: authHeaders(TOKENS.superadmin),
    });
    assert.equal(res.status, 200);

    const sectionsRes = await fetch(`${baseUrl}/social-sections`);
    const sectionsBody = await sectionsRes.json();
    assert.deepEqual(sectionsBody.sections.map((section) => section.id), [101]);

    const itemsRes = await fetch(`${baseUrl}/social-items`);
    const itemsBody = await itemsRes.json();
    assert.deepEqual(itemsBody.items.map((item) => item.id), [201]);
  });
});

describe("superadmin admin-assignment", () => {
  it("GET /admin/assignable-users requires superadmin", async () => {
    const adminRes = await fetch(`${baseUrl}/admin/assignable-users`, {
      headers: authHeaders(TOKENS.admin),
    });
    assert.equal(adminRes.status, 403);

    const superadminRes = await fetch(`${baseUrl}/admin/assignable-users`, {
      headers: authHeaders(TOKENS.superadmin),
    });
    assert.equal(superadminRes.status, 200);
    const body = await superadminRes.json();
    assert.deepEqual(body.users, [
      "existing-admin@example.com",
      "new-admin@example.com",
      "visitor@example.com",
    ]);
  });

  it("POST /admin/event-admins assigns an admin to events for superadmin", async () => {
    const adminRes = await fetch(`${baseUrl}/admin/event-admins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(TOKENS.admin),
      },
      body: JSON.stringify({
        email: "new-admin@example.com",
        eventIds: [1, 2],
      }),
    });
    assert.equal(adminRes.status, 403);

    const superadminRes = await fetch(`${baseUrl}/admin/event-admins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(TOKENS.superadmin),
      },
      body: JSON.stringify({
        email: "new-admin@example.com",
        eventIds: [1, 2, 2],
      }),
    });
    assert.equal(superadminRes.status, 200);
    const body = await superadminRes.json();
    assert.equal(body.assigned, true);

    assert.deepEqual(
      state.event_admins
        .filter((row) => row.user_id === "new-admin-user")
        .map((row) => row.event_id)
        .sort((a, b) => a - b),
      [1, 2]
    );
    assert.equal(
      state.user_roles.some((row) => row.user_id === "new-admin-user" && row.role === "admin"),
      true
    );
  });
});

describe("404 handling", () => {
  it("returns 404 for unknown path", async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    assert.equal(res.status, 404);
  });
});
