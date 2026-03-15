import { ONE_DAY_MS, STORAGE_KEY_PREFIXES } from "./storageKeys";

/**
 * Clean up all localStorage data older than 24 hours
 * This checks timestamps in stored data and removes expired entries
 */
export function cleanupOldLocalStorage() {
  try {
    const now = Date.now();
    const keysToRemove = [];

    for (const key of Object.keys(localStorage)) {
      try {
        // Persistent analytics markers are intentionally not time-expired.
        if (
          key.startsWith(STORAGE_KEY_PREFIXES.EVENT_SEEN) ||
          key.startsWith(STORAGE_KEY_PREFIXES.BOOTH_TRACKED)
        ) {
          continue;
        }

        // Handle feedbackOutcome entries (JSON with submittedAt)
        if (key.startsWith(STORAGE_KEY_PREFIXES.FEEDBACK_OUTCOME)) {
          const data = JSON.parse(localStorage.getItem(key));
          if (data?.submittedAt) {
            const submittedTime = new Date(data.submittedAt).getTime();
            const age = now - submittedTime;
            if (age > ONE_DAY_MS) {
              keysToRemove.push(key);
            }
          }
          continue;
        }

        // Handle questCompleted entries (JSON object with completedAt or timestamp)
        if (key.startsWith(STORAGE_KEY_PREFIXES.QUEST_COMPLETED)) {
          const value = localStorage.getItem(key);

          try {
            const data = JSON.parse(value);
            if (data?.completedAt) {
              const completedTime = new Date(data.completedAt).getTime();
              const age = now - completedTime;
              if (age > ONE_DAY_MS) {
                keysToRemove.push(key);
              }
            } else if (data?.timestamp) {
              // timestamp is stored as a Unix ms number (Date.now()) by questStorage.js
              const age = now - data.timestamp;
              if (age > ONE_DAY_MS) {
                keysToRemove.push(key);
              }
            }
          } catch {
            // If it's not JSON, check if it's a raw Unix timestamp
            const timestamp = parseInt(value, 10);
            if (!isNaN(timestamp)) {
              const age = now - timestamp;
              if (age > ONE_DAY_MS) {
                keysToRemove.push(key);
              }
            }
          }
          continue;
        }

        // Handle any other app-specific data with timestamps
        // Try to parse as JSON and check for common timestamp fields
        const value = localStorage.getItem(key);
        if (value) {
          try {
            const data = JSON.parse(value);
            const timestampFields = ['timestamp', 'createdAt', 'updatedAt', 'submittedAt', 'completedAt'];

            for (const field of timestampFields) {
              if (data?.[field]) {
                const timestamp = new Date(data[field]).getTime();
                const age = now - timestamp;
                if (age > ONE_DAY_MS) {
                  keysToRemove.push(key);
                  break;
                }
              }
            }
          } catch {
            // Not JSON or doesn't have timestamp, skip
          }
        }
      } catch {
        // Skip keys that can't be processed
      }
    }

    // If every individual questCompleted:<id> entry was expired, also remove
    // the completedQuests index (which has no timestamp of its own).
    const completedQuestsRaw = localStorage.getItem('completedQuests');
    if (completedQuestsRaw) {
      try {
        const ids = JSON.parse(completedQuestsRaw);
        const allExpired = Array.isArray(ids) && ids.every(id =>
          keysToRemove.includes(`questCompleted:${id}`) ||
          !localStorage.getItem(`questCompleted:${id}`)
        );
        if (allExpired) {
          keysToRemove.push('completedQuests');
        }
      } catch {
        // Corrupted index — remove it too
        keysToRemove.push('completedQuests');
      }
    }

    // Remove all expired keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    return keysToRemove.length;
  } catch {
    return 0;
  }
}

/**
 * Set up automatic cleanup that runs periodically.
 * Guarded against duplicate calls (React StrictMode, hot reload).
 * @param {number} intervalMs - How often to run cleanup (default: 1 hour)
 */
let _cleanupTeardown = null;

export function setupAutoCleanup(intervalMs = 60 * 60 * 1000) {
  // Prevent duplicate intervals from multiple calls
  if (_cleanupTeardown) return _cleanupTeardown;

  // Run cleanup immediately
  cleanupOldLocalStorage();

  // Set up periodic cleanup
  const cleanupInterval = setInterval(() => {
    cleanupOldLocalStorage();
  }, intervalMs);

  // Return cleanup function to stop the interval if needed
  _cleanupTeardown = () => {
    clearInterval(cleanupInterval);
    _cleanupTeardown = null;
  };
  return _cleanupTeardown;
}

/**
 * Clear ALL localStorage data (development/testing only).
 * No-op in production builds.
 */
export function clearAllLocalStorage() {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof window !== 'undefined' && window.localStorage) {
    const confirmed = confirm('This will clear ALL localStorage data. Are you sure?');
    if (confirmed) {
      localStorage.clear();
      window.location.reload();
    }
  }
}
