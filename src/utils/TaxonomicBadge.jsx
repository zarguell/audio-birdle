/**
 * TaxonomicBadge - Display component for taxonomic correctness
 * Shows green checkmark for correct matches, red X for incorrect
 * Displays the taxonomic value when provided (e.g., "Order: Passeriformes ✓")
 */

import React from 'react';

export default function TaxonomicBadge({ label, correct, show, value }) {
  if (!show) return null;

  const bgColor = correct ? 'bg-green-100' : 'bg-red-100';
  const textColor = correct ? 'text-green-700' : 'text-red-700';
  const icon = correct ? '✓' : '✗';

  // If value is provided, display "Label: Value Icon", otherwise just "Label Icon"
  const displayText = value ? `${label}: ${value} ${icon}` : `${label} ${icon}`;

  return (
    <div className={`px-3 py-1 rounded-full text-sm font-medium ${bgColor} ${textColor}`}>
      {displayText}
    </div>
  );
}
