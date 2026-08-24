/* eslint-disable react-hooks/refs */
import { useState, useRef, useMemo, useCallback } from "react";
import { createAudioControls } from "../utils/AudioUtils";

/**
 * Custom hook for audio playback controls
 * Manages playing state, error handling, and audio selection
 *
 * NOTE: Refs are only accessed in event handlers (playAudio, pauseAudio, stopAudio),
 * not during render. The ESLint warnings are disabled because the ref access pattern
 * is safe - createAudioControls returns functions that access the ref, but those
 * functions are only called in user event handlers (onClick, etc.), not during render.
 */
export function useAudioPlayer(initialAudioIndex = 0) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [selectedAudioIndex, setSelectedAudioIndex] =
    useState(initialAudioIndex);
  const audioRef = useRef(null);

  // Ref is only accessed in event handlers, not during render
  const audioControls = useMemo(
    () => createAudioControls(audioRef),
    [audioRef],
  );

  const toggleAudio = useCallback(async () => {
    if (isPlaying) {
      audioControls.pauseAudio();
      setIsPlaying(false);
    } else {
      const success = await audioControls.playAudio();
      if (success) {
        setIsPlaying(true);
        setAudioError(false);
      } else {
        setAudioError(true);
        setIsPlaying(false);
      }
    }
  }, [isPlaying, audioControls]);

  const handleAudioError = useCallback(
    (maxIndex) => {
      // Auto-advance to the next recording on load failure — a single dead
      // or slow CDN URL must not disable playback for the whole challenge
      // (e.g. transient failures on a cold PWA launch). Exhausted list ->
      // surface the error as before.
      if (typeof maxIndex === "number" && selectedAudioIndex < maxIndex) {
        setSelectedAudioIndex((i) => i + 1);
        return;
      }
      setAudioError(true);
      setIsPlaying(false);
    },
    [selectedAudioIndex],
  );

  // Natural playback end must NOT be treated as an error: just clear the
  // playing state so the Play button re-enables without an error message.
  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const resetAudio = useCallback(() => {
    setSelectedAudioIndex(0);
    setAudioError(false);
    setIsPlaying(false);
  }, []);

  return {
    isPlaying,
    audioError,
    setAudioError,
    selectedAudioIndex,
    setSelectedAudioIndex,
    audioRef,
    toggleAudio,
    handleAudioError,
    handleAudioEnded,
    resetAudio,
  };
}

export default useAudioPlayer;
