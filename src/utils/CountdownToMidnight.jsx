import React, { useEffect, useState } from 'react';

/**
 * Countdown to the next daily challenge: the puzzle for a local day is fixed
 * and available at that user's LOCAL midnight (daily.json entries are
 * generated a day ahead, so entry N exists before any timezone's midnight N).
 * Pure local Date arithmetic — no locale-string parsing.
 */
export default function CountdownToMidnight() {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      // Next local midnight (local-time constructor, not UTC parsing).
      const target = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        0,
      );

      const diff = target - now;

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, []);

  return <span>{timeLeft}</span>;
}
