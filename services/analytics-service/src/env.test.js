import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const indexPath = fileURLToPath(new URL("./index.js", import.meta.url));

function runWithoutRequiredEnv() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [indexPath], {
      env: { PATH: process.env.PATH },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, output: `${stdout}${stderr}` }));
  });
}

describe("service bootstrap env guards", () => {
  it("exits when required Supabase env vars are missing", async () => {
    const result = await runWithoutRequiredEnv();
    assert.equal(result.code, 1);
    assert.match(result.output, /SUPABASE_URL .* SUPABASE_SERVICE_ROLE_KEY/i);
  });
});
