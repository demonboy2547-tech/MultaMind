import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAdminApp, getAdminAuth } from '@/lib/firebaseAdmin';
import Stripe from 'stripe';

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002';

export async function POST(req: Request) {
  const headersList = headers();
  const authorization = headersList.get('Authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
  }

  const idToken = authorization.split('Bearer ')[1];

  try {
    // 1. Verify the Firebase ID token using the admin module
    const adminAuth = await getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const { uid } = decodedToken;

    // 2. Retrieve the user's stripeCustomerId from Firestore
    const adminApp = getAdminApp();
    const db = adminApp.firestore();
    const userRef = db.collection('users').doc(uid);
    const userSnapshot = await userRef.get();
    const userData = userSnapshot.data();

    const stripeCustomerId = userData?.stripeCustomerId;

    if (!stripeCustomerId) {
      console.warn(`User ${uid} tried to access billing portal without a Stripe customer ID.`);
      return NextResponse.json({ error: 'Stripe customer ID not found for user.' }, { status: 404 });
    }

    // 3. Create a Stripe Billing Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${APP_URL}/`, // Redirect back to the main app page
    });

    // 4. Return the session URL
    return NextResponse.json({ url: portalSession.url }, { status: 200 });

  } catch (error: any) {
    console.error('Error creating portal session:', error);
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error' || error.code === 'auth/invalid-user-token') {
        return NextResponse.json({ error: `Unauthorized: Invalid token. ${error.message}` }, { status: 401 });
    }
    return NextResponse.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
  }
}
