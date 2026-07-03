import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/** Cliente Stripe singleton. Server-side ONLY (usa la secret key). */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Falta STRIPE_SECRET_KEY');
  // El SDK instalado estrecha el tipo de apiVersion a su literal más reciente,
  // pero en runtime Stripe acepta versiones anteriores. Fijamos '2024-06-20'
  // (recomendación de Stripe: pinear la versión) con un cast localizado, ya que
  // el paquete usa `export = Stripe` y no expone un tipo público de config.
  _stripe = new Stripe(key, { apiVersion: '2024-06-20' as never });
  return _stripe;
}
