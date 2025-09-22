import { useState, useEffect } from "react";

export const useTimer = () => {
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((c) => (c > 0 ? c - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  return {
    cooldown,
    startTimer: (newCooldown = 60) => {
      setCooldown(newCooldown);
    },
  };
};
