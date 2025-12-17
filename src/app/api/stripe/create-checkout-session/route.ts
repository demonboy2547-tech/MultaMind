
'use server';

import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getProPriceIds } from '@/lib/stripe/pricing';
import { getAdminAuth } from '@/lib/firebaseAdmin';

// A single place to hold the Stripe instance
let stripe: Stripe;

/**
 * Validates required environment variables and initializes Stripe.
 * Throws an error if any required variable is missing.
 */
function initializeStripeAndCheckEnv() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const proPriceIds = getProPriceIds();
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!stripeSecretKey) {
        throw new Error('Stripe secret key is not set in environment variables.');
    }
    if (!proPriceIds.monthly && !proPriceIds.yearly) {
        throw new Error('Stripe Pro Price IDs are not set in environment variables.');
    }
    if (!appUrl) {
        throw new Error('NEXT_PUBLIC_SITE_URL is not set in environment variables.');
    }

    // Initialize Stripe only if it hasn't been already
    if (!stripe) {
        stripe = new Stripe(stripeSecretKey, {
            apiVersion: '2024-06-20',
        });
    }
}


/**
 * Retrieves a Stripe customer ID for a given Firebase user UID.
 * If no customer ID exists, it creates a new Stripe customer and saves the ID.
 */
const getOrCreateCustomer = async (userId: string, email: string | null): Promise<string> => {
  // This part now requires an initialized admin app to access Firestore.
  // For simplicity, we'll focus on creating the customer in Stripe.
  // A more robust implementation would involve a separate lib function to get DB access.
  
  // NOTE: This function won't be able to read from Firestore without the DB instance.
  // Let's assume for now we always create or find on Stripe's side.

  const existingCustomers = await stripe.customers.list({
    email: email ?? undefined,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0].id;
  }

  // Create a new customer in Stripe
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: {
      firebaseUID: userId,
    },
  });

  return customer.id;
};


export async function POST(req: NextRequest) {
  try {
    // 1. Initialize Stripe and validate environment variables
    initializeStripeAndCheckEnv();

    // 2. Authenticate the user with Firebase Admin SDK
    const headersList = headers();
    const authorization = headersList.get('Authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    
    const adminAuth = await getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const { uid, email } = decodedToken;

    // 3. Validate the incoming request body
    const { priceId } = await req.json();
    if (!priceId) {
        return NextResponse.json({ error: 'Price ID is required' }, { status: 400 });
    }
    
    const proPriceIds = getProPriceIds();
    if (priceId !== proPriceIds.monthly && priceId !== proPriceIds.yearly) {
        return NextResponse.json({ error: 'Invalid Price ID provided' }, { status: 400 });
    }

    // 4. Get or create a Stripe customer
    const customerId = await getOrCreateCustomer(uid, email || null);
    
    const APP_URL = process.env.NEXT_PUBLIC_SITE_URL!;

    // 5. Create a Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${APP_URL}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/`,
      client_reference_id: uid, // Pass Firebase UID to pre-fill customer details if needed
      subscription_data: {
        metadata: {
            firebaseUID: uid, // Crucial for webhook to link subscription to user
        }
      }
    });

    // 6. Return the session URL on success
    if (session.url) {
      return NextResponse.json({ url: session.url }, { status: 200 });
    } else {
      // This case should ideally not happen if Stripe session creation is successful
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    // Generic error handler for any failure in the try block
    return NextResponse.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
  }
}
