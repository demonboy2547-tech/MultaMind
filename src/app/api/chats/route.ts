
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { headers } from 'next/headers';

// Initialize Firebase Admin SDK
let adminApp: App;
if (!getApps().length) {
  adminApp = initializeApp();
} else {
  adminApp = getApps()[0];
}

const firestore = getFirestore(adminApp);
const auth = getAuth(adminApp);

async function verifyToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

// POST /api/chats - Create a new chat
export async function POST(request: Request) {
  const headersList = headers();
  const authHeader = headersList.get('Authorization');
  const decodedToken = await verifyToken(authHeader);

  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { uid } = decodedToken;
  const { title } = (await request.json()) as { title?: string };

  try {
    const chatRef = await firestore.collection('chats').add({
      userId: uid,
      title: title || 'New Chat',
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ id: chatRef.id, title: title || 'New Chat' });
  } catch (error) {
    console.error('Error creating chat:', error);
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 });
  }
}

// GET /api/chats - List user's chats
export async function GET(request: Request) {
  const headersList = headers();
  const authHeader = headersList.get('Authorization');
  const decodedToken = await verifyToken(authHeader);

  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { uid } = decodedToken;

  try {
    const chatsSnapshot = await firestore.collection('chats').where('userId', '==', uid).orderBy('createdAt', 'desc').get();
    const chats = chatsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 });
  }
}
