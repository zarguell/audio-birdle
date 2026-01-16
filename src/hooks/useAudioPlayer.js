import { useState, useRef, useMemo, useCallback } from "react";
import { createAudioControls } from "../utils/AudioUtils";

/**
 * Custom hook for audio playback controls
 * Manages playing state, error handling, and audio selection
 */
export function useAudioPlayer(initialAudioIndex = 0) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [selectedAudioIndex, setSelectedAudioIndex] =
    useState(initialAudioIndex);
  const audioRef = useRef(null);

  const audioControls = useMemo(() => createAudioControls(audioRef), []);

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
