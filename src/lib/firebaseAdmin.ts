
'use server';

import * as admin from 'firebase-admin';
import { cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const initializeAdminApp = () => {
    if (admin.apps.length > 0) {
        return admin.apps[0]!;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // The private key needs newlines to be correctly parsed.
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Firebase Admin SDK environment variables are not set. Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    }

    return admin.initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey,
        }),
        projectId,
    });
};

export const getAdminApp = () => {
    return initializeAdminApp();
}

export const getAdminAuth = () => {
    return getAuth(initializeAdminApp());
};
