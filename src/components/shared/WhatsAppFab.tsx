"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const PANEL_PREFIXES = ["/agenda", "/pacientes", "/cobros", "/paquetes", "/eventos"];
const WHATSAPP_NUMBER = "525579022090"; // sin + ni espacios, formato que espera wa.me

/**
 * Botón flotante de WhatsApp, visible en todo el sitio EXCEPTO el panel de
 * la profesional (esas rutas viven bajo (protected), sin prefijo de tenant,
 * ver PANEL_PREFIXES). Esquina inferior IZQUIERDA a propósito: la derecha
 * ya la ocupa TourFab en las pantallas del panel — en el resto del sitio
 * no hay tour, así que no hay colisión real, pero mantener el mismo lado
 * global es más simple que decidir por ruta.
 */
export function WhatsAppFab() {
  const pathname = usePathname();
  const [showBubble, setShowBubble] = useState(false);

  const isPanelRoute = PANEL_PREFIXES.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (isPanelRoute) return;

    // Aparece unos segundos después de cargar, se oculta, y reaparece cada
    // cierto tiempo — nunca permanece fijo en pantalla (sería intrusivo).
    let hideTimeout: ReturnType<typeof setTimeout>;

    const showThenHide = () => {
      setShowBubble(true);
      hideTimeout = setTimeout(() => setShowBubble(false), 6000);
    };

    const firstShow = setTimeout(showThenHide, 2500);
    const intervalId = setInterval(showThenHide, 45000);

    return () => {
      clearTimeout(firstShow);
      clearTimeout(hideTimeout);
      clearInterval(intervalId);
    };
  }, [isPanelRoute]);

  if (isPanelRoute) return null;

  return (
    <div className="fixed bottom-6 left-6 z-40 flex items-end gap-2">
      <div className="flex flex-col items-start gap-2">
        {showBubble && (
          <div className="bg-cream-0 border-hair rounded-[10px] px-4 py-2.5 shadow-[0_4px_16px_-4px_rgba(31,51,46,0.25)] max-w-[220px] animate-[fadeIn_0.3s_ease-out]">
            <p className="text-sm text-pine-700">
              Charla personalmente conmigo si tienes alguna duda
            </p>
          </div>
        )}
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Escríbenos por WhatsApp"
          className="w-14 h-14 rounded-full bg-[#25D366] shadow-[0_4px_16px_-4px_rgba(31,51,46,0.35)] flex items-center justify-center hover:brightness-95 transition-[filter]"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.005c5.46 0 9.91-4.45 9.91-9.91C21.98 6.45 17.53 2 12.04 2Zm0 18.15h-.005a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.42 5.83c0 4.55-3.7 8.23-8.25 8.23Zm4.52-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.4-.12-.56.13-.17.25-.65.81-.79.97-.15.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.48-1.39-1.73-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.16 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.19.21-.58.21-1.08.14-1.19-.06-.11-.23-.17-.48-.29Z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
