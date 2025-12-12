
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

async function verifyChatOwnership(chatId: string, uid: string) {
    const chatRef = firestore.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists || chatDoc.data()?.userId !== uid) {
        return false;
    }
    return true;
}

// GET /api/chats/[chatId]/messages - Get messages for a chat
export async function GET(request: Request, { params }: { params: { chatId: string } }) {
  const { chatId } = params;
  const headersList = headers();
  const authHeader = headersList.get('Authorization');
  const decodedToken = await verifyToken(authHeader);

  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { uid } = decodedToken;

  const hasOwnership = await verifyChatOwnership(chatId, uid);
  if (!hasOwnership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const messagesSnapshot = await firestore.collection('chats').doc(chatId).collection('messages').orderBy('createdAt', 'asc').get();
    const messages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}


// POST /api/chats/[chatId]/messages - Add a message to a chat
export async function POST(request: Request, { params }: { params: { chatId: string } }) {
  const { chatId } = params;
  const headersList = headers();
  const authHeader = headersList.get('Authorization');
  const decodedToken = await verifyToken(authHeader);

  if (!decodedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { uid } = decodedToken;
  
  const hasOwnership = await verifyChatOwnership(chatId, uid);
  if (!hasOwnership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { author, content } = (await request.json()) as { author: string; content: string };

  if (!author || !content) {
      return NextResponse.json({ error: 'Author and content are required' }, { status: 400 });
  }

  try {
    const messageRef = await firestore.collection('chats').doc(chatId).collection('messages').add({
      chatId,
      author,
      content,
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ id: messageRef.id, author, content });
  } catch (error) {
    console.error('Error adding message:', error);
    return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
  }
}
