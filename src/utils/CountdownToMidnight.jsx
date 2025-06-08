import React, { useEffect, useState } from 'react';

export default function CountdownToMidnight() {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      
      // Get current time in EST
      const nowEST = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      
      // Calculate midnight EST for today
      const midnightEST = new Date(nowEST);
      midnightEST.setHours(24, 0, 0, 0);
      
      // If we're past midnight EST, we need tomorrow's midnight
      const diff = midnightEST - nowEST;
      
      if (diff <= 0) {
        // Already past midnight, calculate for next day
        midnightEST.setDate(midnightEST.getDate() + 1);
        midnightEST.setHours(0, 0, 0, 0);
      }
      
      const finalDiff = midnightEST - nowEST;
      
      const hours = Math.floor(finalDiff / (1000 * 60 * 60));
      const minutes = Math.floor((finalDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((finalDiff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, []);

  return <span>{timeLeft}</span>;
}