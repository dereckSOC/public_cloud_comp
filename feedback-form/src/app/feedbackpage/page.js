export const dynamic = "force-dynamic";
import { Suspense } from "react";
import FeedbackClient from "./FeedbackClient";

export default function Feedback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center">
        <div className="text-2xl text-yellow-300 font-silkscreen">
          Loading...
        </div>
      </div>
    }>
      <FeedbackClient />
    </Suspense>
  );
}
