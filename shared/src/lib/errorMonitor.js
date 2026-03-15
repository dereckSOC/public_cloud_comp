/**
 * Error monitoring hook.
 * Calls ERROR_WEBHOOK_URL (if set) with a JSON payload on unhandled errors.
 * Compatible with Sentry, Slack, or any webhook.
 */

/**
 * @param {Error|unknown} err
 * @param {Record<string, unknown>} context
 */
export function reportError(err, context = {}) {
  const webhookUrl = process.env.ERROR_WEBHOOK_URL;
  if (!webhookUrl) return;

  const payload = {
    severity: "ERROR",
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    timestamp: new Date().toISOString(),
    ...context,
  };

  // Fire-and-forget: do not await, do not throw
  fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Intentionally swallow — webhook failures must never crash the app
  });
}
