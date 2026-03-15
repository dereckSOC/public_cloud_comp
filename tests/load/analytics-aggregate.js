import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<1000"],
  },
};

export default function () {
  const res = http.get("http://localhost:4002/analytics?eventId=1");

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 1s": (r) => r.timings.duration < 1000,
    "returns analytics data": (r) => {
      const body = JSON.parse(r.body);
      return typeof body.totalQuestions === "number";
    },
  });
}
