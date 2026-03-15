"use client";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import useQueryParams from "../lib/useQueryParams";
import RpgCard from "./RpgCard";

const OPTION_DEBOUNCE_MS = 250;
const CARD_SHADOW = "0 10px 50px rgba(0,0,0,0.9), inset 0 0 100px rgba(0,0,0,0.1)";
const PAGE_BG_CLASS =
  "flex flex-col items-center justify-center relative min-h-screen bg-gradient-to-b from-zinc-950 via-slate-900 to-black p-4";
const TOP_ACTION_CLASS =
  "bg-stone-800 hover:bg-stone-700 text-stone-100 font-mono font-bold py-2 px-4 rounded-sm border-2 border-stone-950 shadow-lg uppercase tracking-wider text-sm transition-all";
const PRIMARY_LINK_CLASS =
  "inline-block bg-stone-800 hover:bg-stone-700 text-stone-100 font-mono font-bold py-3 px-8 rounded-sm border-2 border-stone-950 shadow-lg uppercase tracking-wider text-sm transition-all";

const DIALOGUE_SLOT_CONFIG = [
  {
    idSuffix: "d1",
    choiceKey: "A",
    fallbackTextField: "dialogue_1_text",
    fallbackNameField: "dialogue_1_name",
    fallbackAvatarField: "dialogue_1_avatar_url",
  },
  {
    idSuffix: "d2",
    choiceKey: "B",
    fallbackTextField: "dialogue_2_text",
    fallbackNameField: "dialogue_2_name",
    fallbackAvatarField: "dialogue_2_avatar_url",
  },
];

function sortByOrder(items) {
  return [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function getQuestionOptions(question) {
  return (question?.options || []).filter(
    (opt) => Number(opt.question_id) === Number(question?.id)
  );
}

function getOptionByChoice(options, choiceKey) {
  const sortedOptions = sortByOrder(options);
  const keyedOption = options.find((opt) => opt.choice_key === choiceKey);
  if (keyedOption) return keyedOption;
  return choiceKey === "A" ? sortedOptions[0] : sortedOptions[1];
}

function buildOptionByChoice(questionOptions) {
  return {
    A: getOptionByChoice(questionOptions, "A"),
    B: getOptionByChoice(questionOptions, "B"),
  };
}

function getCellOptionId(question, choiceKey) {
  const options = getQuestionOptions(question);
  if (options.length === 0) return null;

  const keyed = options.find((opt) => opt.choice_key === choiceKey);
  if (keyed) return keyed.id;

  const sorted = sortByOrder(options);
  if (choiceKey === "A") return sorted[0]?.id ?? null;
  return sorted[1]?.id ?? null;
}

function getAnimatedAvatar(src, open) {
  if (!open) return src;
  const lastDot = src.lastIndexOf(".");
  if (lastDot <= 0) return src;
  const base = src.slice(0, lastDot);
  const ext = src.slice(lastDot);
  return `${base}-open${ext}`;
}

function getAvatarOffsetClass(src) {
  const lower = String(src || "").toLowerCase();
  const isOpen = lower.includes("-open");
  const isCellA = lower.includes("cell_a") || lower.includes("cell1");
  const isCellB = lower.includes("cell_b") || lower.includes("cell2");
  return isOpen && (isCellA || isCellB) ? "translate-y-[3px]" : "";
}

// Removed getOuterCardThemeClass and getInnerCardThemeClass - now handled by RpgCard component

function getProgressPercent(totalQuestions, currentIndex, isPageAnswered) {
  if (totalQuestions === 0) return 0;
  if (totalQuestions === 1) return isPageAnswered ? 100 : 0;
  return (currentIndex / (totalQuestions - 1)) * 100;
}

function buildDialoguePair(question, labels, optionByChoice) {
  if (!question) return [];

  const { guardianName, defaultQuestionText } = labels;
  const baseAvatar = "/images/guardian-head.png";
  const questionTabName = question.question_tab_name || guardianName;
  const questionTabAvatar = question.question_tab_avatar_url || baseAvatar;

  return [
    {
      id: `${question.id}-q`,
      text: question.question_text || defaultQuestionText,
      name: questionTabName,
      avatar: questionTabAvatar,
    },
    ...DIALOGUE_SLOT_CONFIG.map((slot) => {
      const option = optionByChoice[slot.choiceKey];
      return {
        id: `${question.id}-${slot.idSuffix}`,
        text: option?.option_text || question[slot.fallbackTextField] || defaultQuestionText,
        name: question[slot.fallbackNameField] || guardianName,
        avatar: question[slot.fallbackAvatarField] || baseAvatar,
      };
    }),
  ];
}

export default function RPGDialog({ questions = [], onComplete, storyModeEnabled = true }) {
  const { t } = useTranslation();
  const { buildQueryString } = useQueryParams();
  const queryString = buildQueryString();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState({});
  const [showThankYou, setShowThankYou] = useState(false);
  const [showInstruction, setShowInstruction] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [mouthOpen, setMouthOpen] = useState(false);
  const lastSelectionAtRef = useRef(0);

  const ui = {
    home: t("nav.home", "Home"),
    start: t("rpg.start", "Start"),
    instructionTitle: t("rpg.instruction.title", "Let's start the interrogation!"),
    submitErrAll: t(
      "rpg.errors.answerAll",
      "Please answer all questions before submitting."
    ),
    submitErrGeneric: t(
      "rpg.errors.submitFailed",
      "Could not submit feedback. Please try again."
    ),
  };

  const primaryQuestion = questions[currentQuestionIndex];
  const questionOptions = getQuestionOptions(primaryQuestion);
  const optionByChoice = buildOptionByChoice(questionOptions);
  const dialoguePair = buildDialoguePair(
    primaryQuestion,
    {
      guardianName: t("rpg.guardianName", "Guardian"),
      defaultQuestionText: t("rpg.defaultQuestion", "Default qn"),
    },
    optionByChoice
  );

  const isLastPage = currentQuestionIndex >= questions.length - 1;
  const isPageAnswered = primaryQuestion
    ? Object.prototype.hasOwnProperty.call(responses, primaryQuestion.id)
    : false;

  const handleFinalSubmit = async (currentResponses = responses) => {
    if (hasSubmitted || isSubmitting) return;

    if (
      !questions.length ||
      !questions.every((q) => Object.prototype.hasOwnProperty.call(currentResponses, q.id))
    ) {
      setSubmitError(ui.submitErrAll);
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      if (!onComplete) {
        setHasSubmitted(true);
        setShowThankYou(true);
        return;
      }
      const result = await onComplete(currentResponses);
      if (result === false) {
        setSubmitError(ui.submitErrGeneric);
        return;
      }
      if (result && typeof result === "object" && result.redirected) return;
      if (typeof result === "string") {
        setSubmitError(result);
        return;
      }
      setHasSubmitted(true);
      setShowThankYou(true);
    } catch (error) {
      setSubmitError(ui.submitErrGeneric);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResponse = (questionId, response) => {
    const newResponses = { ...responses, [questionId]: response };
    setResponses(newResponses);
    setSubmitError("");

    if (questionId === primaryQuestion?.id) {
      if (!isLastPage) {
        setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1));
      } else {
        void handleFinalSubmit(newResponses);
      }
    }
  };

  const handleCellSelect = (question, choiceKey) => {
    if (!question?.id) return;

    const now = Date.now();
    if (now - lastSelectionAtRef.current < OPTION_DEBOUNCE_MS) return;
    lastSelectionAtRef.current = now;

    const optionId = getCellOptionId(question, choiceKey);
    handleResponse(question.id, { type: "cell_choice", choice: choiceKey, optionId });
  };

  const goPrev = () => {
    setShowThankYou(false);
    if (currentQuestionIndex === 0) {
      setShowInstruction(true);
      return;
    }
    setCurrentQuestionIndex((prev) => Math.max(0, prev - 1));
  };

  useEffect(() => {
    const frameTimer = setInterval(() => setMouthOpen((prev) => !prev), 220);
    return () => clearInterval(frameTimer);
  }, []);

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-zinc-950 via-slate-900 to-black">
        <div
          className="text-2xl text-amber-100 font-mono tracking-wider"
          style={{
            textShadow: "0 0 20px rgba(255,255,255,0.3), 2px 2px 4px rgba(0,0,0,0.8)",
          }}
        >
          {t("rpg.loading", "Loading...")}
        </div>
      </div>
    );
  }

  if (showInstruction) {
    return (
      <div className={PAGE_BG_CLASS}>
        <div className="w-full max-w-4xl">
          <div className="mb-3 flex justify-between">
            <span />
            <Link
              href={`/questlistpage${queryString}`}
              className={TOP_ACTION_CLASS}
            >
              {ui.home}
            </Link>
            <button
              type="button"
              onClick={() => setShowInstruction(false)}
              className={TOP_ACTION_CLASS}
            >
              {ui.start} ▶
            </button>
          </div>

          <div className="space-y-6">
            <RpgCard variant="blue">
              <div className="flex items-center gap-2">
                {storyModeEnabled && (
                  <div className="h-10 w-10 bg-transparent overflow-hidden">
                    <Image
                      src="/images/guardian-head.png"
                      alt={t("rpg.guardianName", "Guardian")}
                      width={40}
                      height={40}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  </div>
                )}
                <div className="text-xs font-mono uppercase tracking-widest text-stone-700">
                  {storyModeEnabled ? t("rpg.guardianName", "Guardian") : t("rpg.questionLabel", "Question")}
                </div>
              </div>

              <p className="text-stone-950 text-lg leading-relaxed font-mono mb-2 mt-2">
                {ui.instructionTitle}
                <br />
                <span className="font-bold">
                  {storyModeEnabled
                    ? t("rpg.instruction.bold", "Click on either Cell A or Cell B")
                    : t("rpg.instruction.boldNeutral", "Click on either Option 1 or Option 2")}
                </span>{" "}
                {storyModeEnabled
                  ? t("rpg.instruction.rest", "depending on which option fits your experience the most.")
                  : t("rpg.instruction.restNeutral", "depending on which option fits your experience the most.")}
              </p>
            </RpgCard>
          </div>

          <div className="mt-3 bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 rounded-sm h-2 border-2 border-stone-800 max-w-4xl mx-auto shadow-lg">
            <div
              className="bg-gradient-to-r from-green-900 via-emerald-700 to-green-900 h-full rounded-sm transition-all duration-300"
              style={{ width: "0%", boxShadow: "0 0 10px rgba(22, 101, 52, 0.5)" }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (showThankYou) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-zinc-950 via-slate-900 to-black p-4">
        <div className="flex-shrink relative w-full max-w-2xl">
          <div
            className="relative bg-gradient-to-b from-stone-200 via-stone-100 to-stone-200 border-4 border-stone-900 rounded-sm p-8 shadow-2xl"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(0,0,0,0.05) 31px, rgba(0,0,0,0.05) 32px)",
              boxShadow: CARD_SHADOW,
            }}
          >
            <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-stone-700" />
            <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-stone-700" />
            <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-stone-700" />
            <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-stone-700" />

            <div className="relative border-2 border-stone-800 bg-stone-100 p-6">
              <div className="text-center mb-4">
                <p className="text-green-800 font-bold text-sm tracking-widest font-mono">
                  {t("rpg.sampleLogged")}
                </p>
              </div>

              <p
                className="text-stone-900 text-lg leading-relaxed font-mono text-center"
                style={{ textShadow: "1px 1px 0px rgba(255,255,255,0.8)" }}
              >
                {t("rpg.thankYou.line1")}
                <br />
                {t("rpg.thankYou.line2")}
                <br />
                <br />
                {t("rpg.thankYou.line3")}
                <br />
                {t("rpg.thankYou.line4")}
              </p>

              <div className="mt-6 text-center">
                <Link
                  href={`/questlistpage${queryString}`}
                  className={PRIMARY_LINK_CLASS}
                >
                  {t("feedback.returnToBase")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_BG_CLASS}>
      <div className="w-full max-w-4xl">
        <div className="mb-3 flex justify-between">
          <button
            onClick={goPrev}
            className={TOP_ACTION_CLASS}
          >
            ◀
          </button>

          <Link
            href={`/questlistpage${queryString}`}
            className={TOP_ACTION_CLASS}
          >
            {ui.home}
          </Link>
          <span />
        </div>

        {submitError && (
          <div className="mb-3 rounded-sm border-2 border-red-700 bg-red-100 px-3 py-2 text-sm font-mono text-red-900">
            {submitError}
          </div>
        )}

        <div className="mt-6 space-y-6">
          {dialoguePair.map((dialogue, index) => {
            const isQuestion = index === 0;
            const isDialogue1 = index === 1;
            const isDialogue2 = index === 2;
            const isSelectable = isDialogue1 || isDialogue2;
            const choiceKey = isDialogue1 ? "A" : isDialogue2 ? "B" : null;
            const selectedChoice = responses[primaryQuestion?.id]?.choice;
            const isSelected =
              (isDialogue1 && selectedChoice === "A") ||
              (isDialogue2 && selectedChoice === "B");

            const variant = isQuestion ? "question" : isDialogue1 ? "dialogue1" : isDialogue2 ? "dialogue2" : "default";
            const avatarSrc = getAnimatedAvatar(dialogue.avatar, mouthOpen);

            return (
              <RpgCard
                key={dialogue.id}
                variant={variant}
                onClick={isSelectable && choiceKey ? () => handleCellSelect(primaryQuestion, choiceKey) : undefined}
                isSelected={isSelected}
                showSpeechTail={isQuestion}
              >
                <div className="flex items-center gap-2">
                  {storyModeEnabled && (
                    <div className="h-10 w-10 bg-transparent overflow-hidden">
                      <Image
                        src={avatarSrc}
                        alt={dialogue.name}
                        width={40}
                        height={40}
                        className={`h-full w-full object-cover ${getAvatarOffsetClass(avatarSrc)}`}
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="text-xs font-mono uppercase tracking-widest text-stone-700">
                    {storyModeEnabled
                      ? dialogue.name
                      : isQuestion
                        ? t("rpg.questionLabel", "Question")
                        : isDialogue1
                          ? t("rpg.option1Label", "Option 1")
                          : t("rpg.option2Label", "Option 2")}
                  </div>
                </div>

                <p className="text-stone-950 text-lg leading-relaxed font-mono mb-2">
                  {dialogue.text}
                </p>
              </RpgCard>
            );
          })}
        </div>

        <div className="mt-3 bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 rounded-sm h-2 border-2 border-stone-800 max-w-4xl mx-auto shadow-lg">
          <div
            className="bg-gradient-to-r from-lime-400 via-emerald-300 to-lime-400 h-full rounded-sm transition-all duration-300"
            style={{
              width: `${getProgressPercent(questions.length, currentQuestionIndex, isPageAnswered)}%`,
              boxShadow: "0 0 14px rgba(132, 255, 150, 0.85)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
