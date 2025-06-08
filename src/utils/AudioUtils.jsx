// Audio player utilities

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