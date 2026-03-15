"use client";

import { useEffect, useState } from "react";

const AUDIO_MUTED_KEY = "audioMuted";
const AUDIO_MUTE_EVENT = "audioMuteChanged";

export function getAudioMuted() {
  if (typeof window === "undefined") return false;

  try {
    return localStorage.getItem(AUDIO_MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAudioMuted(nextMuted) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(AUDIO_MUTED_KEY, nextMuted ? "1" : "0");
  } catch {
    // Ignore storage failures and still emit in-memory change.
  }

  window.dispatchEvent(new CustomEvent(AUDIO_MUTE_EVENT, { detail: { muted: nextMuted } }));
}

export function useAudioMuted() {
  const [isMuted, setIsMuted] = useState(() => getAudioMuted());

  useEffect(() => {
    const handleMuteChange = (event) => {
      const mutedFromEvent = event?.detail?.muted;
      if (typeof mutedFromEvent === "boolean") {
        setIsMuted(mutedFromEvent);
        return;
      }

      setIsMuted(getAudioMuted());
    };

    const handleStorage = (event) => {
      if (event.key && event.key !== AUDIO_MUTED_KEY) return;
      setIsMuted(getAudioMuted());
    };

    window.addEventListener(AUDIO_MUTE_EVENT, handleMuteChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(AUDIO_MUTE_EVENT, handleMuteChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return [isMuted, setAudioMuted];
}
