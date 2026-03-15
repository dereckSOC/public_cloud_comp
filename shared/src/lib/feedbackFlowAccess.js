import { SESSION_KEYS } from "./storageKeys";

function normalizeEventId(eventId) {
  const parsed = Number(eventId);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return String(parsed);
}

function setSessionMarker(key) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // Ignore storage-disabled environments.
  }
}

function hasSessionMarker(key) {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function removeSessionMarker(key) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage-disabled environments.
  }
}

export function markFeedbackPageEntryAllowed(eventId) {
  const normalized = normalizeEventId(eventId);
  if (!normalized) return false;
  setSessionMarker(SESSION_KEYS.feedbackPageAccess(normalized));
  return true;
}

export function canAccessFeedbackPage(eventId) {
  const normalized = normalizeEventId(eventId);
  if (!normalized) return false;
  return hasSessionMarker(SESSION_KEYS.feedbackPageAccess(normalized));
}

export function consumeFeedbackPageAccess(eventId) {
  const normalized = normalizeEventId(eventId);
  if (!normalized) return;
  removeSessionMarker(SESSION_KEYS.feedbackPageAccess(normalized));
}

export function markFeedbackSceneEntryAllowed(eventId) {
  const normalized = normalizeEventId(eventId);
  if (!normalized) return false;
  setSessionMarker(SESSION_KEYS.feedbackSceneAccess(normalized));
  return true;
}

export function canAccessFeedbackScene(eventId) {
  const normalized = normalizeEventId(eventId);
  if (!normalized) return false;
  return hasSessionMarker(SESSION_KEYS.feedbackSceneAccess(normalized));
}

export function consumeFeedbackSceneAccess(eventId) {
  const normalized = normalizeEventId(eventId);
  if (!normalized) return;
  removeSessionMarker(SESSION_KEYS.feedbackSceneAccess(normalized));
}
