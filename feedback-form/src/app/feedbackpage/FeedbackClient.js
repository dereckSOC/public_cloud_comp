"use client";
import { useEffect, useState } from "react";
import AudioToggleButton from "@psd/shared/components/AudioToggleButton";
import RPGDialog from "@psd/shared/components/RpgDialog";
import { useRouter } from "next/navigation";
import useQueryParams from "@psd/shared/lib/useQueryParams";
import useEventAccessGuard from "@psd/shared/lib/useEventAccessGuard";
import { translateText } from "@psd/shared/lib/translateText";
import { STORAGE_KEYS } from "@psd/shared/lib/storageKeys";
import useLoopingAudio from "@psd/shared/lib/useLoopingAudio";
import {
  canAccessFeedbackPage,
  consumeFeedbackPageAccess,
  markFeedbackSceneEntryAllowed,
} from "@psd/shared/lib/feedbackFlowAccess";

const FEEDBACK_THEME_SOUND_PATH = "/images/feedback-theme.mp3";

function getNumericOrder(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function getTimestamp(value) {
  const parsed = new Date(value ?? 0).getTime();
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function normalizeAndValidateQuestions(rawQuestions) {
  if (!Array.isArray(rawQuestions)) {
    return {
      normalizedQuestions: [],
      validationError: "Could not load feedback questions. Please try again.",
    };
  }

  const normalizedQuestions = rawQuestions
    .map((question) => {
      const options = Array.isArray(question?.options) ? [...question.options] : [];
      options.sort((a, b) => {
        const bySortOrder = getNumericOrder(a?.sort_order) - getNumericOrder(b?.sort_order);
        if (bySortOrder !== 0) return bySortOrder;

        const byCreatedAt = getTimestamp(a?.created_at) - getTimestamp(b?.created_at);
        if (byCreatedAt !== 0) return byCreatedAt;

        return getNumericOrder(a?.id) - getNumericOrder(b?.id);
      });

      return {
        ...question,
        options,
      };
    })
    .sort((a, b) => {
      const bySortOrder = getNumericOrder(a?.sort_order) - getNumericOrder(b?.sort_order);
      if (bySortOrder !== 0) return bySortOrder;

      const byCreatedAt = getTimestamp(a?.created_at) - getTimestamp(b?.created_at);
      if (byCreatedAt !== 0) return byCreatedAt;

      return getNumericOrder(a?.id) - getNumericOrder(b?.id);
    });

  if (normalizedQuestions.length === 0) {
    return {
      normalizedQuestions: [],
      validationError: "No active feedback questions are configured for this event.",
    };
  }

  const hasMissingOptions = normalizedQuestions.some(
    (question) => !Array.isArray(question.options) || question.options.length === 0
  );
  if (hasMissingOptions) {
    return {
      normalizedQuestions: [],
      validationError: "Feedback questions are misconfigured. Please contact an event admin.",
    };
  }

  return {
    normalizedQuestions,
    validationError: "",
  };
}

function getDbErrorMessage(error, fallback) {
  if (!error) return fallback;
  const details = [error.message, error.details, error.hint].filter(Boolean).join(" ");
  return details || fallback;
}

async function translateQuestions(questions, targetLang) {
  if (targetLang === "en") return questions;

  return Promise.all(
    questions.map(async (question) => {
      try {
        const translatedQuestionText = await translateText(question.question_text, targetLang);
        const translatedOptions = question.options?.length > 0
          ? await Promise.all(
              question.options.map(async (option) => ({
                ...option,
                option_text: await translateText(option.option_text, targetLang)
              }))
            )
          : [];

        return {
          ...question,
          question_text: translatedQuestionText,
          options: translatedOptions,
          original_question_text: question.question_text
        };
      } catch {
        return question;
      }
    })
  );
}


export default function FeedbackClient() {
  const [questions, setQuestions] = useState([]);
  const [originalQuestions, setOriginalQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(null);
  const [fetchError, setFetchError] = useState("");
  const [fetchAttempt, setFetchAttempt] = useState(0);
  const router = useRouter();
  const { lang, eventId, buildQueryString } = useQueryParams();
  const {
    checkingEventAccess,
    isEventAllowed,
    storyModeEnabled,
    normalizedEventId,
    eventNotFoundHref,
  } = useEventAccessGuard(eventId, buildQueryString);
  const queryString = buildQueryString();
  const questListHref = `/questlistpage${queryString}`;

  useLoopingAudio(FEEDBACK_THEME_SOUND_PATH, { volume: 0.45 });

  const retryFetch = () => {
    setFetchAttempt((previous) => previous + 1);
  };

  useEffect(() => {
    if (!checkingEventAccess && !isEventAllowed) {
      router.replace(eventNotFoundHref);
    }
  }, [checkingEventAccess, isEventAllowed, eventNotFoundHref, router]);

  useEffect(() => {
    async function fetchQuestions() {
      if (checkingEventAccess) return;

      setLoading(true);
      setFetchError("");
      setTranslationError(null);

      try {
        if (!isEventAllowed || !normalizedEventId) {
          setOriginalQuestions([]);
          setQuestions([]);
          return;
        }

        if (!canAccessFeedbackPage(normalizedEventId)) {
          setOriginalQuestions([]);
          setQuestions([]);
          router.replace(questListHref);
          return;
        }

        const questionsRes = await fetch(`/api/feedback/questions?eventId=${normalizedEventId}`);
        const questionsBody = await questionsRes.json();

        if (!questionsRes.ok) {
          throw new Error(questionsBody?.error || "Could not load feedback questions.");
        }

        const { normalizedQuestions, validationError } = normalizeAndValidateQuestions(questionsBody.questions);
        if (validationError) {
          setOriginalQuestions([]);
          setQuestions([]);
          setFetchError(validationError);
          return;
        }

        setOriginalQuestions(normalizedQuestions);
        setQuestions(normalizedQuestions);
      } catch (error) {
        setOriginalQuestions([]);
        setQuestions([]);
        setFetchError(
          getDbErrorMessage(error, "Could not load feedback questions. Please try again.")
        );
      } finally {
        setLoading(false);
      }
    }

    fetchQuestions();
  }, [
    checkingEventAccess,
    isEventAllowed,
    normalizedEventId,
    fetchAttempt,
    questListHref,
    router,
  ]);

  useEffect(() => {
    async function performTranslation() {
      if (fetchError) {
        setTranslationError(null);
        setTranslating(false);
        return;
      }

      if (originalQuestions.length === 0 || lang === "en") {
        setQuestions(originalQuestions);
        setTranslationError(null);
        return;
      }

      setTranslating(true);
      setTranslationError(null);
      try {
        const translated = await translateQuestions(originalQuestions, lang);
        setQuestions(translated);
      } catch {
        setTranslationError(`Failed to translate to ${lang}`);
        setQuestions(originalQuestions);
      } finally {
        setTranslating(false);
      }
    }

    performTranslation();
  }, [fetchError, lang, originalQuestions]);

  const handleComplete = async (responses) => {
    try {
      if (!Number.isInteger(normalizedEventId) || normalizedEventId <= 0) {
        return "Missing or invalid event id.";
      }

      const submittedAt = new Date().toISOString();
      const counts = { A: 0, B: 0 };
      for (const value of Object.values(responses || {})) {
        if (value?.type === "cell_choice") {
          if (value.choice === "A") counts.A += 1;
          if (value.choice === "B") counts.B += 1;
        }
      }
      let outcome = "cell_a_captured";
      if (counts.B < counts.A) outcome = "cell_b_captured";
      const translatedQuestionById = new Map(
        (questions || [])
          .map((question) => [Number(question?.id), question])
          .filter(([questionId]) => Number.isFinite(questionId))
      );
      const originalQuestionById = new Map(
        (originalQuestions || [])
          .map((question) => [Number(question?.id), question])
          .filter(([questionId]) => Number.isFinite(questionId))
      );
      const answerRows = Object.entries(responses || {})
        .map(([questionId, value]) => {
          const numericQuestionId = Number(questionId);
          if (!Number.isFinite(numericQuestionId) || !value || typeof value !== "object") {
            return null;
          }

          if (value.type === "cell_choice") {
            const choice = value.choice === "A" || value.choice === "B" ? value.choice : null;
            const numericOptionId = Number(value.optionId);
            const translatedQuestion = translatedQuestionById.get(numericQuestionId);
            const originalQuestion = originalQuestionById.get(numericQuestionId);
            const translatedOption = (translatedQuestion?.options || []).find(
              (opt) => Number(opt?.id) === numericOptionId
            );
            const originalOption = (originalQuestion?.options || []).find(
              (opt) => Number(opt?.id) === numericOptionId
            );
            const answerText =
              (originalOption?.option_text || "").trim() ||
              (translatedOption?.option_text || "").trim() ||
              choice;
            const fallbackNumeric = choice === "A" ? 0 : choice === "B" ? 1 : null;
            return {
              question_id: numericQuestionId,
              option_id: Number.isFinite(numericOptionId) ? numericOptionId : null,
              answer_text: answerText,
              answer_numeric: Number.isFinite(originalOption?.sort_order)
                ? originalOption.sort_order
                : Number.isFinite(translatedOption?.sort_order)
                ? translatedOption.sort_order
                : fallbackNumeric,
              created_at: submittedAt,
            };
          }

          return null;
        })
        .filter(Boolean);

      if (answerRows.length === 0) {
        return "Could not submit feedback. Please try again.";
      }

      const submitRes = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: normalizedEventId,
          answers: answerRows,
          submittedAt,
        }),
      });
      const submitBody = await submitRes.json();

      if (!submitRes.ok || !submitBody.responseId) {
        return "Could not submit feedback. Please try again.";
      }

      const responseId = submitBody.responseId;

      const eventKey = String(normalizedEventId);
      const payload = {
        eventId: normalizedEventId,
        lang: lang || "en",
        counts,
        outcome,
        responses,
        submittedAt,
      };

      try {
        localStorage.setItem(STORAGE_KEYS.feedbackOutcome(eventKey), JSON.stringify(payload));
      } catch {
        // localStorage may be full or disabled — continue with redirect
      }

      consumeFeedbackPageAccess(normalizedEventId);
      if (storyModeEnabled) {
        markFeedbackSceneEntryAllowed(normalizedEventId);
        router.push(`/feedbackscene${queryString}`);
      } else {
        router.push(`/questlistpage${queryString}`);
      }
      return { redirected: true };
    } catch (err) {
      return err?.message || "Unexpected local save error.";
    }
  };

  const isLoading = loading || translating || checkingEventAccess;

  if (!checkingEventAccess && !isEventAllowed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center">
        <div className="text-2xl text-yellow-300 font-silkscreen">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      <AudioToggleButton />
      {isLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-2xl text-yellow-300 font-silkscreen">
            {loading ? "Preparing your quest..." : "Translating quest..."}
          </div>
        </div>
      ) : fetchError ? (
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="w-full max-w-xl rounded-xl border border-red-300 bg-red-950/60 p-6 text-center shadow-2xl">
            <h2 className="text-xl font-semibold text-red-100">Could not load feedback questions</h2>
            <p className="mt-3 text-sm text-red-100/90">{fetchError}</p>
            <button
              type="button"
              onClick={retryFetch}
              className="mt-6 rounded-lg border border-red-200 bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          {translationError && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg z-50">
              {translationError} - Showing English version
            </div>
          )}
          <RPGDialog questions={questions} onComplete={handleComplete} storyModeEnabled={storyModeEnabled} />
        </>
      )}
    </div>
  );
}
