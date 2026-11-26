import { isHttpsUrl } from "../core/data.js";
import { getAudioAttribution, mapActivityMediaUrl } from "../core/audio.js";
import { qs, setAttr, setText, show } from "../core/dom.js";
import { stickerUrl } from "../core/sticker.js";

export function createCompletionView(rootElement) {
  const elements = {
    win: qs("[data-result-win]", rootElement),
    lose: qs("[data-result-lose]", rootElement),
    title: qs("[data-result-title]", rootElement),
    text: qs("[data-result-text]", rootElement),
    label: qs("[data-bird-label]", rootElement),
    name: qs("[data-bird-name]", rootElement),
    scientific: qs("[data-bird-scientific]", rootElement),
    facts: qs("[data-bird-facts]", rootElement),
    fact: qs("[data-bird-fact]", rootElement),
    media: qs("[data-image-carousel]", rootElement),
    image: qs("[data-bird-image]", rootElement),
    counter: qs("[data-image-counter]", rootElement),
    prev: qs("[data-image-prev]", rootElement),
    next: qs("[data-image-next]", rootElement),
    share: qs("[data-share]", rootElement),
    learnMore: qs("[data-learn-more]", rootElement),
    attribution: qs("[data-attribution]", rootElement),
    stickerWrap: qs("[data-sticker-wrap]", rootElement),
    sticker: qs("[data-sticker]", rootElement),
    stickerNote: qs("[data-sticker-note]", rootElement),
    practiceActions: qs("[data-practice-actions]", rootElement),
    retry: qs("[data-practice-retry]", rootElement),
    nextRound: qs("[data-practice-next]", rootElement),
  };

  let bird = null;
  let images = [];
  let imageIndex = 0;
  let audioIndex = 0;
  let shareHandler = null;
  let stickerRequest = 0;

  const updateImage = () => {
    const image = images[imageIndex];
    if (!image) {
      show(elements.media, false);
      return;
    }
    elements.image.src = image.url;
    elements.image.alt = bird?.name || "Bird photo";
    setText(elements.counter, `${imageIndex + 1} / ${images.length}`);
    show(elements.media, true);
    show(elements.prev, images.length > 1);
    show(elements.next, images.length > 1);
    show(elements.counter, images.length > 1);
  };

  const updateAttribution = () => {
    if (!bird) {
      show(elements.attribution, false);
      return;
    }
    const parts = [];
    const audioAttribution = getAudioAttribution(bird.audioUrl, audioIndex);
    if (audioAttribution.recordist) {
      let audioText = `Audio: ${audioAttribution.recordist}`;
      if (audioAttribution.location) {
        audioText += ` (${audioAttribution.location})`;
      }
      parts.push(audioText);
    } else if (audioAttribution.source) {
      parts.push(`Audio: ${audioAttribution.source}`);
    }

    const image = images[imageIndex];
    if (image?.attribution?.photographer) {
      let imageText = `Photo: ${image.attribution.photographer}`;
      if (image.attribution.license) {
        imageText += ` (${image.attribution.license})`;
      }
      parts.push(imageText);
    }

    setText(elements.attribution, parts.join(" • "));
    show(elements.attribution, parts.length > 0);
  };

  elements.prev.addEventListener("click", () => {
    if (images.length === 0) {
      return;
    }
    imageIndex = imageIndex === 0 ? images.length - 1 : imageIndex - 1;
    updateImage();
    updateAttribution();
  });

  elements.next.addEventListener("click", () => {
    if (images.length === 0) {
      return;
    }
    imageIndex = imageIndex === images.length - 1 ? 0 : imageIndex + 1;
    updateImage();
    updateAttribution();
  });

  /**
   * Show the species sticker, if the set has one, and hide the photo carousel
   * behind it. The CDN answers 404 for extinct and very rare species, so a
   * failure falls back to the photo rather than leaving a broken tile.
   *
   * The request counter guards against a slow load from a previous round
   * landing on the current card: practice mode can finish two birds quickly.
   */
  const updateSticker = (nextBird) => {
    const request = (stickerRequest += 1);
    // Inside Discord the CDN is unreachable; the mapper rewrites it to the
    // app's `/stickers` URL mapping, which must exist on the app.
    const url = mapActivityMediaUrl(stickerUrl(nextBird));
    show(elements.stickerWrap, false);
    show(elements.stickerNote, false);
    elements.sticker.removeAttribute("src");
    if (!url) {
      return;
    }

    elements.sticker.onload = () => {
      if (request !== stickerRequest) {
        return;
      }
      elements.sticker.alt = `${nextBird.name} sticker`;
      show(elements.stickerWrap, true);
      show(elements.stickerNote, true);
      elements.stickerWrap.dataset.dance = "";
      // Restart the dance even when the class was already there from a
      // previous round, or the second win in a row would stand still.
      void elements.stickerWrap.offsetWidth;
      elements.stickerWrap.dataset.dance = "on";
      // The photo carousel is the fallback; the sticker is the nicer reveal.
      show(elements.media, false);
    };
    elements.sticker.onerror = () => {
      if (request !== stickerRequest) {
        return;
      }
      show(elements.stickerWrap, false);
      show(elements.stickerNote, false);
      // Nothing to fall back to on a shared list; the card renders without art.
    };
    elements.sticker.src = url;
  };

  return {
    render({
      bird: nextBird,
      game,
      mode = "normal",
      isPractice = false,
      audioIndex: nextAudioIndex = 0,
      onShare = null,
      onRetry = null,
      onNext = null,
    }) {
      bird = nextBird;
      audioIndex = nextAudioIndex;
      images = Array.isArray(bird?.images)
        ? bird.images.filter((image) => isHttpsUrl(image?.url))
        : [];
      imageIndex = 0;

      const won = Boolean(game?.won);
      show(elements.win, won);
      show(elements.lose, !won);
      setText(
        elements.title,
        won ? "Well done!" : isPractice ? "Not quite" : "Better luck tomorrow!",
      );
      setText(
        elements.text,
        won
          ? `Logged in ${game.guesses.length} ${game.guesses.length === 1 ? "guess" : "guesses"}.`
          : isPractice
            ? "No match this time. Try the next trail."
            : "This entry stays open until tomorrow.",
      );

      setText(
        elements.label,
        isPractice ? "Practice specimen" : "Species record",
      );
      setText(elements.name, bird?.name || "");
      setText(elements.scientific, bird?.scientificName || "");

      const facts = Array.isArray(bird?.facts)
        ? bird.facts.join(" ")
        : bird?.facts;
      setText(elements.fact, facts || "");
      show(elements.facts, Boolean(facts));

      const learnMore = isHttpsUrl(bird?.learnMoreUrl) ? bird.learnMoreUrl : "";
      if (learnMore) {
        setAttr(elements.learnMore, "href", learnMore);
      } else {
        elements.learnMore.removeAttribute("href");
      }
      show(elements.learnMore, Boolean(learnMore));

      shareHandler = onShare;
      elements.share.onclick = onShare
        ? () => {
            shareHandler?.(game, mode);
          }
        : null;
      show(elements.share, Boolean(onShare) && !isPractice);

      show(elements.practiceActions, isPractice);
      if (isPractice) {
        elements.retry.onclick = onRetry;
        elements.nextRound.onclick = onNext;
      }

      updateImage();
      updateAttribution();
      updateSticker(bird);
      show(rootElement, true);
    },

    setAudioIndex(index) {
      audioIndex = index;
      updateAttribution();
    },

    hide() {
      show(rootElement, false);
    },
  };
}
