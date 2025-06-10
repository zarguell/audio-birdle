// Updated ShareUtils.js to work with new game state structure

/**
 * Generate share text for a completed daily game
 * @param {Object} dailyGameState - The completed daily game state
 * @param {string} gameUrl - URL of the game
 * @returns {string} - Formatted share text
 */
export const generateShareText = (dailyGameState, gameUrl) => {
  if (!dailyGameState || !dailyGameState.completed) {
    return '';
  }

  const { date, region, guesses, won, maxGuesses } = dailyGameState;
  const guessCount = guesses.length;
  
  // Create guess result grid
  const resultGrid = guesses.map(guess => guess.correct ? '🟩' : '🟥').join('');
  
  const shareText = [
    `🐦 Audio-Birdle ${date}`,
    `Region: ${region.toUpperCase()}`,
    `${won ? `${guessCount}/${maxGuesses}` : 'X/'+maxGuesses}`,
    '',
    resultGrid,
    '',
    gameUrl
  ].join('\n');

  return shareText;
};

/**
 * Share the game result using Web Share API or clipboard
 * @param {string} shareText - Text to share
 * @returns {Promise<boolean>} - Success status
 */
export const shareResult = async (shareText) => {
  try {
    // Try Web Share API first (mobile browsers)
    if (navigator.share && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      await navigator.share({
        title: 'Audio-Birdle Result',
        text: shareText
      });
      return true;
    }
    
    // Fallback to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareText);
      
      // Show feedback to user
      const originalButton = document.activeElement;
      if (originalButton) {
        const originalText = originalButton.textContent;
        originalButton.textContent = 'Copied!';
        setTimeout(() => {
          originalButton.textContent = originalText;
        }, 2000);
      }
      
      return true;
    }
    
    // Final fallback - create temporary textarea
    const textarea = document.createElement('textarea');
    textarea.value = shareText;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    
    // Show feedback
    alert('Result copied to clipboard!');
    return true;
    
  } catch (error) {
    console.error('Error sharing result:', error);
    
    // Show the text in a dialog as final fallback
    const message = `Copy your result:\n\n${shareText}`;
    prompt('Share your result:', shareText);
    return false;
  }
};