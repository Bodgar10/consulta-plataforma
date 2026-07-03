/**
 * Configuración de pagos. Piloto: comisión de plataforma en 0
 * (no se le cobra % a la profesional todavía).
 */
export const PAYMENTS_CONFIG = {
  currency: 'mxn',
  /** % de application_fee sobre el cobro Connect. 0 en el piloto. */
  applicationFeePercent: 0,
  /** Métodos habilitados en Checkout para el path Stripe. */
  methods: {
    card: ['card'] as const,
    oxxo: ['oxxo'] as const,
  },
  /** OXXO: días hasta el vencimiento del voucher. */
  oxxoExpiresAfterDays: 3,
} as const;

/** Calcula el application_fee_amount (en centavos) a partir del total. */
export function applicationFeeAmount(totalCents: number): number {
  return Math.round((totalCents * PAYMENTS_CONFIG.applicationFeePercent) / 100);
}
