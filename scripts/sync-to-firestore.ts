import { seedFirestore } from '../src/lib/firestore-service';

async function main() {
  console.log('🚀 Synchronizing KPL Master Data into Cloud Firestore...');
  try {
    const result = await seedFirestore();
    console.log(`✅ Success! Seeded:`, result);
  } catch (error: any) {
    console.error('❌ Firestore Sync Error:', error.message);
    console.info('\n💡 Note: Make sure either FIREBASE_SERVICE_ACCOUNT_KEY or NEXT_PUBLIC_FIREBASE_PROJECT_ID is provided in .env.local, or authenticate with Firebase CLI.');
  }
}

main();
