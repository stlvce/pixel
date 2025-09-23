import { useState, useEffect } from "react";

import { COOLDOWN } from "@src/constants";

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
    startTimer: (newCooldown = COOLDOWN) => {
      setCooldown(newCooldown);
    },
  };
};
