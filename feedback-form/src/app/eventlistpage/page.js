export const dynamic = "force-dynamic";
import { Suspense } from "react";
import SocialClient from "./SocialClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <SocialClient />
    </Suspense>
  );
}