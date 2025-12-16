
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// It's safer to get these from environment variables
const stripe = new Stripe(functions.config().stripe.secret, {
  apiVersion: '2024-06-20',
});
const STRIPE_WEBHOOK_SECRET = functions.config().stripe.webhook_secret;

/**
 * Retrieves a Stripe customer ID for a given Firebase user UID.
 * If no customer ID exists, it creates a new Stripe customer.
 */
const getOrCreateCustomer = async (userId: string, email: string | null) => {
  const userRef = db.collection('users').doc(userId);
  const userSnapshot = await userRef.get();
  const userData = userSnapshot.data();

  if (userData?.stripeCustomerId) {
    return userData.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: {
      firebaseUID: userId,
    },
  });

  await userRef.update({ stripeCustomerId: customer.id });
  return customer.id;
};

/**
 * Syncs subscription data from Stripe to the user's Firestore document.
 */
const syncSubscriptionToFirestore = async (subscription: Stripe.Subscription) => {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  
  // Get user from client_reference_id on the checkout session if available
  let userId = subscription.metadata.firebaseUID;

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

  const plan = subscription.items.data[0].price.recurring?.interval === 'year' ? 'pro' : 'pro'; // Assuming both are "pro"
  const billingInterval = subscription.items.data[0].price.recurring?.interval ?? null;

  const dataToUpdate = {
    plan: plan,
    planStatus: subscription.status,
    billingInterval: billingInterval,
    currentPeriodEnd: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    graceUntil: null, // Reset grace period on successful update
  };

  functions.logger.log(`Syncing subscription ${subscription.id} for user ${userId}`, dataToUpdate);
  await userRef.update(dataToUpdate);
};

/**
 * Handles the 'checkout.session.completed' event.
 */
const handleCheckoutCompleted = async (session: Stripe.Checkout.Session) => {
  const userId = session.client_reference_id;
  const customerId = session.customer;

  if (!userId) {
    functions.logger.error('Checkout session completed without a user ID.', { sessionId: session.id });
    return;
  }

  // Ensure stripeCustomerId is set, especially for the first subscription
  if (customerId) {
      const userRef = db.collection('users').doc(userId);
      await userRef.update({ stripeCustomerId: customerId });
  }

  if (!session.subscription) {
    functions.logger.error('Checkout session completed without a subscription ID.', { sessionId: session.id });
    return;
  }
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
  await syncSubscriptionToFirestore(subscription);
};


/**
 * Handles the 'invoice.payment_failed' event.
 */
const handlePaymentFailed = async (invoice: Stripe.Invoice) => {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const userQuery = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
  if (userQuery.empty) return;

  const userRef = userQuery.docs[0].ref;
  const graceUntil = admin.firestore.Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now

  await userRef.update({
    planStatus: 'past_due',
    graceUntil: graceUntil,
  });
};

/**
 * Handles subscription cancellation or grace period expiry by downgrading the user.
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

    // Downgrade user to the "standard" plan
    await userRef.update({
        plan: 'standard',
        planStatus: 'canceled',
        billingInterval: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        graceUntil: null,
    });
}


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
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await syncSubscriptionToFirestore(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionEnded(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        functions.logger.warn(`Unhandled Stripe event type: ${event.type}`);
    }
  } catch (error) {
      functions.logger.error('Error handling Stripe event:', { eventType: event.type, error });
      response.status(500).send('Internal server error while handling webhook event.');
      return;
  }

  // Acknowledge receipt of the event with a 200 OK response
  response.status(200).json({ received: true });
});
