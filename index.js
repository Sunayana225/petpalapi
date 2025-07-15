const express = require('express');
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const axios = require('axios');
const cors = require('cors');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Firebase initialization
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Production: Use environment variable
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log('🔥 Using Firebase credentials from environment variable');
} else {
  // Development: Use local file
  serviceAccount = require('./serviceAccountKey.json');
  console.log('🔥 Using Firebase credentials from local file');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Middleware
app.use(cors());

// Routes
app.get('/', (req, res) => {
  res.send('🐾 Welcome to PetPal API – Check if food is safe for your pet!');
});

// API route for compatibility with /api/check
app.get('/api/check', async (req, res) => {
  const { pet, food, animal } = req.query;

  // Support both 'pet' and 'animal' parameters
  const petType = pet || animal;

  if (!petType || !food) {
    return res.status(400).json({
      error: "Please provide both 'pet' (or 'animal') and 'food' parameters.",
      example: "/api/check?pet=dog&food=grapes"
    });
  }

  try {
    console.log(`🔍 API Query: ${petType} + ${food}`);

    // Query Firestore for existing data
    const snapshot = await db.collection('foods')
      .where('pet', '==', petType.toLowerCase())
      .where('food', '==', food.toLowerCase())
      .get();

    console.log(`🔍 Firestore result: empty=${snapshot.empty}, size=${snapshot.size}`);

    if (!snapshot.empty) {
      const doc = snapshot.docs[0].data();
      console.log('✅ Found in Firestore');
      return res.json({
        source: 'firestore',
        animal: petType,
        pet: petType,
        food: food,
        safe: doc.status === 'safe',
        status: doc.status,
        reason: doc.reason,
        notes: doc.reason
      });
    }

    console.log('🤖 Calling Gemini AI...');
    // If not found in Firestore, use Gemini AI fallback
    const geminiRes = await queryGemini(petType, food);
    console.log('🤖 Gemini response:', geminiRes);

    // Save Gemini result to Firestore for future queries
    console.log('💾 Saving to Firestore...');
    await db.collection('foods').add({
      pet: petType.toLowerCase(),
      food: food.toLowerCase(),
      status: geminiRes.status,
      reason: geminiRes.reason,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Saved to Firestore');

    return res.json({
      source: 'gemini',
      animal: petType,
      pet: petType,
      food: food,
      safe: geminiRes.status === 'safe',
      status: geminiRes.status,
      reason: geminiRes.reason,
      notes: geminiRes.reason
    });

  } catch (error) {
    console.error('❌ Error in /api/check route:', error);
    res.status(500).json({
      error: 'Something went wrong',
      message: 'Please try again later or consult a vet.',
      debug: error.message
    });
  }
});

app.get('/is-safe', async (req, res) => {
  const { pet, food } = req.query;

  if (!pet || !food) {
    return res.status(400).json({ error: "Please provide both 'pet' and 'food' parameters." });
  }

  try {
    // Query Firestore for existing data
    const snapshot = await db.collection('foods')
      .where('pet', '==', pet.toLowerCase())
      .where('food', '==', food.toLowerCase())
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0].data();
      return res.json({
        source: 'firestore',
        ...doc
      });
    }

    // If not found in Firestore, use Gemini AI fallback
    const geminiRes = await queryGemini(pet, food);

    // Save Gemini result to Firestore for future queries
    await db.collection('foods').add({
      pet: pet.toLowerCase(),
      food: food.toLowerCase(),
      status: geminiRes.status,
      reason: geminiRes.reason,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({
      source: 'gemini',
      ...geminiRes
    });

  } catch (error) {
    console.error('Error in /is-safe route:', error);
    res.status(500).json({
      error: 'Something went wrong',
      message: 'Please try again later or consult a vet.'
    });
  }
});

// Gemini AI fallback function
async function queryGemini(pet, food) {
  console.log('🔍 GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
  console.log('🔍 GEMINI_API_KEY preview:', process.env.GEMINI_API_KEY?.slice(0, 10));
  console.log('🔍 All env keys:', Object.keys(process.env).filter(key => key.includes('GEMINI')));

  if (!process.env.GEMINI_API_KEY) {
    console.log('❌ Gemini API key not found in environment');
    return {
      pet,
      food,
      status: 'unknown',
      reason: 'Gemini API key not configured. Please consult a vet.'
    };
  }

  try {
    const prompt = `Is it safe for a ${pet} to eat ${food}? Respond with just "safe", "unsafe", or "caution" followed by a brief reason in one sentence.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      }
    );

    const aiResponse = response.data.candidates[0]?.content?.parts[0]?.text || 'No information available';

    // Parse AI response to extract status
    let status = 'unknown';
    if (aiResponse.toLowerCase().includes('safe') && !aiResponse.toLowerCase().includes('unsafe')) {
      status = 'safe';
    } else if (aiResponse.toLowerCase().includes('unsafe')) {
      status = 'unsafe';
    } else if (aiResponse.toLowerCase().includes('caution')) {
      status = 'caution';
    }

    return {
      pet,
      food,
      status,
      reason: aiResponse
    };

  } catch (error) {
    console.error('Gemini API error:', error);
    return {
      pet,
      food,
      status: 'unknown',
      reason: 'Unable to get AI response. Please consult a vet.'
    };
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PetPal API with Firestore + Gemini AI running at http://localhost:${PORT}`);
  console.log(`🧪 Test it: http://localhost:${PORT}/is-safe?pet=dog&food=grapes`);
  console.log(`🔑 Environment check:`);
  console.log(`   - GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'Found (' + process.env.GEMINI_API_KEY.slice(0, 10) + '...)' : 'Missing'}`);
  console.log(`   - FIREBASE_SERVICE_ACCOUNT: ${process.env.FIREBASE_SERVICE_ACCOUNT ? 'Found' : 'Missing'}`);
  console.log(`   - PORT: ${PORT}`);
});
