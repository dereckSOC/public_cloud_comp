"use client";

import { useAudioMuted } from "../lib/audioPreferences";

function SpeakerIcon({ muted }) {
  if (muted) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="m23 9-6 6" />
        <path d="m17 9 6 6" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

const DEFAULT_CLASS_NAME =
  "absolute top-3 right-3 z-20 inline-flex items-center justify-center bg-stone-800/90 hover:bg-stone-700 text-stone-100 rounded-sm border-2 border-stone-950 shadow-lg transition-all h-12 w-12";

export default function AudioToggleButton({ className = DEFAULT_CLASS_NAME }) {
  const [isAudioMuted, setIsAudioMuted] = useAudioMuted();

  return (
    <button
      type="button"
      onClick={() => setIsAudioMuted(!isAudioMuted)}
      className={className}
      aria-label={isAudioMuted ? "Unmute audio" : "Mute audio"}
      title={isAudioMuted ? "Unmute audio" : "Mute audio"}
    >
      <SpeakerIcon muted={isAudioMuted} />
    </button>
  );
}
