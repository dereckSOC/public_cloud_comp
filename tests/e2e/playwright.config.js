import { defineConfig } from "@playwright/test";

// Bring up the stack manually or via CI before running Playwright.
export default defineConfig({
  testDir: "./specs",
  use: { baseURL: "http://127.0.0.1:3001" },
});
