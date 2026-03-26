"use client";

import { useEffect, useRef } from "react";
import { useAudioMuted } from "./audioPreferences";

export default function useLoopingAudio(src, { enabled = true, volume = 0.35 } = {}) {
  const audioRef = useRef(null);
  const [isMuted] = useAudioMuted();

  useEffect(() => {
    if (!enabled) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      return undefined;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.preload = "auto";
      audioRef.current.loop = true;
    }

    audioRef.current.volume = volume;
    audioRef.current.muted = isMuted;

    if (isMuted) {
      return undefined;
    }

    function tryPlay() {
      if (!audioRef.current || !audioRef.current.paused) return;
      try {
        const p = audioRef.current.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => {});
        }
      } catch {
        // Ignore playback issues so the UI remains functional.
      }
    }

    // Attempt immediate playback.
    tryPlay();

    // If the browser blocks autoplay, retry on the first user interaction.
    const interactionEvents = ["click", "keydown", "touchstart"];
    function onInteraction() {
      tryPlay();
      interactionEvents.forEach((evt) =>
        document.removeEventListener(evt, onInteraction, { capture: true })
      );
    }
    interactionEvents.forEach((evt) =>
      document.addEventListener(evt, onInteraction, { capture: true, once: true })
    );

    return () => {
      interactionEvents.forEach((evt) =>
        document.removeEventListener(evt, onInteraction, { capture: true })
      );
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [enabled, isMuted, src, volume]);
}
