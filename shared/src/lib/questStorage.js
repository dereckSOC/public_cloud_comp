import { STORAGE_KEYS } from "./storageKeys";

export function getCompletedQuests() {
    if (typeof window === "undefined") return [];

    // Clean up expired quests first
    const validQuests = [];
    const stored = localStorage.getItem(STORAGE_KEYS.COMPLETED_QUESTS);
    let questList = [];
    try {
        questList = stored ? JSON.parse(stored) : [];
    } catch {
        // Corrupted data — treat as empty and reset below
    }

    for (const questId of questList) {
        const questData = localStorage.getItem(STORAGE_KEYS.questCompleted(questId));

        // If individual quest data exists, it's still valid
        if (questData) {
            validQuests.push(questId);
        }
    }

    // Update the main list if any quests were removed
    if (validQuests.length !== questList.length) {
        localStorage.setItem(STORAGE_KEYS.COMPLETED_QUESTS, JSON.stringify(validQuests));
    }

    return validQuests;
}

export function markQuestComplete(questId) {
    const id = String(questId);
    const completed = getCompletedQuests();
    if (!completed.includes(id)) {
        completed.push(id);
        localStorage.setItem(STORAGE_KEYS.COMPLETED_QUESTS, JSON.stringify(completed));

        // Also store individual quest with timestamp for cleanup
        const questData = {
            questId: id,
            completedAt: new Date().toISOString(),
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEYS.questCompleted(id), JSON.stringify(questData));
    }
}

export function isQuestCompleted(questId) {
    const completed = getCompletedQuests();
    return completed.includes(String(questId));
}

export function resetAllQuests() {
    // Remove individual quest entries first to avoid leaving orphans
    const completed = getCompletedQuests();
    completed.forEach(id => localStorage.removeItem(STORAGE_KEYS.questCompleted(id)));
    localStorage.removeItem(STORAGE_KEYS.COMPLETED_QUESTS);
}

export function areAllQuestsCompleted(questIds) {
    const completed = getCompletedQuests();
    return questIds.length > 0 && questIds.every(id => completed.includes(String(id)));
}
