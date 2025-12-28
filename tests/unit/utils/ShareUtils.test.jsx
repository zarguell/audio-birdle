import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateShareText,
  generateHardModeShareText,
  shareResult,
} from "@/utils/ShareUtils";

describe("ShareUtils", () => {
  describe("generateShareText", () => {
    const completedGameState = {
      date: "2025-12-27",
      region: "us",
      guesses: [
        { birdId: "barswa", correct: false },
        { birdId: "amerob", correct: true },
      ],
      completed: true,
      won: true,
      maxGuesses: 4,
    };

    const lostGameState = {
      date: "2025-12-27",
      region: "eu",
      guesses: [
        { birdId: "wrong1", correct: false },
        { birdId: "wrong2", correct: false },
        { birdId: "wrong3", correct: false },
        { birdId: "wrong4", correct: false },
      ],
      completed: true,
      won: false,
      maxGuesses: 4,
    };

    it("should generate share text for won game", () => {
      const shareText = generateShareText(
        completedGameState,
        "https://audio-birdle.com",
      );

      expect(shareText).toContain("🐦 Audio-Birdle 2025-12-27");
      expect(shareText).toContain("Region: US");
      expect(shareText).toContain("2/4");
      expect(shareText).toContain("🟥🟩");
      expect(shareText).toContain("https://audio-birdle.com");
    });

    it("should generate share text for lost game", () => {
      const shareText = generateShareText(
        lostGameState,
        "https://audio-birdle.com",
      );

      expect(shareText).toContain("🐦 Audio-Birdle 2025-12-27");
      expect(shareText).toContain("Region: EU");
      expect(shareText).toContain("X/4");
      expect(shareText).toContain("🟥🟥🟥🟥");
    });

    it("should return empty string for incomplete game", () => {
      const incompleteState = {
        ...completedGameState,
        completed: false,
      };

      const shareText = generateShareText(
        incompleteState,
        "https://audio-birdle.com",
      );

      expect(shareText).toBe("");
    });

    it("should return empty string for null game state", () => {
      const shareText = generateShareText(null, "https://audio-birdle.com");

      expect(shareText).toBe("");
    });

    it("should format guess result grid correctly", () => {
      const shareText = generateShareText(
        completedGameState,
        "https://audio-birdle.com",
      );
      const lines = shareText.split("\n");

      // Lines are: [0]emoji+date, [1]region, [2]score, [3]empty, [4]grid, [5]empty, [6]url
      expect(lines[4]).toBe("🟥🟩");
    });

    it("should handle single guess win", () => {
      const singleGuessState = {
        ...completedGameState,
        guesses: [{ birdId: "amerob", correct: true }],
      };

      const shareText = generateShareText(
        singleGuessState,
        "https://audio-birdle.com",
      );

      expect(shareText).toContain("1/4");
      expect(shareText).toContain("🟩");
    });

    it("should handle max guesses loss", () => {
      const shareText = generateShareText(
        lostGameState,
        "https://audio-birdle.com",
      );

      expect(shareText).toContain("X/4");
    });
  });

  describe("generateHardModeShareText", () => {
    const completedHardModeState = {
      date: "2025-12-27",
      region: "us",
      guesses: [
        {
          birdId: "barswa",
          textInput: "Barn Swallow",
          correct: false,
          taxonomicScore: {
            order: true,
            family: false,
            genus: false,
            species: false,
          },
        },
        {
          birdId: "anotherthrush",
          textInput: "Wood Thrush",
          correct: false,
          taxonomicScore: {
            order: true,
            family: true,
            genus: false,
            species: false,
          },
        },
        {
          birdId: "amerob",
          textInput: "American Robin",
          correct: true,
          taxonomicScore: {
            order: true,
            family: true,
            genus: true,
            species: true,
          },
        },
      ],
      completed: true,
      won: true,
      maxGuesses: 6,
    };

    const lostHardModeState = {
      date: "2025-12-27",
      region: "eu",
      guesses: [
        {
          birdId: null,
          textInput: "Nonexistent Bird",
          correct: false,
          taxonomicScore: {
            order: false,
            family: false,
            genus: false,
            species: false,
          },
        },
        {
          birdId: "wrong1",
          textInput: "Wrong Bird",
          correct: false,
          taxonomicScore: {
            order: false,
            family: false,
            genus: false,
            species: false,
          },
        },
      ],
      completed: true,
      won: false,
      maxGuesses: 6,
    };

    it("should generate share text for won hard mode game", () => {
      const shareText = generateHardModeShareText(
        completedHardModeState,
        "https://audio-birdle.com",
      );

      expect(shareText).toContain("🔥 Audio-Birdle Hard Mode 2025-12-27");
      expect(shareText).toContain("Region: US");
      expect(shareText).toContain("3/6");
      expect(shareText).not.toContain("American Robin");
      expect(shareText).toContain("https://audio-birdle.com");
    });

    it("should generate share text for lost hard mode game", () => {
      const shareText = generateHardModeShareText(
        lostHardModeState,
        "https://audio-birdle.com",
      );

      expect(shareText).toContain("😔 Audio-Birdle Hard Mode 2025-12-27");
      expect(shareText).toContain("Region: EU");
      expect(shareText).toContain("X/6");
      expect(shareText).not.toContain("European Robin");
    });

    it("should show green for correct guess", () => {
      const shareText = generateHardModeShareText(
        completedHardModeState,
        "https://audio-birdle.com",
      );

      expect(shareText).toContain("🟩");
    });

    it("should show orange for order matches (2 taxonomic matches)", () => {
      const shareText = generateHardModeShareText(
        completedHardModeState,
        "https://audio-birdle.com",
      );

      // Second guess has order + family = 2 matches = 🟧
      expect(shareText).toContain("🟧");
    });

    it("should show red for no taxonomic match", () => {
      const shareText = generateHardModeShareText(
        completedHardModeState,
        "https://audio-birdle.com",
      );

      // First guess has only order = 1 match = 🟥
      expect(shareText).toContain("🟥");
    });

    it("should return empty string for incomplete game", () => {
      const incompleteState = {
        ...completedHardModeState,
        completed: false,
      };

      const shareText = generateHardModeShareText(
        incompleteState,
        "https://audio-birdle.com",
      );

      expect(shareText).toBe("");
    });

    it("should return empty string for null game state", () => {
      const shareText = generateHardModeShareText(
        null,
        "https://audio-birdle.com",
      );

      expect(shareText).toBe("");
    });

    it("should handle single guess win in hard mode", () => {
      const singleGuessState = {
        ...completedHardModeState,
        guesses: [
          {
            birdId: "amerob",
            textInput: "American Robin",
            correct: true,
            taxonomicScore: {
              order: true,
              family: true,
              genus: true,
              species: true,
            },
          },
        ],
      };

      const shareText = generateHardModeShareText(
        singleGuessState,
        "https://audio-birdle.com",
      );

      expect(shareText).toContain("1/6");
      expect(shareText).not.toContain("American Robin");
      expect(shareText).toContain("🟩");
    });

    it("should handle non-matching bird guesses", () => {
      const shareText = generateHardModeShareText(
        lostHardModeState,
        "https://audio-birdle.com",
      );

      // First guess has no bird match (null birdId)
      expect(shareText).toContain("🟥");
    });
  });

  describe("shareResult", () => {
    const shareText =
      "🐦 Audio-Birdle 2025-12-27\nRegion: US\n2/4\n\n🟥🟩\n\nhttps://audio-birdle.com";

    beforeEach(() => {
      // Mock navigator.clipboard
      global.navigator = {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      };
    });

    it("should use Web Share API on mobile devices", async () => {
      // Mock mobile user agent
      Object.defineProperty(navigator, "userAgent", {
        value: "iPhone",
        writable: true,
      });

      global.navigator.share = vi.fn().mockResolvedValue(undefined);

      const result = await shareResult(shareText);

      expect(navigator.share).toHaveBeenCalledWith({
        title: "Audio-Birdle Result",
        text: shareText,
      });
      expect(result).toBe(true);
    });

    it("should fallback to clipboard on desktop", async () => {
      // Mock desktop user agent
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        writable: true,
      });

      const result = await shareResult(shareText);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(shareText);
      expect(result).toBe(true);
    });

    it("should handle clipboard write errors gracefully", async () => {
      // Mock clipboard error
      global.navigator.clipboard.writeText = vi
        .fn()
        .mockRejectedValue(new Error("Clipboard error"));

      // Mock document.execCommand to fail
      document.execCommand = vi.fn().mockReturnValue(false);

      // Mock prompt (final fallback)
      global.prompt = vi.fn();

      const result = await shareResult(shareText);

      // Should show prompt and return false
      expect(prompt).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should handle errors and show prompt as final fallback", async () => {
      global.navigator.clipboard.writeText = vi
        .fn()
        .mockRejectedValue(new Error("Failed"));
      document.execCommand = vi.fn().mockReturnValue(false);
      global.prompt = vi.fn();

      await shareResult(shareText);

      expect(prompt).toHaveBeenCalledWith("Share your result:", shareText);
    });
  });
});
