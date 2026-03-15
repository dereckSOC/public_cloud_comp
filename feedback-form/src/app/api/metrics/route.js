import { incrementCounter, getMetricsText } from "@psd/shared/lib/metrics.js";

export async function GET() {
  incrementCounter("http_requests_total", { route: "metrics", app: "feedback-form" });
  const text = getMetricsText();
  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4",
    },
  });
}
