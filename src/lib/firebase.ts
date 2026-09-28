import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

let _app: FirebaseApp | undefined;
let _db: Firestore | undefined;
let _auth: Auth | undefined;

export function firebaseApp() {
  if (!_app) _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

export function db() {
  if (!_db) {
    const app = firebaseApp();
    try {
      // Offline cache keeps the front desk working through spotty Wi-Fi.
      _db = initializeFirestore(app, {
        ignoreUndefinedProperties: true,
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      _db = initializeFirestore(app, { ignoreUndefinedProperties: true });
    }
  }
  return _db;
}

export function auth() {
  if (!_auth) _auth = getAuth(firebaseApp());
  return _auth;
}
