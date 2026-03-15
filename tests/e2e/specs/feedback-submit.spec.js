import { test, expect } from "@playwright/test";

test("feedback-form /api/feedback/submit accepts a valid submission", async ({ request }) => {
  const res = await request.post("http://127.0.0.1:3001/api/feedback/submit", {
    data: {
      eventId: 1,
      answers: [
        {
          question_id: 1,
          option_id: 10,
          answer_text: "Support social outreach",
          answer_numeric: 0,
          created_at: "2026-03-15T08:00:00.000Z",
        },
      ],
      submittedAt: "2026-03-15T08:00:00.000Z",
    },
  });

  expect(res.ok()).toBe(true);
  await expect(res.json()).resolves.toMatchObject({ responseId: 9001 });
});
