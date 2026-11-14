import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let adminApp: App | undefined;
let firestoreDb: Firestore | null = null;

if (!getApps().length) {
  try {
    const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (fs.existsSync(keyPath)) {
      const parsedKey = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      adminApp = initializeApp({
        credential: cert(parsedKey),
        projectId: parsedKey.project_id,
      });
      console.log('✓ Firebase Admin initialized with serviceAccountKey.json (Project:', parsedKey.project_id, ')');
    } else if (serviceAccountEnv) {
      const parsedKey = typeof serviceAccountEnv === 'string' ? JSON.parse(serviceAccountEnv) : serviceAccountEnv;
      adminApp = initializeApp({
        credential: cert(parsedKey),
        projectId: parsedKey.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
      console.log('✓ Firebase Admin initialized via FIREBASE_SERVICE_ACCOUNT_KEY');
    } else if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      adminApp = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    }
  } catch (err: any) {
    console.warn('Firebase admin initialization warning:', err.message);
  }
} else {
  adminApp = getApps()[0];
}

if (adminApp) {
  try {
    firestoreDb = getFirestore(adminApp);
  } catch {
    firestoreDb = null;
  }
}

export const adminDb = firestoreDb;
export { adminApp };
