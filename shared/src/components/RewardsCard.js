"use client";
import { useEffect, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import useQueryParams from "../lib/useQueryParams";
import { FLOAT_ANIMATION_CSS } from "../lib/animations";
import { STORAGE_KEYS } from "../lib/storageKeys";

export default function RewardsCard({ index = 0 }) {
  const { t } = useTranslation();
  const { eventId } = useQueryParams();
  const delay = index * 0.2;

  const [, forceRefresh] = useReducer((prev) => prev + 1, 0);
  const [isRedeemed, setIsRedeemed] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const checkState = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.feedbackOutcome(eventId));
        const data = raw ? JSON.parse(raw) : null;
        setFeedbackSubmitted(!!data);
        setIsRedeemed(data?.rewardsRedeemed === true);
      } catch {
        // localStorage unavailable
      }
    };

    checkState();

    const handleStorageChange = () => {
      forceRefresh();
      checkState();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("questCompleted", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("questCompleted", handleStorageChange);
    };
  }, [eventId]);

  const handleConfirm = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.feedbackOutcome(eventId));
      const data = raw ? JSON.parse(raw) : {};
      localStorage.setItem(STORAGE_KEYS.feedbackOutcome(eventId), JSON.stringify({ ...data, rewardsRedeemed: true }));
    } catch {
      // localStorage may be unavailable; treat as redeemed in-session only
    }
    setIsRedeemed(true);
    setShowModal(false);
  };

  return (
    <>
      <div className="max-w-sm w-full lg:max-w-full lg:flex p-4">
        <style>{FLOAT_ANIMATION_CSS}</style>

        <div
          className="border-2 border-purple-300 bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 flex flex-col justify-between leading-normal hover:shadow-xl transition-shadow float-animation"
          style={{ animationDelay: `${delay}s` }}
        >
          <div className="mb-8">
            <div className="text-purple-800 font-bold text-xl mb-2 font-silkscreen">
              {t("rewards.title")}
            </div>
            <p className="text-purple-700 text-base font-silkscreen">
              {t("rewards.description")}
            </p>
            <div className="mt-4">
              {isRedeemed ? (
                <button
                  disabled
                  className="inline-flex items-center w-auto text-white bg-green-600 shadow-md font-medium leading-5 rounded-lg text-sm px-4 py-2.5 cursor-default font-silkscreen"
                >
                  ✓ {t("rewards.completed")}
                </button>
              ) : feedbackSubmitted ? (
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition font-silkscreen"
                >
                  {t("rewards.redeemButton")}
                </button>
              ) : (
                <button
                  disabled
                  className="px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg cursor-not-allowed opacity-60 font-silkscreen"
                  type="button"
                >
                  {t("quest.completeAllFirst")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 border-2 border-purple-300">
            <h2 className="text-purple-800 font-bold text-lg mb-3 font-silkscreen">
              {t("rewards.confirmTitle")}
            </h2>
            <p className="text-purple-700 text-sm font-silkscreen mb-6">
              {t("rewards.confirmMessage")}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition font-silkscreen text-sm"
              >
                {t("rewards.confirmCancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2.5 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition font-silkscreen text-sm"
              >
                {t("rewards.confirmContinue")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
