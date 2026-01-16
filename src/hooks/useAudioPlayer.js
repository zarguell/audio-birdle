/* eslint-disable react-hooks/preserve-manual-memoization, react-hooks/refs */
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

  const handleAudioError = useCallback(() => {
    setAudioError(true);
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
    resetAudio,
  };
}

export default useAudioPlayer;
