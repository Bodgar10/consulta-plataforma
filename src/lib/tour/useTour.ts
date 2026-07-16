"use client";

import { useCallback } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

/**
 * Hook mínimo para disparar un tour guiado con la identidad visual del
 * proyecto (pino/crema/terracota, Fraunces en títulos). driver.js no
 * expone theming vía props — se sobreescribe con clases CSS globales
 * definidas en globals.css (ver Prompt J2).
 */
export function useTour(steps: DriveStep[]) {
  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      allowClose: true,
      overlayColor: "#1F332E",
      nextBtnText: "Siguiente →",
      prevBtnText: "← Atrás",
      doneBtnText: "Listo",
      progressText: "{{current}} de {{total}}",
      popoverClass: "app-tour-popover",
      steps,
    });
    driverObj.drive();
  }, [steps]);

  return { startTour };
}
