// Sharing and results utilities

export const generateShareText = (gameState, currentUrl) => {
  const emojiGrid = gameState.guesses.map(guess => 
    guess.correct ? '🟩' : '🟥'
  ).join('');
  
  const padding = '⬛'.repeat(gameState.maxGuesses - gameState.guesses.length);
  const result = gameState.won ? `${gameState.guesses.length}/${gameState.maxGuesses}` : 'X/4';

  return `🐦 Audio-Birdle ${gameState.date}\n${result}\n\n${emojiGrid}${padding}\n\n${currentUrl}`;
};

export const shareResult = async (shareText) => {
  if (navigator.share) {
    try {
      await navigator.share({ text: shareText });
      return true;
    } catch (error) {
      // Fallback to clipboard
      return copyToClipboard(shareText);
    }
  } else {
    return copyToClipboard(shareText);
  }
};

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard?.writeText(text);
    return true;
  } catch (error) {
    console.warn('Failed to copy to clipboard:', error);
    return false;
  }
};