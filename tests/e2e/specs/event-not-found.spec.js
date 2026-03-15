import { test, expect } from "@playwright/test";

test("navigating to an invalid eventId shows not found or redirects", async ({
  page,
}) => {
  await page.goto("/intropage?eventId=99999&lang=en");

  // The app should either show a "not found" message or redirect to /event-not-found
  const url = page.url();
  const bodyText = await page.locator("body").innerText();

  const redirectedToNotFound = url.includes("/event-not-found");
  const showsNotFoundText =
    bodyText.toLowerCase().includes("not found") ||
    bodyText.toLowerCase().includes("event not found");

  expect(redirectedToNotFound || showsNotFoundText).toBe(true);
});
