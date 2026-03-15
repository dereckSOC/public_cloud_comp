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
  const res = http.get("http://localhost:3001/api/events/access?eventId=1");

  check(res, {
    "status is 200 or 404": (r) => r.status === 200 || r.status === 404,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });
}
