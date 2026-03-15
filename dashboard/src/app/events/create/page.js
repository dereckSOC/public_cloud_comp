export const dynamic = "force-dynamic";
﻿import { Suspense } from "react";
import CreateEventClient from "./CreateEventClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <CreateEventClient />
    </Suspense>
  );
}

