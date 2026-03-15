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

    try {
      const playPromise = audioRef.current.paused ? audioRef.current.play() : null;
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Ignore blocked playback so the page still works normally.
        });
      }
    } catch {
      // Ignore playback issues so the UI remains functional.
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [enabled, isMuted, src, volume]);
}
