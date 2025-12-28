import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAudioControls } from "@/utils/AudioUtils";

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
});
