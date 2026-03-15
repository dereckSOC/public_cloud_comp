"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAudioMuted } from "../lib/audioPreferences";

const CLICK_SOUND_PATH = "/images/click.mp3";
const ADMIN_ROUTE_PREFIXES = ["/dashboard", "/events", "/login", "/superadmin", "/unauthorized"];

function isAdminRoute(pathname) {
  return ADMIN_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isInteractiveTarget(target) {
  if (!(target instanceof Element)) return false;

  const clickable = target.closest("button, a, [role='button']");
  if (!clickable) return false;
  if (clickable instanceof HTMLButtonElement && clickable.disabled) return false;
  if (clickable.getAttribute("aria-disabled") === "true") return false;

  return true;
}

export default function GlobalClickSound() {
  const pathname = usePathname();
  const audioRef = useRef(null);
  const [isMuted] = useAudioMuted();

  useEffect(() => {
    if (isAdminRoute(pathname) || isMuted) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      return undefined;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(CLICK_SOUND_PATH);
      audioRef.current.preload = "auto";
      audioRef.current.volume = 0.35;
    }
    audioRef.current.muted = isMuted;

    const handlePointerDown = (event) => {
      if (!isInteractiveTarget(event.target)) return;

      const audio = audioRef.current;
      if (!audio || audio.muted) return;

      try {
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            // Ignore blocked playback so clicks still work normally.
          });
        }
      } catch {
        // Ignore autoplay or playback issues so navigation is unaffected.
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isMuted, pathname]);

  return null;
}
