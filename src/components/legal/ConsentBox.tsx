'use client';

interface ConsentBoxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Slug del tenant: los documentos legales viven bajo /{tenantSlug}/privacidad. */
  tenantSlug: string;
  /** 'health' = datos sensibles (booking/eventos); 'contact' = lead (más suave). */
  variant?: 'health' | 'contact';
  className?: string;
}

/**
 * Casilla de consentimiento reutilizable. NO maneja la versión del aviso: eso lo
 * ancla el servidor (ver Opus O-B3). El componente solo reporta 'accepted'.
 * Consumido por booking (CheckoutContact) y por el registro a eventos.
 */
export function ConsentBox({ checked, onChange, tenantSlug, variant = 'health', className }: ConsentBoxProps) {
  const isHealth = variant === 'health';
  return (
    <label className={`flex items-start gap-2.5 cursor-pointer ${className ?? ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded-[4px] border-[0.5px] border-sand-300
                   text-pine-600 focus:ring-[3px] focus:ring-pine-200 focus:outline-none"
      />
      <span className="text-sm text-pine-700 leading-relaxed">
        {isHealth ? (
          <>
            He leído y acepto el{' '}
            <a href={`/${tenantSlug}/privacidad`} target="_blank" rel="noopener noreferrer" className="btn-ghost underline">
              aviso de privacidad
            </a>{' '}
            y los{' '}
            <a href={`/${tenantSlug}/terminos`} target="_blank" rel="noopener noreferrer" className="btn-ghost underline">
              términos y condiciones
            </a>, y otorgo mi consentimiento expreso para el tratamiento de mis datos personales,
            incluidos datos sensibles de salud, para recibir la atención agendada.
          </>
        ) : (
          <>
            Acepto ser contactada/o y el tratamiento de mis datos de contacto conforme al{' '}
            <a href={`/${tenantSlug}/privacidad`} target="_blank" rel="noopener noreferrer" className="btn-ghost underline">
              aviso de privacidad
            </a>.
          </>
        )}
      </span>
    </label>
  );
}
