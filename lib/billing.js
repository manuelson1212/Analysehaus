// Stripe Checkout (hosted payment page), billing portal and webhook handling.
// Card data never touches this server. Subscription state is stored on the user from verified webhooks.
// Payments are "enabled" only when STRIPE_SECRET_KEY and STRIPE_PRICE_ID are set.
import { users } from './db.js';

export const paymentsEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);

let client = null;
export async function getStripe() {
  if (!client) {
    const { default: Stripe } = await import('stripe');
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}
export const setStripeForTests = (c) => { client = c; };

export async function createCheckout({ user, baseUrl, stripe, price, smallBusiness = false }) {
  stripe ||= await getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    ...(user.stripe_customer_id ? { customer: user.stripe_customer_id } : { customer_email: user.email }),
    client_reference_id: String(user.id),
    subscription_data: { metadata: { user_id: String(user.id) } },
    allow_promotion_codes: true,
    custom_text: { submit: { message: `Mit dem Klick schließt du ein kostenpflichtiges Abo${price != null ? ` über ${price} € pro Monat` : ''} ab. Kündigung jederzeit zum Ende des Abrechnungszeitraums unter ${baseUrl}/kuendigen.${smallBusiness ? ' Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.' : ''}` } },
    ...(process.env.STRIPE_AUTOMATIC_TAX === '1' ? { automatic_tax: { enabled: true }, tax_id_collection: { enabled: true } } : {}),
    success_url: `${baseUrl}/account?checkout=success`,
    cancel_url: `${baseUrl}/account?checkout=cancelled`,
  });
  return session.url;
}

export async function createPortal({ user, baseUrl, stripe }) {
  stripe ||= await getStripe();
  const session = await stripe.billingPortal.sessions.create({ customer: user.stripe_customer_id, return_url: `${baseUrl}/account` });
  return session.url;
}

// Newer Stripe API versions report the period end on the subscription item instead of the subscription.
const periodEnd = (sub) => {
  const ts = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
};

// Applies a verified Stripe event to our users table. Safe to run twice for the same event.
export function applyEvent(event) {
  const obj = event.data?.object;
  if (!obj) return { handled: false };
  if (event.type === 'checkout.session.completed' && obj.mode === 'subscription') {
    const user = users.get(Number(obj.client_reference_id)) || (obj.customer && users.byCustomer(obj.customer));
    if (!user) return { handled: false, reason: 'user not found' };
    users.update(user.id, { stripe_customer_id: obj.customer ?? user.stripe_customer_id, stripe_subscription_id: obj.subscription ?? user.stripe_subscription_id });
    return { handled: true, userId: user.id };
  }
  if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    const user = (obj.metadata?.user_id && users.get(Number(obj.metadata.user_id))) || (obj.customer && users.byCustomer(obj.customer));
    if (!user) return { handled: false, reason: 'user not found' };
    users.update(user.id, {
      stripe_customer_id: obj.customer ?? user.stripe_customer_id, stripe_subscription_id: obj.id,
      sub_status: event.type === 'customer.subscription.deleted' ? 'canceled' : obj.status, sub_period_end: periodEnd(obj),
    });
    return { handled: true, userId: user.id, status: obj.status };
  }
  return { handled: false, reason: 'ignored event type' };
}

// Ordinary cancellation: the subscription ends at the end of the current paid period. Returns the end date (ISO) if known.
export async function cancelAtPeriodEnd({ user, stripe }) {
  stripe ||= await getStripe();
  const sub = await stripe.subscriptions.update(user.stripe_subscription_id, { cancel_at_period_end: true });
  users.update(user.id, { sub_period_end: periodEnd(sub) ?? user.sub_period_end });
  return periodEnd(sub);
}

export async function verifyWebhook(rawBody, signature, stripe) {
  stripe ||= await getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}
