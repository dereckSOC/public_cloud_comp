"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import useQueryParams from "@psd/shared/lib/useQueryParams";
import { useAudioMuted } from "@psd/shared/lib/audioPreferences";
import AudioToggleButton from "@psd/shared/components/AudioToggleButton";
import RpgCard from "@psd/shared/components/RpgCard";
import useEventAccessGuard from "@psd/shared/lib/useEventAccessGuard";

const slides = [
  {
    titleKey: "introSlides.s0.title",
    lineKeys: ["introSlides.s0.l1", "introSlides.s0.l2"],
    image: "/images/alert.png",
    animatedBase: "/images/alert.png",
    animatedOpen: "/images/alert2.png",
    alt: "Alert icon",
  },
  {
    titleKey: "introSlides.s1.title",
    lineKeys: ["introSlides.s1.l1"],
    image: "/images/guardian_8bit.png",
    alt: "Guardian Cell",
  },
  {
    titleKey: "introSlides.s2.title",
    lineKeys: ["introSlides.s2.l1"],
    image: "/images/guardian_8bit.png",
    alt: "Guardian Cell",
  },
  {
    titleKey: "introSlides.s3.title",
    lineKeys: ["introSlides.s3.l1"],
    image: "/images/guardian_8bit.png",
    alt: "Guardian Cell",
  },
  {
    titleKey: "introSlides.s4.title",
    lineKeys: ["introSlides.s4.l1"],
    image: "/images/guardian_8bit.png",
    alt: "Guardian Cell",
  },
  {
    titleKey: "introSlides.s5.title",
    lineKeys: ["introSlides.s5.l1", "introSlides.s5.l2"],
    image: "/images/cell1-8bit.png",
    animatedBase: "/images/cell1-8bit.png",
    animatedOpen: "/images/cell1-8bit-open.png",
    alt: "Cell A",
  },
  {
    titleKey: "introSlides.s6.title",
    lineKeys: ["introSlides.s6.l1", "introSlides.s6.l2"],
    image: "/images/cell2-8bit.png",
    animatedBase: "/images/cell2-8bit.png",
    animatedOpen: "/images/cell2-8bit-open.png",
    alt: "Cell B",
  },
  {
    titleKey: "introSlides.s7.title",
    lineKeys: ["introSlides.s7.l1", "introSlides.s7.l2"],
    image: "/images/guardian_8bit.png",
    alt: "Guardian Cell",
  },
  {
    titleKey: "introSlides.s8.title",
    lineKeys: ["introSlides.s8.l1", "introSlides.s8.l2"],
    image: "/images/guardian_8bit.png",
    alt: "Guardian Cell",
  },
  {
    titleKey: "introSlides.s9.title",
    lineKeys: ["introSlides.s9.l1", "introSlides.s9.l2"],
    image: "/images/guardian_8bit.png",
    alt: "Guardian Cell",
  },
];

const SUPPORTED_LANGS = ["en", "ms", "zh-CN", "ta"];
const INTRO_ALERT_SOUND_PATH = "/images/alarm.wav";
const GUARDIAN_THEME_SOUND_PATH = "/images/guardian-theme.mp3";
const SUSPECT_THEME_SOUND_PATH = "/images/suspect-theme.mp3";
const GUARDIAN_TEXT_SOUND_PATH = "/images/guardian-text-audio.wav";
const CELL_A_TEXT_SOUND_PATH = "/images/cella-text-audio.wav";
const CELL_B_TEXT_SOUND_PATH = "/images/cellb-text-audio.wav";
const GUARDIAN_SLIDE_INDICES = new Set([1, 2, 3, 4, 7, 8, 9]);
const SUSPECT_SLIDE_INDICES = new Set([5, 6]);

const TEXT_SOUND_BY_SLIDE = {
  5: CELL_A_TEXT_SOUND_PATH,
  6: CELL_B_TEXT_SOUND_PATH,
};

function normalizeLang(raw) {
  if (!raw) return "en";
  const v = String(raw).trim();
  const lower = v.toLowerCase();
  if (lower === "zh" || lower === "zh-cn") return "zh-CN";
  if (SUPPORTED_LANGS.includes(v)) return v;
  return "en";
}

export default function IntroClient() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { eventId, buildQueryString } = useQueryParams();
  const {
    checkingEventAccess,
    isEventAllowed,
    storyModeEnabled,
    eventNotFoundHref,
  } = useEventAccessGuard(eventId, buildQueryString);
  const [isAudioMuted, setIsAudioMuted] = useAudioMuted();
  const queryString = buildQueryString();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [frameOpen, setFrameOpen] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef(null);
  const startDelayRef = useRef(null);
  const fullTextRef = useRef("");
  const introAlarmRef = useRef(null);
  const guardianThemeRef = useRef(null);
  const suspectThemeRef = useRef(null);
  const textRevealAudioRefs = useRef({});

  const selectedLang = useMemo(() => {
    const langFromUrl =
      searchParams.get("lang") || searchParams.get("lng") || searchParams.get("locale");
    return normalizeLang(langFromUrl);
  }, [searchParams]);

  useEffect(() => {
    if (!checkingEventAccess && !isEventAllowed) {
      router.replace(eventNotFoundHref);
    }
  }, [checkingEventAccess, isEventAllowed, eventNotFoundHref, router]);

  useEffect(() => {
    if (!checkingEventAccess && isEventAllowed && storyModeEnabled === false) {
      router.replace(`/questlistpage${buildQueryString()}`);
    }
  }, [checkingEventAccess, isEventAllowed, storyModeEnabled, router, buildQueryString]);

  useEffect(() => {
    if (i18n.language !== selectedLang) {
      i18n.changeLanguage(selectedLang);
    }
  }, [i18n, selectedLang]);

  useEffect(() => {
    introAlarmRef.current = new Audio(INTRO_ALERT_SOUND_PATH);
    introAlarmRef.current.preload = "auto";
    introAlarmRef.current.volume = 0.4;
    introAlarmRef.current.loop = true;
    guardianThemeRef.current = new Audio(GUARDIAN_THEME_SOUND_PATH);
    guardianThemeRef.current.preload = "auto";
    guardianThemeRef.current.volume = 0.35;
    guardianThemeRef.current.loop = true;
    suspectThemeRef.current = new Audio(SUSPECT_THEME_SOUND_PATH);
    suspectThemeRef.current.preload = "auto";
    suspectThemeRef.current.volume = 0.45;
    suspectThemeRef.current.loop = true;
    textRevealAudioRefs.current = {
      [GUARDIAN_TEXT_SOUND_PATH]: new Audio(GUARDIAN_TEXT_SOUND_PATH),
      [CELL_A_TEXT_SOUND_PATH]: new Audio(CELL_A_TEXT_SOUND_PATH),
      [CELL_B_TEXT_SOUND_PATH]: new Audio(CELL_B_TEXT_SOUND_PATH),
    };

    Object.values(textRevealAudioRefs.current).forEach((audio) => {
      audio.preload = "auto";
      audio.volume = 0.1;
      audio.loop = true;
    });

    return () => {
      if (introAlarmRef.current) {
        introAlarmRef.current.pause();
        introAlarmRef.current.currentTime = 0;
        introAlarmRef.current = null;
      }
      if (guardianThemeRef.current) {
        guardianThemeRef.current.pause();
        guardianThemeRef.current.currentTime = 0;
        guardianThemeRef.current = null;
      }
      if (suspectThemeRef.current) {
        suspectThemeRef.current.pause();
        suspectThemeRef.current.currentTime = 0;
        suspectThemeRef.current = null;
      }
      Object.values(textRevealAudioRefs.current).forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      textRevealAudioRefs.current = {};
    };
  }, []);

  useEffect(() => {
    if (introAlarmRef.current) {
      introAlarmRef.current.muted = isAudioMuted;
    }
    if (guardianThemeRef.current) {
      guardianThemeRef.current.muted = isAudioMuted;
    }
    if (suspectThemeRef.current) {
      suspectThemeRef.current.muted = isAudioMuted;
    }
    Object.values(textRevealAudioRefs.current).forEach((audio) => {
      audio.muted = isAudioMuted;
    });

    if (isAudioMuted) {
      if (introAlarmRef.current) {
        introAlarmRef.current.pause();
        introAlarmRef.current.currentTime = 0;
      }
      if (guardianThemeRef.current) {
        guardianThemeRef.current.pause();
        guardianThemeRef.current.currentTime = 0;
      }
      if (suspectThemeRef.current) {
        suspectThemeRef.current.pause();
        suspectThemeRef.current.currentTime = 0;
      }
      Object.values(textRevealAudioRefs.current).forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
    }
  }, [isAudioMuted]);

  const finishTyping = () => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    if (startDelayRef.current) clearTimeout(startDelayRef.current);
    Object.values(textRevealAudioRefs.current).forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    setTypedText(fullTextRef.current);
    setIsTyping(false);
  };

  const goPrev = () => setCurrentSlide((prev) => Math.max(0, prev - 1));

  const goNext = () => {
    if (isTyping) {
      finishTyping();
      return;
    }
    setCurrentSlide((prev) => Math.min(slides.length - 1, prev + 1));
  };

  const slide = slides[currentSlide];
  const title = slide.titleKey ? t(slide.titleKey) : "";
  const lines = useMemo(
    () => (Array.isArray(slide.lineKeys) ? slide.lineKeys.map((k) => t(k)) : []),
    [slide.lineKeys, t]
  );
  const fullText = useMemo(() => lines.join("\n"), [lines]);
  const animatedImage =
    slide.animatedBase && slide.animatedOpen
      ? frameOpen
        ? slide.animatedOpen
        : slide.animatedBase
      : slide.image;

  const displayedLines = typedText.split("\n");

  useEffect(() => {
    fullTextRef.current = fullText;

    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    if (startDelayRef.current) clearTimeout(startDelayRef.current);

    if (!fullText.length) {
      startDelayRef.current = setTimeout(() => {
        setTypedText("");
        setIsTyping(false);
      }, 0);
      return;
    }

    let idx = 0;

    startDelayRef.current = setTimeout(() => {
      setTypedText("");
      setIsTyping(true);
      typingTimerRef.current = setInterval(() => {
        idx += 1;
        setTypedText(fullText.slice(0, idx));
        if (idx >= fullText.length) {
          if (typingTimerRef.current) clearInterval(typingTimerRef.current);
          setIsTyping(false);
        }
      }, 50);
    }, 210);

    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      if (startDelayRef.current) clearTimeout(startDelayRef.current);
    };
  }, [fullText]);

  useEffect(() => {
    const timer = setInterval(() => setFrameOpen((prev) => !prev), 750);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const activeSoundPath = TEXT_SOUND_BY_SLIDE[currentSlide] || GUARDIAN_TEXT_SOUND_PATH;
    const activeAudio = textRevealAudioRefs.current[activeSoundPath];

    if (!isTyping || isAudioMuted) {
      Object.values(textRevealAudioRefs.current).forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      return;
    }

    if (!activeAudio) {
      return;
    }

    Object.entries(textRevealAudioRefs.current).forEach(([soundPath, audio]) => {
      if (soundPath !== activeSoundPath) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    try {
      const playPromise = activeAudio.paused ? activeAudio.play() : null;
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Ignore blocked playback so text reveal still works normally.
        });
      }
    } catch {
      // Ignore playback issues so typing animation is unaffected.
    }
  }, [currentSlide, isAudioMuted, isTyping]);

  useEffect(() => {
    const audio = introAlarmRef.current;
    if (!audio) return;

    const shouldPlay =
      !isAudioMuted &&
      !checkingEventAccess &&
      isEventAllowed &&
      storyModeEnabled !== false &&
      currentSlide === 0;

    if (!shouldPlay) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }

    try {
      const playPromise = audio.paused ? audio.play() : null;
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Ignore blocked playback so the intro still works normally.
        });
      }
    } catch {
      // Ignore playback issues so the story flow is unaffected.
    }
  }, [checkingEventAccess, currentSlide, isAudioMuted, isEventAllowed, storyModeEnabled]);

  useEffect(() => {
    const audio = guardianThemeRef.current;
    if (!audio) return;

    const shouldPlay =
      !isAudioMuted &&
      !checkingEventAccess &&
      isEventAllowed &&
      storyModeEnabled !== false &&
      GUARDIAN_SLIDE_INDICES.has(currentSlide);

    if (!shouldPlay) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }

    try {
      const playPromise = audio.paused ? audio.play() : null;
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Ignore blocked playback so the intro still works normally.
        });
      }
    } catch {
      // Ignore playback issues so the story flow is unaffected.
    }
  }, [checkingEventAccess, currentSlide, isAudioMuted, isEventAllowed, storyModeEnabled]);

  useEffect(() => {
    const audio = suspectThemeRef.current;
    if (!audio) return;

    const shouldPlay =
      !isAudioMuted &&
      !checkingEventAccess &&
      isEventAllowed &&
      storyModeEnabled !== false &&
      SUSPECT_SLIDE_INDICES.has(currentSlide);

    if (!shouldPlay) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }

    try {
      const playPromise = audio.paused ? audio.play() : null;
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Ignore blocked playback so the intro still works normally.
        });
      }
    } catch {
      // Ignore playback issues so the story flow is unaffected.
    }
  }, [checkingEventAccess, currentSlide, isAudioMuted, isEventAllowed, storyModeEnabled]);

  if (checkingEventAccess || (!checkingEventAccess && !isEventAllowed)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-slate-900 to-black text-stone-100 flex items-center justify-center">
        <div className="text-xl font-mono">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-slate-900 to-black text-stone-100 flex flex-col items-center justify-center p-6 space-y-0">
      <div className="w-full max-w-3xl">
        <div className="relative w-full rounded-sm overflow-hidden">
          <AudioToggleButton />
          <Link
            href={`/questlistpage${queryString}`}
            className="absolute top-3 left-3 z-20 bg-red-900 hover:bg-red-800 text-stone-100 font-mono font-bold py-2 px-10 rounded-sm border-2 border-stone-950 shadow-lg uppercase tracking-wider text-sm transition-all"
          >
            {t("intro.skip")} ⏭
          </Link>
          <Image
            src={animatedImage}
            alt={slide.alt}
            width={1200}
            height={600}
            className="w-full h-auto object-cover"
            unoptimized
          />

          <div className="absolute inset-x-4 bottom-4 flex justify-between">
            {currentSlide > 0 ? (
              <button
                className="bg-stone-800 hover:bg-stone-700 disabled:bg-stone-600 disabled:text-stone-300 text-stone-100 font-mono font-bold py-2 px-4 rounded-sm border-2 border-stone-950 shadow-lg uppercase tracking-wider text-sm transition-all"
                type="button"
                onClick={goPrev}
              >
                ◀ {t("intro.back")}
              </button>
            ) : (
              <span />
            )}
            {currentSlide < slides.length - 1 ? (
              <button
                className="bg-stone-800 hover:bg-stone-700 disabled:bg-stone-600 disabled:text-stone-300 text-stone-100 font-mono font-bold py-2 px-4 rounded-sm border-2 border-stone-950 shadow-lg uppercase tracking-wider text-sm transition-all"
                type="button"
                onClick={goNext}
              >
                {t("intro.next")} ▶
              </button>
            ) : (
              <button
                type="button"
                className="bg-stone-800 hover:bg-stone-700 text-stone-100 font-mono font-bold py-2 px-4 rounded-sm border-2 border-stone-950 shadow-lg uppercase tracking-wider text-sm transition-all"
                onClick={() => {
                  if (isTyping) {
                    finishTyping();
                    return;
                  }
                  router.push(`/questlistpage${queryString}`);
                }}
              >
                {t("intro.proceed")} ▶
              </button>
            )}
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
            {title}
          </div>
          {displayedLines.map((line, idx) => (
            <p
              key={idx}
              className="text-stone-900 text-lg leading-relaxed font-mono"
              style={{ textShadow: "1px 1px 0px rgba(255,255,255,0.6)" }}
            >
              {line}
              {idx === displayedLines.length - 1 && isTyping && (
                <span className="inline-block w-2 h-5 bg-stone-900 align-middle ml-1 animate-pulse" />
              )}
            </p>
          ))}
        </RpgCard>
      </div>
    </div>
  );
}
