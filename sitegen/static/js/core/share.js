export function generateShareText(game, gameUrl) {
  if (!game?.completed) {
    return "";
  }
  const resultGrid = game.guesses
    .map((guess) => (guess.correct ? "🟩" : "🟥"))
    .join("");

  return [
    `🐦 Audio-Birdle ${game.date}`,
    `Region: ${game.region.toUpperCase()}`,
    `${game.won ? `${game.guesses.length}/${game.maxGuesses}` : `X/${game.maxGuesses}`}`,
    "",
    resultGrid,
    "",
    gameUrl,
  ].join("\n");
}

export function generateHardModeShareText(game, gameUrl) {
  if (!game?.completed) {
    return "";
  }
  const resultGrid = game.guesses
    .map((guess) => {
      if (guess.correct) {
        return "🟩";
      }
      const score = Object.values(guess.taxonomicScore || {}).filter(Boolean).length;
      if (score >= 3) {
        return "🟨";
      }
      if (score >= 2) {
        return "🟧";
      }
      return "🟥";
    })
    .join("");

  return [
    `${game.won ? "🔥" : "😔"} Audio-Birdle Hard Mode ${game.date}`,
    `Region: ${game.region.toUpperCase()}`,
    `${game.won ? `${game.guesses.length}/${game.maxGuesses}` : `X/${game.maxGuesses}`}`,
    "",
    resultGrid,
    "",
    gameUrl,
  ].join("\n");
}

const copyWithFallback = (text) => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.className = "clipboard-helper";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
};

export async function shareResult(text, notify = null) {
  try {
    if (navigator.share) {
      await navigator.share({ title: "Audio-Birdle result", text });
      return true;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      notify?.("Result copied to clipboard", { type: "success" });
      return true;
    }
    if (copyWithFallback(text)) {
      notify?.("Result copied to clipboard", { type: "success" });
      return true;
    }
    notify?.("Could not copy the result. Try selecting the text manually.", {
      type: "error",
    });
    return false;
  } catch (error) {
    if (error?.name === "AbortError") {
      return false;
    }
    console.error("Could not share result:", error);
    notify?.("Could not share the result. Try copying it manually.", {
      type: "error",
    });
    return false;
  }
}
