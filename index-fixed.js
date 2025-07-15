const express = require('express');
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const axios = require('axios');
const cors = require('cors');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Firebase initialization
const serviceAccount = require('./serviceAccountKey.json');

// Check if Firebase is already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  console.log('Firebase already initialized');
}

const db = admin.firestore();

// Middleware
app.use(cors());

// Routes
app.get('/', (req, res) => {
  res.send('🐾 Welcome to PetPal API – Check if food is safe for your pet!');
});

app.get('/is-safe', async (req, res) => {
  const { pet, food } = req.query;

  if (!pet || !food) {
    return res.status(400).json({ error: "Please provide both 'pet' and 'food' parameters." });
  }

  try {
    console.log(`🔍 Query: ${pet} + ${food}`);
    
    // Query Firestore for existing data
    const snapshot = await db.collection('foods')
      .where('pet', '==', pet.toLowerCase())
      .where('food', '==', food.toLowerCase())
      .get();

    console.log(`🔍 Firestore result: empty=${snapshot.empty}, size=${snapshot.size}`);

    if (!snapshot.empty) {
      const doc = snapshot.docs[0].data();
      console.log('✅ Found in Firestore');
      return res.json({
        source: 'firestore',
        ...doc
      });
    }

    console.log('🤖 Calling Gemini AI...');
    // If not found in Firestore, use Gemini AI fallback
    const geminiRes = await queryGemini(pet, food);
    console.log('🤖 Gemini response:', geminiRes);

    // Save Gemini result to Firestore for future queries
    console.log('💾 Saving to Firestore...');
    await db.collection('foods').add({
      pet: pet.toLowerCase(),
      food: food.toLowerCase(),
      status: geminiRes.status,
      reason: geminiRes.reason,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Saved to Firestore');

    return res.json({
      source: 'gemini',
      ...geminiRes
    });

  } catch (error) {
    console.error('❌ Error in /is-safe route:', error);
    res.status(500).json({
      error: 'Something went wrong',
      message: 'Please try again later or consult a vet.',
      debug: error.message
    });
  }
});

// Gemini AI fallback function
async function queryGemini(pet, food) {
  if (!process.env.GEMINI_API_KEY) {
    console.log('⚠️ No Gemini API key found');
    return {
      pet,
      food,
      status: 'unknown',
      reason: 'Gemini API key not configured. Please consult a vet.'
    };
  }

  try {
    const prompt = `Is it safe for a ${pet} to eat ${food}? Respond with just "safe", "unsafe", or "caution" followed by a brief reason in one sentence.`;
    console.log('🤖 Sending to Gemini...');
    
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      }
    );

    const aiResponse = response.data.candidates[0]?.content?.parts[0]?.text || 'No information available';
    console.log('🤖 AI Response:', aiResponse);
    
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
    console.error('❌ Gemini API error:', error.response?.data || error.message);
    return {
      pet,
      food,
      status: 'unknown',
      reason: 'Unable to get AI response. Please consult a vet.'
    };
  }
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 PetPal API with Firestore + Gemini AI running at http://localhost:${PORT}`);
  console.log(`🧪 Test it: http://localhost:${PORT}/is-safe?pet=dog&food=grapes`);
  console.log(`🔑 Gemini API Key: ${process.env.GEMINI_API_KEY ? 'Found' : 'Missing'}`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
