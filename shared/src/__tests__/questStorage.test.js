/**
 * questStorage tests — run in jsdom so localStorage is available.
 * @jest-environment jsdom
 */

import {
  getCompletedQuests,
  markQuestComplete,
  isQuestCompleted,
  resetAllQuests,
  areAllQuestsCompleted,
} from "../lib/questStorage.js";

beforeEach(() => localStorage.clear());

describe("markQuestComplete / isQuestCompleted", () => {
  it("marks a quest as complete", () => {
    markQuestComplete("q1");
    expect(isQuestCompleted("q1")).toBe(true);
  });

  it("coerces numeric id to string", () => {
    markQuestComplete(42);
    expect(isQuestCompleted("42")).toBe(true);
  });

  it("does not duplicate entries", () => {
    markQuestComplete("q1");
    markQuestComplete("q1");
    expect(getCompletedQuests()).toHaveLength(1);
  });
});

describe("getCompletedQuests", () => {
  it("returns empty array when nothing stored", () => {
    expect(getCompletedQuests()).toEqual([]);
  });

  it("filters out quests whose individual record was removed", () => {
    markQuestComplete("q1");
    localStorage.removeItem("questCompleted:q1");
    expect(getCompletedQuests()).toEqual([]);
  });
});

describe("resetAllQuests", () => {
  it("clears all quests", () => {
    markQuestComplete("q1");
    markQuestComplete("q2");
    resetAllQuests();
    expect(getCompletedQuests()).toEqual([]);
  });
});

describe("areAllQuestsCompleted", () => {
  it("returns false for empty input", () => {
    expect(areAllQuestsCompleted([])).toBe(false);
  });

  it("returns true when all given quests are complete", () => {
    markQuestComplete("a");
    markQuestComplete("b");
    expect(areAllQuestsCompleted(["a", "b"])).toBe(true);
  });

  it("returns false when some quests are incomplete", () => {
    markQuestComplete("a");
    expect(areAllQuestsCompleted(["a", "b"])).toBe(false);
  });
});
