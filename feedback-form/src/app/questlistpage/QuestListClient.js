"use client";
import Link from "next/link";
import QuestCard from "@psd/shared/components/QuestCard";
import FeedbackCard from "@psd/shared/components/FeedbackCard";
import RewardsCard from "@psd/shared/components/RewardsCard";
import AudioToggleButton from "@psd/shared/components/AudioToggleButton";
import { useEffect, useState } from "react";
import { supabase } from "@psd/shared/lib/supabaseClient";
import { useTranslation } from "react-i18next";
import useQueryParams from "@psd/shared/lib/useQueryParams";
import { translateText } from "@psd/shared/lib/translateText";
import { STORAGE_KEYS } from "@psd/shared/lib/storageKeys";
import { useRouter } from "next/navigation";
import useEventAccessGuard from "@psd/shared/lib/useEventAccessGuard";
import useLoopingAudio from "@psd/shared/lib/useLoopingAudio";

const BACKGROUND_THEME_SOUND_PATH = "/images/background-theme.mp3";

async function translateQuest(quest, targetLang) {
  if (targetLang === "en") {
    return quest;
  }

  try {
    const [translatedTitle, translatedDescription] = await Promise.all([
      translateText(quest.title, targetLang),
      translateText(quest.description, targetLang)
    ]);

    return {
      ...quest,
      title: translatedTitle,
      description: translatedDescription,
      original_title: quest.title,
      original_description: quest.description
    };
  } catch (error) {
    return quest;
  }
}

export default function QuestListClient() {
  const { t } = useTranslation();
  const router = useRouter();
  const [quest, setQuest] = useState([]);
  const [originalQuests, setOriginalQuests] = useState([]);
  const [eventName, setEventName] = useState("");
  const [originalEventName, setOriginalEventName] = useState("");
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(null);
  const { lang, eventId, buildQueryString } = useQueryParams();
  const {
    checkingEventAccess,
    isEventAllowed,
    storyModeEnabled,
    normalizedEventId,
    eventNotFoundHref,
  } = useEventAccessGuard(eventId, buildQueryString);
  const queryString = buildQueryString();

  useLoopingAudio(BACKGROUND_THEME_SOUND_PATH, { volume: 0.35 });

  useEffect(() => {
    if (!checkingEventAccess && !isEventAllowed) {
      router.replace(eventNotFoundHref);
    }
  }, [checkingEventAccess, isEventAllowed, eventNotFoundHref, router]);

  useEffect(() => {
    let mounted = true;

    async function fetchQuestAndEvent() {
      if (checkingEventAccess) return;

      if (!isEventAllowed || !normalizedEventId) {
        if (!mounted) return;
        setOriginalQuests([]);
        setQuest([]);
        setOriginalEventName("");
        setEventName("");
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("name")
          .eq("id", normalizedEventId)
          .maybeSingle();

        if (!mounted) return;

        if (eventError) {
          // ignored
        } else if (eventData && eventData.name) {
          setOriginalEventName(eventData.name);
          setEventName(eventData.name);
        } else {
          setOriginalEventName("");
          setEventName("");
        }

        const { data: questData, error: questError } = await supabase
          .from("quest")
          .select("*")
          .eq("is_active", true)
          .eq("event_id", normalizedEventId);

        if (!mounted) return;

        if (questError) {
          setOriginalQuests([]);
          setQuest([]);
        } else if (questData && questData.length > 0) {
          const questWithSortedOptions = questData.map((q) => ({
            ...q,
            options: q.options?.sort((a, b) => a.sort_order - b.sort_order) || []
          }));
          setOriginalQuests(questWithSortedOptions);
          setQuest(questWithSortedOptions);
        } else {
          setOriginalQuests([]);
          setQuest([]);
        }
      } catch {
        if (!mounted) return;
        setOriginalQuests([]);
        setQuest([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    fetchQuestAndEvent();

    return () => {
      mounted = false;
    };
  }, [checkingEventAccess, isEventAllowed, normalizedEventId]);

  useEffect(() => {
    async function trackEventDeviceEntry() {
      if (!isEventAllowed || !normalizedEventId) return;

      const markerKey = STORAGE_KEYS.eventSeen(normalizedEventId);
      let hasMarker = false;

      try {
        hasMarker = localStorage.getItem(markerKey) === "1";
      } catch {
        hasMarker = false;
      }

      if (hasMarker) return;

      try {
        const response = await fetch("/api/analytics/device-entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: normalizedEventId,
            source: "quest_list_page",
            lang: lang || "en",
          }),
        });

        if (!response.ok) return;

        try {
          localStorage.setItem(markerKey, "1");
        } catch {
          // localStorage may be disabled; DB uniqueness still deduplicates.
        }
      } catch {
        // Ignore tracking failure so page UX is unaffected.
      }
    }

    trackEventDeviceEntry();
  }, [isEventAllowed, normalizedEventId, lang]);

  useEffect(() => {
    async function performTranslation() {
      if (lang === "en") {
        setQuest(originalQuests);
        setEventName(originalEventName);
        setTranslationError(null);
        return;
      }
      setTranslating(true);
      setTranslationError(null);
      try {
        const questPromises = originalQuests.map(questItem => translateQuest(questItem, lang));
        const eventNamePromise = originalEventName
          ? translateText(originalEventName, lang)
          : Promise.resolve(originalEventName);
        const [translatedEventName, ...translatedQuests] = await Promise.all([
          eventNamePromise,
          ...questPromises
        ]);
        if (originalEventName) setEventName(translatedEventName);
        setQuest(translatedQuests);
      } catch (error) {
        setTranslationError(`Failed to translate to ${lang}`);
        setQuest(originalQuests);
        setEventName(originalEventName);
      } finally {
        setTranslating(false);
      }
    }
    performTranslation();
  }, [lang, originalQuests, originalEventName]);

  const isLoading = loading || translating || checkingEventAccess;

  if (!checkingEventAccess && !isEventAllowed) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
        <div className="text-2xl text-yellow-300 font-silkscreen">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col justify-center items-center min-h-screen py-8 bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      {translationError && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg z-50 shadow-lg">
          {translationError} - Showing English version
        </div>
      )}
      <div className="w-full max-w-4xl flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-center md:text-left text-yellow-300 font-silkscreen">
            {t("quest.availableTasks")}
          </h1>
          <h2 className="text-2xl font-bold text-center md:text-left text-yellow-100 font-silkscreen">
             {eventName || t("quest.eventSubtitle")}
          </h2>
        </div>
        <div className="flex flex-wrap justify-center md:justify-end gap-4">
          <Link
            href={`/${queryString}`}
            className="bg-indigo-700 text-yellow-300 border-2 border-indigo-500 px-6 py-3 rounded-lg shadow-lg hover:bg-indigo-600 transition-colors text-base font-bold font-silkscreen"
          >
            {t("quest.backToHome")}
          </Link>
          <Link
            href={`/eventlistpage${queryString}`}
            className="bg-indigo-700 text-yellow-300 border-2 border-indigo-500 px-6 py-3 rounded-lg shadow-lg hover:bg-indigo-600 transition-colors text-base font-bold font-silkscreen"
          >
            {t("quest.events")}
          </Link>

          {storyModeEnabled && <Link
            href={`/intropage${queryString}`}
            className="bg-yellow-500 text-indigo-950 border-2 border-yellow-400 px-6 py-3 rounded-lg shadow-lg hover:bg-yellow-400 transition-colors text-base font-bold font-silkscreen"
          >
            {t("quest.returnToStory")}
          </Link>}
          <AudioToggleButton className="inline-flex items-center justify-center bg-stone-800/90 hover:bg-stone-700 text-stone-100 rounded-sm border-2 border-stone-950 shadow-lg transition-all h-12 w-12" />
        </div>
      </div>

      {isLoading ? (
        <div className="text-2xl text-yellow-300 font-silkscreen">
          {loading ? t("quest.loadingQuests") : "Translating quests..."}
        </div>
      ) : (
        <div className="relative flex-col items-center">
          <div className="absolute top-0 bottom-0 left-1/2 transform -translate-x-1/2 w-2 bg-gradient-to-b from-purple-400 via-indigo-400 to-purple-400 rounded-full z-0 opacity-50"></div>

          <div className="relative z-10 w-full space-y-8">
            {quest.length > 0 ? (
              quest.map((questItem, index) => (
                <QuestCard
                  key={questItem.id}
                  questId={questItem.id}
                  titleText={questItem.title}
                  descriptionText={questItem.description}
                  index={index}
                />
              ))
            ) : (
              <div className="text-center text-purple-200 text-lg font-silkscreen">
                {t("quest.noneAvailable")}
              </div>
            )}
            <div className="relative z-10">
              <FeedbackCard
                questId={999}
                titleText={t("feedback.submitTitle")}
                descriptionText={t("feedback.submitDescription")}
                index={quest.length}
                totalQuestIds={quest.map((q) => q.id)}
              />
            </div>
            <div className="relative z-10">
              <RewardsCard index={quest.length + 1} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
