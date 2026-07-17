"use client";

interface TourFabProps {
  onClick: () => void;
}

/**
 * Botón flotante fijo, mismo lugar en todas las pantallas del panel, para
 * disparar el tour guiado de esa pantalla. btn-secondary (no terracota) a
 * propósito: la terracota queda reservada para la acción principal de cada
 * pantalla (Nueva cita, Publicar evento, etc.), no para ayuda.
 */
export function TourFab({ onClick }: TourFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="¿Cómo funciona esta pantalla?"
      className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-cream-0 border-[0.5px] border-sand-300 shadow-[0_4px_16px_-4px_rgba(31,51,46,0.25)] flex items-center justify-center hover:border-pine-400 transition-colors"
    >
      <span className="font-display text-xl text-pine-700">?</span>
    </button>
  );
}
