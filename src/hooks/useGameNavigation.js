import { useState } from "react";
import { VIEWS } from "../utils/Constants";

export function useGameNavigation(initialView = VIEWS.MODE_SELECTOR) {
  const [currentView, setCurrentView] = useState(initialView);

  return {
    currentView,
    setCurrentView,
    VIEWS,
  };
}

export default useGameNavigation;
