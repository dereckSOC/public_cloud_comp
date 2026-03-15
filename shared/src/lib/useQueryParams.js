"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import i18n from "i18next";

export default function useQueryParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lang = searchParams.get("lang");
  const eventId = searchParams.get("eventId");
  const questId = searchParams.get("questId");

  useEffect(() => {
    const finalLang = lang || "en";
    if (i18n.language !== finalLang) {
      i18n.changeLanguage(finalLang);
    }
  }, [lang]);

  useEffect(() => {
    if (!lang) {
      const params = new URLSearchParams(searchParams.toString());

      params.set("lang", "en");
      router.replace(`?${params.toString()}`);
    }
  }, [lang, router, searchParams]);

  const buildQueryString = useMemo(() => {
    return (overrides = {}) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(overrides).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      const qs = params.toString();
      return qs ? `?${qs}` : "";
    };
  }, [searchParams]);

  return {
    lang: lang || null,
    eventId: eventId || null,
    questId: questId || null,
    buildQueryString
  };
}
