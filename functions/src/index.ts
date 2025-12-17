
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// It's safer to get these from environment variables
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("Stripe secret key is not set. Set STRIPE_SECRET_KEY environment variable.");
  throw new Error("Stripe secret key is not configured.");
}
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20',
});

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
if (!STRIPE_WEBHOOK_SECRET) {
    console.error("Stripe webhook secret is not set. Set STRIPE_WEBHOOK_SECRET environment variable.");
    throw new Error("Stripe webhook secret is not configured.");
}

/**
 * Syncs subscription data from a Stripe Subscription object to the user's Firestore document.
 */
const syncSubscriptionToFirestore = async (subscription: Stripe.Subscription) => {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  
  // Get user from subscription metadata if available
  let userId = subscription.metadata.firebaseUID;

  // Fallback to querying the database by stripeCustomerId
  if (!userId) {
      const userQuery = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
      if (!userQuery.empty) {
          userId = userQuery.docs[0].id;
      }
  }

  if (!userId) {
    functions.logger.error('Could not find user for customer ID:', customerId);
    return;
  }

  const userRef = db.collection('users').doc(userId);
  
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';

  const dataToUpdate = {
    plan: isActive ? 'pro' : 'standard',
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    planStatus: subscription.status,
    currentPeriodEnd: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };

  functions.logger.log(`Syncing subscription ${subscription.id} for user ${userId}`, dataToUpdate);
  await userRef.set(dataToUpdate, { merge: true });
};

/**
 * Handles the 'checkout.session.completed' event. This is the primary event
 * for creating a new subscription.
 */
const handleCheckoutCompleted = async (session: Stripe.Checkout.Session) => {
  const userId = session.client_reference_id;
  const customerId = session.customer;
  const subscriptionId = session.subscription;

  if (!userId) {
    functions.logger.error('Checkout session completed without a user ID (client_reference_id).', { sessionId: session.id });
    return;
  }

  if (!customerId) {
    functions.logger.error('Checkout session completed without a customer ID.', { sessionId: session.id });
    return;
  }
  
  // Ensure stripeCustomerId is set on the user record, as this might be the first time.
  const userRef = db.collection('users').doc(userId);
  await userRef.set({ stripeCustomerId: customerId }, { merge: true });
  
  if (!subscriptionId) {
    functions.logger.error('Checkout session completed without a subscription ID.', { sessionId: session.id });
    return;
  }
  const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
  await syncSubscriptionToFirestore(subscription);
};

/**
 * Handles subscription cancellation by downgrading the user's plan.
 */
const handleSubscriptionEnded = async (subscription: Stripe.Subscription) => {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    let userId = subscription.metadata.firebaseUID;
    
    if(!userId){
        const userQuery = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
        if(!userQuery.empty) {
            userId = userQuery.docs[0].id;
        }
    }

    if(!userId) {
        functions.logger.error('Cannot find user for customer on subscription end.', { customerId });
        return;
    }
    
    const userRef = db.collection('users').doc(userId);

    // Downgrade user to the "standard" plan and clear subscription-specific fields
    await userRef.set({
        plan: 'standard',
        planStatus: 'canceled', // or subscription.status which would be 'canceled'
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
    }, { merge: true });
}

/**
 * A Firebase Cloud Function to handle Stripe webhooks.
 *
 * This function listens for HTTPS requests and is specifically configured
 * to handle raw request bodies, which is necessary for verifying Stripe's
 * webhook signatures.
 */
export const stripeWebhook = functions.https.onRequest(async (request, response) => {
  const sig = request.headers['stripe-signature'];

  if (!sig) {
    functions.logger.error('No Stripe signature found in request header.');
    response.status(400).send('Webhook Error: No signature present.');
    return;
  }
  
  let event: Stripe.Event;

  try {
    // The rawBody is essential for verification
    event = stripe.webhooks.constructEvent(request.rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    functions.logger.error('Stripe webhook signature verification failed.', { error: err.message });
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the specific Stripe events
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await syncSubscriptionToFirestore(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted': // Occurs when the subscription is definitively canceled
        await handleSubscriptionEnded(event.data.object as Stripe.Subscription);
        break;
      default:
        functions.logger.log(`Unhandled Stripe event type: ${event.type}`);
    }
  } catch (error) {
      functions.logger.error('Error handling Stripe event:', { eventType: event.type, error });
      response.status(500).send('Internal server error while handling webhook event.');
      return;
  }

  // Acknowledge receipt of the event with a 200 OK response
  response.status(200).json({ received: true });
});
