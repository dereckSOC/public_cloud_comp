import { test, expect } from "@playwright/test";

test("dashboard /api/health returns {status:ok}", async ({ request }) => {
  const res = await request.get("http://127.0.0.1:3000/api/health");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body).toMatchObject({ status: "ok" });
});

test("feedback-form /api/health returns {status:ok}", async ({ request }) => {
  const res = await request.get("http://127.0.0.1:3001/api/health");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body).toMatchObject({ status: "ok" });
});

test("feedback-service /health returns {status:ok}", async ({ request }) => {
  const res = await request.get("http://127.0.0.1:4001/health");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body).toMatchObject({ status: "ok", service: "feedback-service" });
});

test("analytics-service /health returns {status:ok}", async ({ request }) => {
  const res = await request.get("http://127.0.0.1:4002/health");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body).toMatchObject({ status: "ok", service: "analytics-service" });
});
