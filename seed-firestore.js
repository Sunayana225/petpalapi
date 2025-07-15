const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seedFirestore() {
  try {
    console.log('🌱 Starting Firestore seeding...');
    
    // Read existing JSON data
    const foodData = JSON.parse(fs.readFileSync('./data/foods.json', 'utf8'));
    
    // Add each food item to Firestore
    for (const food of foodData) {
      await db.collection('foods').add({
        pet: food.pet.toLowerCase(),
        food: food.food.toLowerCase(),
        status: food.status,
        reason: food.reason,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'initial_seed'
      });
      
      console.log(`✅ Added: ${food.pet} + ${food.food} (${food.status})`);
    }
    
    console.log('🎉 Firestore seeding completed successfully!');
    console.log(`📊 Total items seeded: ${foodData.length}`);
    
    // Verify the data
    const snapshot = await db.collection('foods').get();
    console.log(`🔍 Verification: ${snapshot.size} documents in Firestore`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error seeding Firestore:', error);
    process.exit(1);
  }
}

// Run the seeding
seedFirestore();
