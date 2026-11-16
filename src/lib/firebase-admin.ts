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
      let parsedKey: any;
      if (typeof serviceAccountEnv === 'string') {
        const trimmed = serviceAccountEnv.trim();
        if (trimmed.startsWith('{')) {
          parsedKey = JSON.parse(trimmed);
        } else {
          // Attempt base64 decode if not raw JSON
          parsedKey = JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
        }
      } else {
        parsedKey = serviceAccountEnv;
      }

      adminApp = initializeApp({
        credential: cert(parsedKey),
        projectId: parsedKey.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
      console.log('✓ Firebase Admin initialized via FIREBASE_SERVICE_ACCOUNT_KEY (Project:', parsedKey.project_id, ')');
    } else {
      // NOTE: Do NOT initialize with projectId only, as an unauthenticated Firebase Admin SDK
      // will attempt to connect to Google Cloud metadata server (169.254.169.254) on Vercel AWS Lambda,
      // hanging for 10-30 seconds and freezing the application. Cleanly leave adminApp undefined.
      console.log('ℹ Firebase Admin: No service account credentials found. Operating in local SQLite mode.');
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
