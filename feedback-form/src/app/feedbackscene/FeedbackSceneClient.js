"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import AudioToggleButton from "@psd/shared/components/AudioToggleButton";
import useQueryParams from "@psd/shared/lib/useQueryParams";
import useEventAccessGuard from "@psd/shared/lib/useEventAccessGuard";
import { STORAGE_KEYS } from "@psd/shared/lib/storageKeys";
import useLoopingAudio from "@psd/shared/lib/useLoopingAudio";
import { canAccessFeedbackScene, consumeFeedbackSceneAccess } from "@psd/shared/lib/feedbackFlowAccess";
import RpgCard from "@psd/shared/components/RpgCard";

const GUARDIAN_THEME_SOUND_PATH = "/images/guardian-theme.mp3";

const SCENE_ASSETS = {
  cell_a_captured: {
    image: "/images/cell_a_captured.png",
    alt: "Cell A captured placeholder",
  },
  cell_b_captured: {
    image: "/images/cell_b_captured.png",
    alt: "Cell B captured placeholder",
  },
};

export default function FeedbackSceneClient() {
  const { t } = useTranslation();
  const router = useRouter();
  const { eventId, buildQueryString } = useQueryParams();
  const {
    checkingEventAccess,
    isEventAllowed,
    storyModeEnabled,
    normalizedEventId,
    eventNotFoundHref,
  } = useEventAccessGuard(eventId, buildQueryString);
  const queryString = buildQueryString();
  const questListHref = `/questlistpage${queryString}`;
  const [step, setStep] = useState(0);

  useLoopingAudio(GUARDIAN_THEME_SOUND_PATH, { volume: 0.35 });

  const sceneAccess = useMemo(() => {
    if (typeof window === "undefined") {
      return { status: "loading", eventId: null, data: null };
    }

    if (checkingEventAccess) {
      return { status: "loading", eventId: null, data: null };
    }

    if (!isEventAllowed || !normalizedEventId) {
      return { status: "event_blocked", eventId: null, data: null };
    }

    if (!canAccessFeedbackScene(normalizedEventId)) {
      return { status: "flow_blocked", eventId: normalizedEventId, data: null };
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.feedbackOutcome(normalizedEventId));
      if (!raw) {
        return { status: "flow_blocked", eventId: normalizedEventId, data: null };
      }

      const parsed = JSON.parse(raw);
      return {
        status: "ready",
        eventId: normalizedEventId,
        data: {
          outcome: parsed?.outcome || "tie",
          counts: parsed?.counts || { A: 0, B: 0 },
        },
      };
    } catch {
      return { status: "flow_blocked", eventId: normalizedEventId, data: null };
    }
  }, [checkingEventAccess, isEventAllowed, normalizedEventId]);

  useEffect(() => {
    if (sceneAccess.status === "event_blocked") {
      router.replace(eventNotFoundHref);
      return;
    }
    if (!checkingEventAccess && storyModeEnabled === false) {
      router.replace(questListHref);
      return;
    }
    if (sceneAccess.status === "flow_blocked") {
      router.replace(questListHref);
    }
  }, [checkingEventAccess, storyModeEnabled, eventNotFoundHref, questListHref, router, sceneAccess.status]);

  const handleOutcomeContinue = () => {
    setStep(1);
  };

  const handleThankYouContinue = () => {
    if (Number.isInteger(sceneAccess.eventId) && sceneAccess.eventId > 0) {
      consumeFeedbackSceneAccess(sceneAccess.eventId);
    }
    router.push(questListHref);
  };

  if (sceneAccess.status !== "ready") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-slate-900 to-black flex items-center justify-center">
        <div className="text-stone-100 text-xl font-mono">
          {t("feedbackScene.loading")}
        </div>
      </div>
    );
  }

  const safeSceneData = sceneAccess.data;
  const outcome = safeSceneData.outcome;
  const assets = SCENE_ASSETS[outcome] || SCENE_ASSETS.cell_a_captured;

  const title =
    outcome === "cell_b_captured"
      ? t("feedbackScene.outcomes.cell_b.title")
      : t("feedbackScene.outcomes.cell_a.title");

  if (step === 1) {
    return (
      <div className="relative min-h-screen bg-gradient-to-b from-zinc-950 via-slate-900 to-black text-stone-100 flex flex-col items-center justify-center p-6 space-y-6">
        <AudioToggleButton />
        <div className="w-full max-w-3xl">
          <div
            className="relative w-full rounded-sm shadow-2xl overflow-hidden"
            style={{ boxShadow: "0 0 40px rgba(0,0,0,0.9)" }}
          >
            <Image
              src="/images/normal.png"
              alt="Thank you"
              width={1200}
              height={600}
              className="w-full h-auto object-cover"
              unoptimized
            />

            <div className="absolute inset-x-4 bottom-4 flex justify-end">
              <button
                type="button"
                onClick={handleThankYouContinue}
                className="bg-stone-800 hover:bg-stone-700 text-stone-100 font-mono font-bold py-2 px-4 rounded-sm border-2 border-stone-950 shadow-lg uppercase tracking-wider text-sm transition-all"
              >
                {t("feedbackScene.continue")} ▶
              </button>
            </div>
          </div>
        </div>

        <div className="w-full max-w-3xl">
          <RpgCard
            variant="default"
            className="w-full"
            noWrapper={true}
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(0,0,0,0.05) 31px, rgba(0,0,0,0.05) 32px)",
            }}
          >
            <p
              className="text-stone-900 text-lg leading-relaxed font-mono"
              style={{ textShadow: "1px 1px 0px rgba(255,255,255,0.6)" }}
            >
              {t("feedbackScene.thankYouTitle")}
            </p>
          </RpgCard>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-zinc-950 via-slate-900 to-black text-stone-100 flex flex-col items-center justify-center p-6 space-y-6">
      <AudioToggleButton />
      <div className="w-full max-w-3xl">
        <div
          className="relative w-full rounded-sm shadow-2xl overflow-hidden"
          style={{ boxShadow: "0 0 40px rgba(0,0,0,0.9)" }}
        >
          <Image
            src={assets.image}
            alt={assets.alt}
            width={1200}
            height={600}
            className="w-full h-auto object-cover"
            unoptimized
          />

          <div className="absolute inset-x-4 bottom-4 flex justify-end">
            <button
              type="button"
              onClick={handleOutcomeContinue}
              className="bg-stone-800 hover:bg-stone-700 text-stone-100 font-mono font-bold py-2 px-4 rounded-sm border-2 border-stone-950 shadow-lg uppercase tracking-wider text-sm transition-all"
            >
              {t("feedbackScene.continue")} ▶
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-3xl">
        <RpgCard
          variant="default"
          className="w-full"
          noWrapper={true}
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(0,0,0,0.05) 31px, rgba(0,0,0,0.05) 32px)",
          }}
        >
          <div className="text-xs font-mono tracking-widest text-stone-700 uppercase border-b border-stone-400 pb-2">
            {t("feedbackScene.header")}
          </div>

          <p
            className="text-stone-900 text-lg leading-relaxed font-mono"
            style={{ textShadow: "1px 1px 0px rgba(255,255,255,0.6)" }}
          >
            {title}
          </p>

          <p className="text-stone-700 text-sm leading-relaxed font-mono mt-2">
            {t("feedbackScene.choicesLabel")}:{" "}
            {t("feedbackScene.cellA")}: {safeSceneData.counts.A ?? 0} |{" "}
            {t("feedbackScene.cellB")}: {safeSceneData.counts.B ?? 0}
          </p>
        </RpgCard>
      </div>
    </div>
  );
}
