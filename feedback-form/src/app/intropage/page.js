"use client";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import IntroClient from "./IntroClient";

export default function IntroPage() {
  const { t } = useTranslation();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-slate-900 to-black flex items-center justify-center">
          <div className="text-stone-100 text-xl font-mono">{t("common.loading")}</div>
        </div>
      }
    >
      <IntroClient />
    </Suspense>
  );
}
