// Audio player utilities

/**
 * Gets the audio source URL from various audioUrl data formats.
 * Handles backward compatibility for string, array of strings, and array of objects.
 *
 * @param {string|string[]|Object[]} audioUrlData - The audio URL data in various formats
 * @param {number} index - The index to use when audioUrlData is an array (default: 0)
 * @returns {string} The audio source URL
 */
export const getAudioSrc = (audioUrlData, index = 0) => {
  if (!audioUrlData) return '';
  // Backward compatibility for non-array format (single string)
  if (!Array.isArray(audioUrlData)) return audioUrlData;

  const audioItem = audioUrlData[index];
  if (!audioItem) return '';

  // New format: array of objects with url property
  if (typeof audioItem === 'object' && audioItem.url) {
    return audioItem.url;
  }

  // Backward compatibility for array of strings
  return audioItem;
};

export const createAudioControls = (audioRef) => {
  const playAudio = async () => {
    if (!audioRef.current) return false;
    
    try {
      await audioRef.current.play();
      return true;
    } catch (error) {
      console.error('Audio play failed:', error);
      return false;
    }
  };

  const pauseAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
  };

  const stopAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };

  return {
    playAudio,
    pauseAudio,
    stopAudio
  };
};