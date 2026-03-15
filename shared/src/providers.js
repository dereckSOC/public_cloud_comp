"use client";

import { useEffect } from "react";
import "./lib/i18n";
import { setupAutoCleanup } from "./lib/localStorageCleanup";
import GlobalClickSound from "./components/GlobalClickSound";

export default function Providers({ children }) {
  useEffect(() => {
    // Set up automatic localStorage cleanup
    // Runs immediately and then every hour
    const stopCleanup = setupAutoCleanup(60 * 60 * 1000); // 1 hour interval

    // Cleanup on unmount (though this rarely happens for Providers)
    return () => {
      if (stopCleanup) stopCleanup();
    };
  }, []);

  return (
    <>
      <GlobalClickSound />
      {children}
    </>
  );
}
