/**
 * TaxonomicBadge - Display component for taxonomic correctness
 * Shows green checkmark for correct matches, red X for incorrect
 */

import React from 'react';

export default function TaxonomicBadge({ label, correct, show }) {
  if (!show) return null;

  const bgColor = correct ? 'bg-green-100' : 'bg-red-100';
  const textColor = correct ? 'text-green-700' : 'text-red-700';
  const icon = correct ? '✓' : '✗';

  return (
    <div className={`px-3 py-1 rounded-full text-sm font-medium ${bgColor} ${textColor}`}>
      {icon} {label}
    </div>
  );
}
