'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export interface UserProfile {
  id: string;
  email: string | null;
  plan: 'free' | 'pro' | 'standard';
  userMemory: string;
}

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

// Internal state for user authentication
interface UserAuthState {
  user: User | null;
  profile: UserProfile | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState extends UserAuthState {
  areServicesAvailable: boolean; // True if core services (app, firestore, auth instance) are provided
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null; // The Auth service instance
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser extends UserAuthState {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult extends UserAuthState {}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * Ensures a user document exists in Firestore.
 * If the document doesn't exist, it's created with a 'standard' plan and empty memory.
 * @param firestore - The Firestore instance.
 * @param user - The authenticated user.
 */
const ensureUserDocument = async (firestore: Firestore, user: User) => {
  const userRef = doc(firestore, 'users', user.uid);
  try {
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      // User document doesn't exist, create it.
      await setDoc(userRef, {
        id: user.uid,
        email: user.email,
        plan: 'standard', // Default plan is 'standard'
        userMemory: '', // Initialize with empty memory
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error ensuring user document:", error);
    // Optionally handle the error, e.g., by logging or showing a notification
  }
};


/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    profile: null,
    isUserLoading: true, // Start loading until first auth event
    userError: null,
  });

  // Effect to subscribe to Firebase auth state changes
  useEffect(() => {
    if (!auth || !firestore) { 
      setUserAuthState({ user: null, profile: null, isUserLoading: false, userError: new Error("Auth or Firestore service not provided.") });
      return;
    }

    setUserAuthState({ user: null, profile: null, isUserLoading: true, userError: null });

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (firebaseUser) {
          ensureUserDocument(firestore, firebaseUser);
          // Now that we have a user, subscribe to their profile document
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              setUserAuthState(prevState => ({
                ...prevState,
                user: firebaseUser,
                profile: docSnap.data() as UserProfile,
                isUserLoading: false,
                userError: null,
              }));
            } else {
              // This case might happen briefly before ensureUserDocument creates the doc
              setUserAuthState(prevState => ({ ...prevState, user: firebaseUser, isUserLoading: false }));
            }
          }, (error) => {
             console.error("FirebaseProvider: User profile snapshot error:", error);
             setUserAuthState({ user: firebaseUser, profile: null, isUserLoading: false, userError: error });
          });
          
          // Return a cleanup function that unsubscribes from the profile listener
          return () => unsubscribeProfile();

        } else {
          // User logged out
          setUserAuthState({ user: null, profile: null, isUserLoading: false, userError: null });
        }
      },
      (error) => { // Auth listener error
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, profile: null, isUserLoading: false, userError: error });
      }
    );
    return () => unsubscribeAuth(); // Cleanup auth listener
  }, [auth, firestore]);

  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      ...userAuthState
    };
  }, [firebaseApp, firestore, auth, userAuthState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

/**
 * Hook to access core Firebase services and user authentication state.
 * Throws error if core services are not available or used outside provider.
 */
export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    user: context.user,
    profile: context.profile,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 * This provides the User object, loading status, and any auth errors.
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export const useUser = (): UserHookResult => {
  const { user, profile, isUserLoading, userError } = useFirebase(); // Leverages the main hook
  return { user, profile, isUserLoading, userError };
};

    