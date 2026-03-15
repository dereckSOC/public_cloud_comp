import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
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
    "http://localhost:3001/api/analytics/device-entry",
    payload,
    params
  );

  check(res, {
    "status is 200 or 404": (r) => r.status === 200 || r.status === 404,
  });
}
