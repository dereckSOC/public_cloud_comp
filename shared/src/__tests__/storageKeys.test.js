import {
  ONE_DAY_MS,
  STORAGE_KEYS,
  SESSION_KEYS,
  STORAGE_KEY_PREFIXES,
} from "../lib/storageKeys.js";

describe("ONE_DAY_MS", () => {
  it("equals 86400000", () => {
    expect(ONE_DAY_MS).toBe(86_400_000);
  });
});

describe("STORAGE_KEYS", () => {
  it("questCompleted builds correct key", () => {
    expect(STORAGE_KEYS.questCompleted("42")).toBe("questCompleted:42");
  });

  it("feedbackOutcome builds correct key", () => {
    expect(STORAGE_KEYS.feedbackOutcome(3)).toBe("feedbackOutcome:3");
  });

  it("eventSeen builds correct key", () => {
    expect(STORAGE_KEYS.eventSeen(7)).toBe("eventSeen:7");
  });

  it("boothTracked builds correct key", () => {
    expect(STORAGE_KEYS.boothTracked(1, 2)).toBe("boothTracked:1:2");
  });
});

describe("SESSION_KEYS", () => {
  it("feedbackPageAccess builds correct key", () => {
    expect(SESSION_KEYS.feedbackPageAccess(5)).toBe("feedbackFlow:page:5");
  });

  it("feedbackSceneAccess builds correct key", () => {
    expect(SESSION_KEYS.feedbackSceneAccess(5)).toBe("feedbackFlow:scene:5");
  });
});

describe("STORAGE_KEY_PREFIXES", () => {
  it("QUEST_COMPLETED prefix matches questCompleted key", () => {
    expect(STORAGE_KEYS.questCompleted("1").startsWith(STORAGE_KEY_PREFIXES.QUEST_COMPLETED)).toBe(true);
  });

  it("FEEDBACK_OUTCOME prefix matches feedbackOutcome key", () => {
    expect(STORAGE_KEYS.feedbackOutcome(1).startsWith(STORAGE_KEY_PREFIXES.FEEDBACK_OUTCOME)).toBe(true);
  });
});
