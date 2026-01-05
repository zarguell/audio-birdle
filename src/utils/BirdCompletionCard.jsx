/**
 * BirdCompletionCard - Displays bird information after game completion
 *
 * Shows:
 * - Bird image (with navigation for multiple images)
 * - Bird name and scientific name
 * - Educational facts (if available)
 * - Attribution footer for audio and images
 */

import { useState } from 'react';
import { Share2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

export default function BirdCompletionCard({
  bird,
  selectedAudioIndex = 0,
  onShare,
  variant = 'normal' // 'normal', 'hard', 'practice'
}) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Normalize audioUrl - handle both old format (array of strings) and new format (array of objects)
  const audioUrl = bird.audioUrl?.[selectedAudioIndex];
  const audioAttribution = typeof audioUrl === 'object' && audioUrl?.attribution
    ? audioUrl.attribution
    : {};

  // Get images
  const images = bird.images || [];
  const currentImage = images[selectedImageIndex];
  const hasImage = images.length > 0 && currentImage?.url;

  // Get facts
  const hasFacts = bird.facts && bird.facts.length > 0;

  // Get learn more URL
  const hasLearnMore = bird.learnMoreUrl && bird.learnMoreUrl.length > 0;

  // Build attribution text
  const getAttributionText = () => {
    const parts = [];

    // Audio attribution
    if (audioAttribution.recordist) {
      let audioText = `Audio: ${audioAttribution.recordist}`;
      if (audioAttribution.location) audioText += ` (${audioAttribution.location})`;
      parts.push(audioText);
    }

    // Image attribution
    if (currentImage?.attribution?.photographer) {
      let imageText = `Photo: ${currentImage.attribution.photographer}`;
      if (currentImage.attribution.license) imageText += ` (${currentImage.attribution.license})`;
      parts.push(imageText);
    }

    return parts.length > 0 ? parts.join(' • ') : null;
  };

  const attributionText = getAttributionText();

  // Variant colors
  const variantColors = {
    normal: { imageBg: 'bg-green-50', border: 'border-green-200' },
    hard: { imageBg: 'bg-red-50', border: 'border-red-200' },
    practice: { imageBg: 'bg-purple-50', border: 'border-purple-200' }
  };
  const colors = variantColors[variant] || variantColors.normal;

  const handlePrevImage = () => {
    setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="space-y-4">
      {/* Bird Image Section */}
      {hasImage && (
        <div className={`rounded-lg ${colors.imageBg} border ${colors.border} overflow-hidden`}>
          <div className="relative">
            <img
              src={currentImage.url}
              alt={bird.name}
              className="w-full h-48 object-cover"
            />

            {/* Image navigation for multiple images */}
            {images.length > 1 && (
              <>
                <button
                  onClick={handlePrevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-1 rounded-full shadow"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-1 rounded-full shadow"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  {selectedImageIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bird Name Section */}
      <div className={`rounded-lg ${colors.imageBg} ${colors.border} border p-4`}>
        <h3 className="font-semibold mb-2">Today's Bird:</h3>
        <div className="text-lg font-medium">{bird.name}</div>
        <div className="text-sm text-gray-500 italic">{bird.scientificName}</div>
      </div>

      {/* Educational Facts Section */}
      {hasFacts && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            📚 Fun Fact
          </h3>
          <p className="text-sm text-gray-700">{bird.facts}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {onShare && (
          <button
            onClick={onShare}
            className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Share Result
          </button>
        )}

        {hasLearnMore && (
          <a
            href={bird.learnMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Learn More
          </a>
        )}
      </div>

      {/* Attribution Footer */}
      {attributionText && (
        <div className="text-xs text-gray-500 text-center border-t pt-3">
          {attributionText}
        </div>
      )}
    </div>
  );
}
