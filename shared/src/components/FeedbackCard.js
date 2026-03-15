"use client";
import { useReducer, useEffect, useState } from "react";
import { areAllQuestsCompleted } from "../lib/questStorage";
import { useTranslation } from "react-i18next";
import useQueryParams from "../lib/useQueryParams";
import { FLOAT_ANIMATION_CSS } from "../lib/animations";
import { STORAGE_KEYS } from "../lib/storageKeys";
import { useRouter } from "next/navigation";
import { markFeedbackPageEntryAllowed } from "../lib/feedbackFlowAccess";

function DisabledButton({ label }) {
  return (
    <button
      disabled
      className="px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg cursor-not-allowed opacity-60 font-silkscreen"
      type="button"
    >
      {label}
    </button>
  );
}

export default function FeedbackCard({
  questId,
  titleText,
  descriptionText,
  index = 0,
  totalQuestIds = []
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const delay = index * 0.2;
  const [, forceRefresh] = useReducer((prev) => prev + 1, 0);
  const { buildQueryString, eventId } = useQueryParams();
  const queryString = buildQueryString();
  const allCompleted = totalQuestIds.length === 0 || areAllQuestsCompleted(totalQuestIds);

  // Check whether feedback has already been submitted for this event
  // by reading the outcome written to localStorage on submission.
  // Clearing localStorage resets this, allowing re-submission.
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    const checkSubmitted = () => {
      const key = STORAGE_KEYS.feedbackOutcome(eventId);
      setFeedbackSubmitted(!!localStorage.getItem(key));
    };

    checkSubmitted();

    const handleStorageChange = () => {
      forceRefresh();
      checkSubmitted();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("questCompleted", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("questCompleted", handleStorageChange);
    };
  }, [questId, totalQuestIds, eventId]);

  const handleStartFeedback = () => {
    if (!allCompleted) return;
    const allowed = markFeedbackPageEntryAllowed(eventId);
    if (!allowed) return;
    router.push(`/feedbackpage${queryString}`);
  };

  return (
    <div className="max-w-sm w-full lg:max-w-full lg:flex p-4">
      <style>{FLOAT_ANIMATION_CSS}</style>

      <div
        className="border-2 border-purple-300 bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 flex flex-col justify-between leading-normal hover:shadow-xl transition-shadow float-animation"
        style={{ animationDelay: `${delay}s` }}
      >
        <div className="mb-8">
          <div
            className="text-purple-800 font-bold text-xl mb-2 font-silkscreen"
          >
            {titleText}
          </div>

          <p
            className="text-purple-700 text-base font-silkscreen"
          >
            {descriptionText}
          </p>

          <div className="mt-4">
            {feedbackSubmitted ? (
              <button
                className="inline-flex items-center w-auto text-white bg-green-600 shadow-md font-medium leading-5 rounded-lg text-sm px-4 py-2.5 cursor-default font-silkscreen"
                disabled
              >
                ✓ {t("quest.completed")}
              </button>
            ) : allCompleted ? (
              <button
                type="button"
                onClick={handleStartFeedback}
                className="px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition font-silkscreen"
              >
                {t("feedback.rating")}
              </button>
            ) : (
              <DisabledButton label={t("quest.completeAllFirst")} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
