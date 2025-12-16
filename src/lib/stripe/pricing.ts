
/**
 * @fileoverview Centralized module for retrieving Stripe pricing information.
 * This ensures that all pricing logic reads from environment variables as the single source of truth.
 */

/**
 * Retrieves the configured Stripe Price IDs for the Pro plan.
 * Reads directly from process.env, allowing for different values between server and client.
 *
 * @returns An object containing the monthly and yearly price IDs, which can be null if not set.
 */
export function getProPriceIds(): { monthly: string | null; yearly: string | null } {
  const monthly = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID_MONTHLY || null;
  const yearly = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID_YEARLY || null;

  return {
    monthly,
    yearly,
  };
}
