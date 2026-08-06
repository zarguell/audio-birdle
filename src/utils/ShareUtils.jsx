// Updated ShareUtils.js to work with new game state structure

import { toast } from "sonner";

/**
 * Generate share text for a completed daily game
 * @param {Object} dailyGameState - The completed daily game state
 * @param {string} gameUrl - URL of the game
 * @returns {string} - Formatted share text
 */
export const generateShareText = (dailyGameState, gameUrl) => {
  if (!dailyGameState || !dailyGameState.completed) {
    return "";
  }

  const { date, region, guesses, won, maxGuesses } = dailyGameState;
  const guessCount = guesses.length;

  // Create guess result grid
  const resultGrid = guesses
    .map((guess) => (guess.correct ? "🟩" : "🟥"))
    .join("");

  const shareText = [
    `🐦 Audio-Birdle ${date}`,
    `Region: ${region.toUpperCase()}`,
    `${won ? `${guessCount}/${maxGuesses}` : "X/" + maxGuesses}`,
    "",
    resultGrid,
    "",
    gameUrl,
  ].join("\n");

  return shareText;
};

/**
 * Generate share text for a completed hard mode game
 * @param {Object} hardModeGameState - The completed hard mode game state
 * @param {string} gameUrl - URL of the game
 * @returns {string} - Formatted share text
 */
export const generateHardModeShareText = (hardModeGameState, gameUrl) => {
  if (!hardModeGameState || !hardModeGameState.completed) {
    return "";
  }

  const { date, region, guesses, won, maxGuesses } = hardModeGameState;
  const guessCount = guesses.length;

  // Create guess result grid with taxonomic scoring
  const resultGrid = guesses
    .map((guess) => {
      if (guess.correct) return "🟩";
      // Show partial credit based on taxonomic score
      const score = Object.values(guess.taxonomicScore || {}).filter(
        Boolean,
      ).length;
      if (score >= 3) return "🟨"; // Got genus or closer (3+ matches)
      if (score >= 2) return "🟧"; // Got family (2 matches)
      return "🟥"; // No taxonomic match (0-1 matches)
    })
    .join("");

  const emoji = won ? "🔥" : "😔";

  const shareText = [
    `${emoji} Audio-Birdle Hard Mode ${date}`,
    `Region: ${region.toUpperCase()}`,
    `${won ? `${guessCount}/${maxGuesses}` : `X/${maxGuesses}`}`,
    "",
    resultGrid,
    "",
    gameUrl,
  ].join("\n");

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
    if (
      navigator.share &&
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      )
    ) {
      await navigator.share({
        title: "Audio-Birdle Result",
        text: shareText,
      });
      return true;
    }

    // Fallback to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareText);

      // Surface feedback via the toast system instead of mutating
      // document.activeElement (which could clobber the wrong element).
      toast.success("Result copied to clipboard!");
      return true;
    }

    // Final fallback - create temporary textarea
    const textarea = document.createElement("textarea");
    textarea.value = shareText;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);

    // Show feedback
    toast.success("Result copied to clipboard!");
    return true;
  } catch (error) {
    console.error("Error sharing result:", error);

    // Show the text in a dialog as final fallback
    prompt("Share your result:", shareText);
    return false;
  }
};
