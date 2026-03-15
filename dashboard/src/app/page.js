"use client";
export const dynamic = "force-dynamic";

import Image from "next/image";
import Button from "@psd/shared/components/Button";
import LanguageSwitcher from "@psd/shared/components/LanguageSwitcher";
import { Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import useQueryParams from "@psd/shared/lib/useQueryParams";
import useEventAccessGuard from "@psd/shared/lib/useEventAccessGuard";

function HomeContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { eventId, buildQueryString } = useQueryParams();
  const {
    checkingEventAccess,
    isEventAllowed,
    eventNotFoundHref,
  } = useEventAccessGuard(eventId, buildQueryString);
  const queryString = buildQueryString();

  useEffect(() => {
    if (!checkingEventAccess && !isEventAllowed) {
      router.replace(eventNotFoundHref);
    }
  }, [checkingEventAccess, isEventAllowed, eventNotFoundHref, router]);

  if (checkingEventAccess || (!checkingEventAccess && !isEventAllowed)) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
        <div className="text-yellow-300 text-xl font-semibold">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col justify-center items-center h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 gap-8">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      <div className="flex items-center justify-center w-[300] h-[300]">
        <Image
          src="/images/SCS-logo.png"
          alt="Singapore Cancer Society logo"
          width={220}
          height={176}
          className="w-full h-auto object-contain"
          priority
        />
      </div>

      <div className="mt-50 rounded-lg justify-center items-center">
        <Button
          text={t("home.start")}
          link={`/intropage${queryString}`}
        />
      </div>
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
          <div className="text-yellow-300 text-xl font-semibold">
            {t("common.loading")}
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
