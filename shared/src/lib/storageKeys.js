/**
 * Centralised localStorage key definitions and shared timing constants.
 *
 * All localStorage keys used by this application are defined here so that:
 *  - Key strings have a single source of truth (rename in one place)
 *  - The shared ONE_DAY_MS constant is not duplicated across modules
 *
 * Usage:
 *   import { STORAGE_KEYS, ONE_DAY_MS } from "@/lib/storageKeys";
 *
 *   localStorage.getItem(STORAGE_KEYS.COMPLETED_QUESTS);
 *   localStorage.getItem(STORAGE_KEYS.questCompleted(questId));
 *   localStorage.getItem(STORAGE_KEYS.eventSeen(eventId));
 */

/** 24 hours expressed in milliseconds. */
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const STORAGE_KEYS = {
  /** Index of all completed quest IDs (JSON array of strings). */
  COMPLETED_QUESTS: "completedQuests",

  /** Per-quest completion record with timestamp. Value: JSON object. */
  questCompleted: (id) => `questCompleted:${id}`,

  /** Feedback outcome payload for a given event. Value: JSON object. */
  feedbackOutcome: (eventId) => `feedbackOutcome:${eventId}`,

  /** Persistent marker for first-seen device entry per event. Value: "1". */
  eventSeen: (eventId) => `eventSeen:${eventId}`,

  /** Persistent marker for booth completion tracking per event + quest. Value: "1". */
  boothTracked: (eventId, questId) => `boothTracked:${eventId}:${questId}`,

};

/**
 * Session-only keys used to enforce in-app flow transitions.
 * Values are simple string markers (e.g. "1") in sessionStorage.
 */
export const SESSION_KEYS = {
  feedbackPageAccess: (eventId) => `feedbackFlow:page:${eventId}`,
  feedbackSceneAccess: (eventId) => `feedbackFlow:scene:${eventId}`,
};

/**
 * Key prefix strings used for startsWith() checks during cleanup.
 * Keep in sync with the key builders above.
 */
export const STORAGE_KEY_PREFIXES = {
  QUEST_COMPLETED: "questCompleted:",
  FEEDBACK_OUTCOME: "feedbackOutcome:",
  EVENT_SEEN: "eventSeen:",
  BOOTH_TRACKED: "boothTracked:",
};
