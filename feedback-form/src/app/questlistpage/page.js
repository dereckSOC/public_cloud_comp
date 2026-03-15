"use client";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import QuestListClient from "./QuestListClient";

export default function QuestListPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
          <div className="text-2xl text-yellow-300 font-silkscreen">
            {t("common.loading")}
          </div>
        </div>
      }
    >
      <QuestListClient />
    </Suspense>
  );
}