import { getStripe } from '@/lib/payments/stripe';
import { PAYMENTS_CONFIG, applicationFeeAmount } from '@/lib/payments/config';

export type CheckoutMethod = 'card' | 'oxxo';

export type CheckoutArgs = {
  stripeAccountId: string;              // destination del charge (payment_settings.stripe_account_id)
  amountCents: number;
  productName: string;                  // etiqueta de la línea
  customerEmail: string;
  method: CheckoutMethod;               // mutuamente excluyente (booking: según payment_mode; eventos: 'card')
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;     // booking: {appointment_id, tenant_id}; eventos: {live_event_id, registration_id, tenant_id}
};

/**
 * Fuente única del Checkout Session Connect (destination charge + application_fee + OXXO).
 * Movido verbatim del inline de booking/create; solo se parametriza lo que varía.
 * NO lee la BD: quien llama pasa stripeAccountId y amountCents (desde payment_settings).
 */
export async function createCheckoutSession(args: CheckoutArgs): Promise<{ id: string; url: string | null }> {
  const stripe = getStripe();
  const methodTypes = args.method === 'oxxo'
    ? [...PAYMENTS_CONFIG.methods.oxxo]
    : [...PAYMENTS_CONFIG.methods.card];

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: methodTypes as Array<'card' | 'oxxo'>,
    customer_email: args.customerEmail,
    line_items: [
      {
        price_data: {
          currency: PAYMENTS_CONFIG.currency,
          product_data: { name: args.productName },
          unit_amount: args.amountCents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: applicationFeeAmount(args.amountCents),
      transfer_data: { destination: args.stripeAccountId },
      metadata: args.metadata,
    },
    metadata: args.metadata,
    ...(args.method === 'oxxo'
      ? { payment_method_options: { oxxo: { expires_after_days: PAYMENTS_CONFIG.oxxoExpiresAfterDays } } }
      : {}),
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
  });

  return { id: session.id, url: session.url };
}
