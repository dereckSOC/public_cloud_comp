import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 20,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const payload = JSON.stringify({ eventId: 1 });
  const params = {
    headers: {
      "Content-Type": "application/json",
      Cookie: "visitor_id=load-test-visitor",
    },
  };

  const res = http.post(
    "http://localhost:4002/device-entry",
    payload,
    params
  );

  check(res, {
    "status is 200, 400, or 404": (r) => r.status === 200 || r.status === 400 || r.status === 404,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });
}
