
'use server';

import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { getProPriceIds } from '@/lib/stripe/pricing';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

// Ensure the secret key is defined
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002';

/**
 * Retrieves a Stripe customer ID for a given Firebase user UID.
 * If no customer ID exists, it creates a new Stripe customer and saves the ID.
 */
const getOrCreateCustomer = async (userId: string, email: string | null) => {
  const userRef = db.collection('users').doc(userId);
  const userSnapshot = await userRef.get();
  const userData = userSnapshot.data();

  // If customer ID already exists, return it
  if (userData?.stripeCustomerId) {
    return userData.stripeCustomerId;
  }

  // Create a new customer in Stripe
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: {
      firebaseUID: userId,
    },
  });

  // Save the new customer ID to Firestore
  await userRef.set({ stripeCustomerId: customer.id }, { merge: true });
  return customer.id;
};


export async function POST(req: NextRequest) {
  const headersList = headers();
  const authorization = headersList.get('Authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
  }

  const idToken = authorization.split('Bearer ')[1];

  try {
    // 1. Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email } = decodedToken;

    const { priceId } = await req.json();

    if (!priceId) {
        return NextResponse.json({ error: 'Price ID is required' }, { status: 400 });
    }
    
    const proPriceIds = getProPriceIds();
    if (priceId !== proPriceIds.monthly && priceId !== proPriceIds.yearly) {
        return NextResponse.json({ error: 'Invalid Price ID provided' }, { status: 400 });
    }

    // 2. Get or create a Stripe customer
    const customerId = await getOrCreateCustomer(uid, email || null);

    // 3. Create a Stripe Checkout session
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
      client_reference_id: uid,
      subscription_data: {
        metadata: {
            firebaseUID: uid,
        }
      }
    });

    // 4. Return the session URL
    if (session.url) {
      return NextResponse.json({ url: session.url }, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }
    return NextResponse.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
  }
}
