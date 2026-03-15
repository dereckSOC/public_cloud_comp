export const dynamic = "force-dynamic";
﻿import { Suspense } from "react";
import EventPickerClient from "./EventPickerClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <EventPickerClient />
    </Suspense>
  );
}

