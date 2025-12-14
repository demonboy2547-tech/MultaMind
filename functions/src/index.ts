
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

// Initialize Firebase Admin SDK
admin.initializeApp();

// It's safer to get these from environment variables
const stripe = new Stripe(functions.config().stripe.secret, {
  apiVersion: '2024-06-20',
});
const STRIPE_WEBHOOK_SECRET = functions.config().stripe.webhook_secret;

/**
 * A Firebase Cloud Function to handle Stripe webhooks.
 *
 * This function listens for HTTPS requests and is specifically configured
 * to handle raw request bodies, which is necessary for verifying Stripe's
 * webhook signatures.
 */
export const stripeWebhook = functions.https.onRequest(async (request, response) => {
  // Get the Stripe signature from the request headers
  const sig = request.headers['stripe-signature'];

  if (!sig) {
    functions.logger.error('No Stripe signature found in request header.');
    response.status(400).send('Webhook Error: No signature present.');
    return;
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    functions.logger.error('Stripe webhook secret is not configured.');
    response.status(500).send('Server Error: Webhook secret not configured.');
    return;
  }

  let event: Stripe.Event;

  try {
    // The rawBody is essential for verification
    const rawBody = request.rawBody;
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    functions.logger.error('Stripe webhook signature verification failed.', { error: err.message });
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the specific Stripe events
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      functions.logger.log('Checkout session completed:', { sessionId: session.id });
      // TODO: Fulfill the purchase, e.g., grant access to a course, update user profile in Firestore.
      break;
    case 'customer.subscription.updated':
      const subscriptionUpdated = event.data.object as Stripe.Subscription;
      functions.logger.log('Customer subscription updated:', { subscriptionId: subscriptionUpdated.id, status: subscriptionUpdated.status });
      // TODO: Update user's subscription status in Firestore.
      break;
    case 'customer.subscription.deleted':
      const subscriptionDeleted = event.data.object as Stripe.Subscription;
      functions.logger.log('Customer subscription deleted:', { subscriptionId: subscriptionDeleted.id });
      // TODO: Handle canceled subscription, e.g., revoke access, update user status in Firestore.
      break;
    case 'invoice.payment_failed':
      const invoice = event.data.object as Stripe.Invoice;
      functions.logger.log('Invoice payment failed:', { invoiceId: invoice.id, customer: invoice.customer });
      // TODO: Notify the user about the failed payment.
      break;
    default:
      functions.logger.warn(`Unhandled Stripe event type: ${event.type}`);
  }

  // Acknowledge receipt of the event with a 200 OK response
  response.status(200).json({ received: true });
});
