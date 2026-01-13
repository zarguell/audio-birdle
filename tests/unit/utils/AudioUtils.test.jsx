import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createAudioControls,
  getAudioSrc,
  isAudioUrlDead,
  markAudioUrlDead,
  loadDeadAudioUrlsCache,
  saveDeadAudioUrlsCache,
  clearDeadAudioUrlsCache,
} from "@/utils/AudioUtils";

describe("AudioUtils", () => {
  let mockAudioRef;

  beforeEach(() => {
    mockAudioRef = {
      current: {
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        load: vi.fn(),
        currentTime: 0,
      },
    };
  });

  describe("createAudioControls", () => {
    it("should create audio controls object", () => {
      const controls = createAudioControls(mockAudioRef);

      expect(controls).toHaveProperty("playAudio");
      expect(controls).toHaveProperty("pauseAudio");
      expect(controls).toHaveProperty("stopAudio");
      expect(typeof controls.playAudio).toBe("function");
      expect(typeof controls.pauseAudio).toBe("function");
      expect(typeof controls.stopAudio).toBe("function");
    });
  });

  describe("playAudio", () => {
    it("should play audio successfully", async () => {
      const controls = createAudioControls(mockAudioRef);
      const result = await controls.playAudio();

      expect(mockAudioRef.current.play).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should return false if audio ref is null", async () => {
      mockAudioRef.current = null;
      const controls = createAudioControls(mockAudioRef);
      const result = await controls.playAudio();

      expect(result).toBe(false);
      expect(mockAudioRef.current).toBeNull();
    });

    it("should return false if audio ref is undefined", async () => {
      mockAudioRef.current = undefined;
      const controls = createAudioControls(mockAudioRef);
      const result = await controls.playAudio();

      expect(result).toBe(false);
    });

    it("should handle play errors gracefully", async () => {
      mockAudioRef.current.play.mockRejectedValue(new Error("Play failed"));
      const controls = createAudioControls(mockAudioRef);
      const result = await controls.playAudio();

      expect(result).toBe(false);
    });

    it("should handle play errors with specific error types", async () => {
      const error = new Error("NotAllowedError");
      error.name = "NotAllowedError";
      mockAudioRef.current.play.mockRejectedValue(error);
      const controls = createAudioControls(mockAudioRef);
      const result = await controls.playAudio();

      expect(result).toBe(false);
    });
  });

  describe("pauseAudio", () => {
    it("should pause audio", () => {
      const controls = createAudioControls(mockAudioRef);
      controls.pauseAudio();

      expect(mockAudioRef.current.pause).toHaveBeenCalled();
    });

    it("should handle null audio ref", () => {
      mockAudioRef.current = null;
      const controls = createAudioControls(mockAudioRef);

      expect(() => controls.pauseAudio()).not.toThrow();
      expect(mockAudioRef.current).toBeNull();
    });

    it("should handle undefined audio ref", () => {
      mockAudioRef.current = undefined;
      const controls = createAudioControls(mockAudioRef);

      expect(() => controls.pauseAudio()).not.toThrow();
    });

    it("should throw if pause fails", () => {
      mockAudioRef.current.pause.mockImplementation(() => {
        throw new Error("Pause error");
      });
      const controls = createAudioControls(mockAudioRef);

      expect(() => controls.pauseAudio()).toThrow("Pause error");
    });
  });

  describe("stopAudio", () => {
    it("should stop audio and reset time", () => {
      mockAudioRef.current.currentTime = 5;
      const controls = createAudioControls(mockAudioRef);
      controls.stopAudio();

      expect(mockAudioRef.current.pause).toHaveBeenCalled();
      expect(mockAudioRef.current.currentTime).toBe(0);
    });

    it("should handle null audio ref", () => {
      mockAudioRef.current = null;
      const controls = createAudioControls(mockAudioRef);

      expect(() => controls.stopAudio()).not.toThrow();
      expect(mockAudioRef.current).toBeNull();
    });

    it("should handle undefined audio ref", () => {
      mockAudioRef.current = undefined;
      const controls = createAudioControls(mockAudioRef);

      expect(() => controls.stopAudio()).not.toThrow();
    });

    it("should reset currentTime from any value", () => {
      mockAudioRef.current.currentTime = 123.45;
      const controls = createAudioControls(mockAudioRef);
      controls.stopAudio();

      expect(mockAudioRef.current.currentTime).toBe(0);
    });

    it("should throw if stop fails", () => {
      mockAudioRef.current.pause.mockImplementation(() => {
        throw new Error("Stop error");
      });
      const controls = createAudioControls(mockAudioRef);

      expect(() => controls.stopAudio()).toThrow("Stop error");
    });
  });

  describe("integration scenarios", () => {
    it("should handle play then stop sequence", async () => {
      const controls = createAudioControls(mockAudioRef);

      const playResult = await controls.playAudio();
      expect(playResult).toBe(true);

      controls.stopAudio();
      expect(mockAudioRef.current.currentTime).toBe(0);
    });

    it("should handle play then pause sequence", async () => {
      const controls = createAudioControls(mockAudioRef);

      await controls.playAudio();
      controls.pauseAudio();

      expect(mockAudioRef.current.play).toHaveBeenCalled();
      expect(mockAudioRef.current.pause).toHaveBeenCalled();
    });

    it("should handle multiple play calls", async () => {
      const controls = createAudioControls(mockAudioRef);

      const result1 = await controls.playAudio();
      const result2 = await controls.playAudio();

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(mockAudioRef.current.play).toHaveBeenCalledTimes(2);
    });
  });

  describe("getAudioSrc", () => {
    it("should return empty string for null/undefined input", () => {
      expect(getAudioSrc(null)).toBe("");
      expect(getAudioSrc(undefined)).toBe("");
    });

    it("should return the string directly for non-array input", () => {
      expect(getAudioSrc("https://example.com/audio.mp3")).toBe(
        "https://example.com/audio.mp3",
      );
    });

    it("should return first item from array of strings", () => {
      const urls = ["https://example.com/a.mp3", "https://example.com/b.mp3"];
      expect(getAudioSrc(urls, 0)).toBe("https://example.com/a.mp3");
      expect(getAudioSrc(urls, 1)).toBe("https://example.com/b.mp3");
    });

    it("should extract url property from array of objects", () => {
      const urls = [
        { url: "https://example.com/a.mp3" },
        { url: "https://example.com/b.mp3" },
      ];
      expect(getAudioSrc(urls, 0)).toBe("https://example.com/a.mp3");
      expect(getAudioSrc(urls, 1)).toBe("https://example.com/b.mp3");
    });

    it("should return empty string for out-of-bounds index", () => {
      const urls = ["https://example.com/a.mp3"];
      expect(getAudioSrc(urls, 5)).toBe("");
    });
  });

  describe("dead audio URL tracking (lazy validation)", () => {
    afterEach(() => {
      clearDeadAudioUrlsCache();
    });

    it("should not mark any URL as dead initially", () => {
      expect(isAudioUrlDead("https://example.com/audio.mp3")).toBe(false);
    });

    it("should mark URL as dead after playback failure", () => {
      const url = "https://example.com/failed.mp3";
      expect(isAudioUrlDead(url)).toBe(false);

      markAudioUrlDead(url);

      expect(isAudioUrlDead(url)).toBe(true);
    });

    it("should not mark empty URL as dead", () => {
      markAudioUrlDead("");
      markAudioUrlDead(null);
      markAudioUrlDead(undefined);
      // Should not throw and should not affect other URLs
      expect(isAudioUrlDead("https://example.com/audio.mp3")).toBe(false);
    });

    it("should persist dead URLs to localStorage", () => {
      const url = "https://example.com/dead.mp3";
      markAudioUrlDead(url);

      // Check localStorage was updated
      const cached = localStorage.getItem("dead-audio-urls");
      expect(cached).toBeTruthy();
      expect(JSON.parse(cached)).toContain(url);
    });

    it("should load dead URLs from localStorage on init", () => {
      const url = "https://example.com/cached-dead.mp3";
      localStorage.setItem("dead-audio-urls", JSON.stringify([url]));

      loadDeadAudioUrlsCache();

      expect(isAudioUrlDead(url)).toBe(true);
    });

    it("should clear dead URLs cache", () => {
      const url = "https://example.com/to-clear.mp3";
      markAudioUrlDead(url);
      expect(isAudioUrlDead(url)).toBe(true);

      clearDeadAudioUrlsCache();

      expect(isAudioUrlDead(url)).toBe(false);
      expect(localStorage.getItem("dead-audio-urls")).toBeNull();
    });
  });
});
