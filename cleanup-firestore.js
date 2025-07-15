const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function cleanupBadData() {
  try {
    console.log('🧹 Starting Firestore cleanup...');
    
    // Find all documents with status "unknown" and reason containing "Unable to get AI response"
    const snapshot = await db.collection('foods')
      .where('status', '==', 'unknown')
      .get();
    
    console.log(`🔍 Found ${snapshot.size} documents with unknown status`);
    
    let deletedCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.reason && data.reason.includes('Unable to get AI response')) {
        console.log(`🗑️ Deleting bad entry: ${data.pet} + ${data.food}`);
        await doc.ref.delete();
        deletedCount++;
      }
    }
    
    console.log(`✅ Cleanup completed! Deleted ${deletedCount} bad entries.`);
    
    // Show remaining data
    const remainingSnapshot = await db.collection('foods').get();
    console.log(`📊 Remaining documents in Firestore: ${remainingSnapshot.size}`);
    
    console.log('\n📋 Current Firestore data:');
    remainingSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.pet} + ${data.food} = ${data.status}`);
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupBadData();
