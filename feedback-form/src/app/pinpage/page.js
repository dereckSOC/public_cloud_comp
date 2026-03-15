"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import useQueryParams from "@psd/shared/lib/useQueryParams";
import { markQuestComplete } from "@psd/shared/lib/questStorage";
import { supabase } from "@psd/shared/lib/supabaseClient";
import { STORAGE_KEYS } from "@psd/shared/lib/storageKeys";
import useEventAccessGuard from "@psd/shared/lib/useEventAccessGuard";
import useLoopingAudio from "@psd/shared/lib/useLoopingAudio";

const BACKGROUND_THEME_SOUND_PATH = "/images/background-theme.mp3";

function PinPageContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { eventId, questId, buildQueryString } = useQueryParams();
  const {
    checkingEventAccess,
    isEventAllowed,
    normalizedEventId,
    eventNotFoundHref,
  } = useEventAccessGuard(eventId, buildQueryString);
  const [pin, setPin] = useState("");
  const [showPinError, setShowPinError] = useState(false);
  const [correctPin, setCorrectPin] = useState("");
  const [pinLoading, setPinLoading] = useState(true);
  const [pinConfigError, setPinConfigError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const questListQS = buildQueryString({
    eventId: normalizedEventId ? String(normalizedEventId) : null,
  });
  const isPinCorrect = correctPin.length > 0 && pin === correctPin;

  useLoopingAudio(BACKGROUND_THEME_SOUND_PATH, { volume: 0.35 });

  useEffect(() => {
    if (!checkingEventAccess && !isEventAllowed) {
      router.replace(eventNotFoundHref);
    }
  }, [checkingEventAccess, isEventAllowed, eventNotFoundHref, router]);

  useEffect(() => {
    let mounted = true;

    async function loadQuestPin() {
      setPin("");
      setShowPinError(false);
      setPinConfigError("");

      if (checkingEventAccess) return;

      if (!isEventAllowed || !normalizedEventId) {
        setCorrectPin("");
        setPinLoading(false);
        return;
      }

      const parsedQuestId = Number(questId);
      if (!Number.isInteger(parsedQuestId) || parsedQuestId <= 0) {
        setCorrectPin("");
        setPinLoading(false);
        setPinConfigError("Invalid quest.");
        return;
      }

      setPinLoading(true);

      const { data, error } = await supabase
        .from("quest")
        .select("id, event_id, is_active, pin")
        .eq("id", parsedQuestId)
        .maybeSingle();

      if (!mounted) return;

      if (error || !data) {
        setCorrectPin("");
        setPinLoading(false);
        setPinConfigError("Could not load quest PIN.");
        return;
      }

      if (
        Number.isInteger(normalizedEventId) &&
        normalizedEventId > 0 &&
        Number(data.event_id) !== normalizedEventId
      ) {
        setCorrectPin("");
        setPinLoading(false);
        setPinConfigError("Quest does not belong to this event.");
        return;
      }

      if (data.is_active === false) {
        setCorrectPin("");
        setPinLoading(false);
        setPinConfigError("This quest is currently inactive.");
        return;
      }

      const normalizedPin =
        typeof data.pin === "string" ? data.pin.trim() : "";
      if (!/^\d{1,6}$/.test(normalizedPin)) {
        setCorrectPin("");
        setPinLoading(false);
        setPinConfigError(
          "This quest has no valid PIN configured. Please contact the organizer."
        );
        return;
      }

      setCorrectPin(normalizedPin);
      setPinLoading(false);
    }

    loadQuestPin();
    return () => {
      mounted = false;
    };
  }, [questId, checkingEventAccess, isEventAllowed, normalizedEventId]);

  const homeHref = `/questlistpage${questListQS}`;
  const expectedPinLength = correctPin.length > 0 ? correctPin.length : 6;

  const markBoothTracked = (eventIdValue, questIdValue) => {
    try {
      localStorage.setItem(STORAGE_KEYS.boothTracked(eventIdValue, questIdValue), "1");
    } catch {
      // localStorage may be disabled.
    }
  };

  const hasBoothTrackingMarker = (eventIdValue, questIdValue) => {
    try {
      return (
        localStorage.getItem(STORAGE_KEYS.boothTracked(eventIdValue, questIdValue)) === "1"
      );
    } catch {
      return false;
    }
  };

  const trackBoothCompletion = async (eventIdValue, questIdValue) => {
    if (!eventIdValue || !questIdValue) return;
    if (hasBoothTrackingMarker(eventIdValue, questIdValue)) return;

    try {
      const response = await fetch("/api/analytics/booth-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: eventIdValue,
          questId: questIdValue,
          method: "pin",
        }),
      });

      if (!response.ok) return;
      markBoothTracked(eventIdValue, questIdValue);
    } catch {
      // Ignore tracking failure so quest completion UX is unaffected.
    }
  };

  const handlePinInput = (e) => {
    const value = e.target.value.replace(/\D/g, ""); // digits only
    setPin(value);
    setShowPinError(false);
  };

  const handlePinSubmit = async () => {
    if (pinLoading || pinConfigError || submitting) return;

    if (!isPinCorrect) {
      setShowPinError(true);
      return;
    }

    setSubmitting(true);
    try {
      const parsedQuestId = Number(questId);
      const parsedEventId = normalizedEventId;

      if (Number.isInteger(parsedQuestId) && parsedQuestId > 0) {
        markQuestComplete(parsedQuestId);
        window.dispatchEvent(new Event("questCompleted"));
      }

      if (
        Number.isInteger(parsedEventId) &&
        parsedEventId > 0 &&
        Number.isInteger(parsedQuestId) &&
        parsedQuestId > 0
      ) {
        await trackBoothCompletion(parsedEventId, parsedQuestId);
      }
    } finally {
      setSubmitting(false);
    }

    // Strip questId from the URL when returning — it belongs to pinpage only
    router.push(`/questlistpage${buildQueryString({ questId: null })}`);
  };

  if (checkingEventAccess || (!checkingEventAccess && !isEventAllowed)) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
        <div className="text-yellow-300 text-xl font-semibold">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-center min-h-screen gap-4 py-8 bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      <Link href={homeHref} className="bg-white text-purple-800 px-4 py-2 rounded-lg shadow hover:bg-indigo-50 transition-colors text-sm font-semibold">
        {t("nav.home")}
      </Link>

      <div className="w-full max-w-md bg-white/90 backdrop-blur-md rounded-lg shadow-lg border-2 border-purple-300 p-6 mb-20">
        <h1 className="text-3xl font-bold text-center text-purple-800 mb-6 font-silkscreen">
          {t("scan.enterPinTitle")}
        </h1>

        {/* PIN Input */}
        <div className="mb-6">
          <input
            type="password"
            value={pin}
            onChange={handlePinInput}
            maxLength={expectedPinLength}
            disabled={pinLoading || !!pinConfigError || submitting}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="______"
            className="w-full text-center text-3xl font-mono tracking-[0.75rem] py-8 px-4 border-2 border-purple-200 rounded-2xl bg-purple-50 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 focus:outline-none transition-all duration-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          />

          {pinLoading ? (
            <p className="text-purple-700 text-sm text-center mt-2">
              {t("common.loading")}
            </p>
          ) : pinConfigError ? (
            <p className="text-red-500 text-sm text-center mt-2">
              {pinConfigError}
            </p>
          ) : isPinCorrect ? (
            <p className="text-green-600 text-sm text-center mt-2 font-semibold">
              ✓ {t("scan.pinCorrect")}
            </p>
          ) : showPinError ? (
            <p className="text-red-500 text-sm text-center mt-2">
              ✗ {t("scan.pinIncorrectTryAgain")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handlePinSubmit}
            disabled={
              pinLoading ||
              !!pinConfigError ||
              submitting ||
              pin.length !== correctPin.length
            }
            className="w-full py-3 px-4 bg-purple-700 hover:bg-purple-800 disabled:bg-gray-400 text-white font-bold rounded-lg transition-colors shadow-md disabled:cursor-not-allowed font-silkscreen"
          >
            {submitting
              ? "Saving..."
              : pin.length === correctPin.length
              ? t("scan.verifyPin")
              : t("scan.enterPinButton")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PinPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
          <div className="text-yellow-300 text-xl font-semibold">
            {t("common.loading")}
          </div>
        </div>
      }
    >
      <PinPageContent />
    </Suspense>
  );
}
