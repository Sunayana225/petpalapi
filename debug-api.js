const express = require('express');
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const axios = require('axios');
const cors = require('cors');

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3001; // Different port to avoid conflicts

console.log('🔍 Debug: Starting API...');
console.log('🔍 Debug: Gemini API Key:', process.env.GEMINI_API_KEY ? 'Found' : 'Missing');

// Firebase initialization
try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  const db = admin.firestore();
  console.log('🔍 Debug: Firebase initialized successfully');
} catch (error) {
  console.error('❌ Debug: Firebase initialization failed:', error.message);
  process.exit(1);
}

// Middleware
app.use(cors());

// Routes
app.get('/', (req, res) => {
  res.send('🐾 Debug PetPal API - Testing Firebase + Gemini');
});

app.get('/is-safe', async (req, res) => {
  const { pet, food } = req.query;
  console.log(`🔍 Debug: Query received - pet: ${pet}, food: ${food}`);

  if (!pet || !food) {
    return res.status(400).json({ error: "Please provide both 'pet' and 'food' parameters." });
  }

  try {
    console.log('🔍 Debug: Querying Firestore...');
    const db = admin.firestore();
    const snapshot = await db.collection('foods')
      .where('pet', '==', pet.toLowerCase())
      .where('food', '==', food.toLowerCase())
      .get();

    console.log(`🔍 Debug: Firestore query result - empty: ${snapshot.empty}, size: ${snapshot.size}`);

    if (!snapshot.empty) {
      const doc = snapshot.docs[0].data();
      console.log('🔍 Debug: Found in Firestore, returning data');
      return res.json({
        source: 'firestore',
        ...doc
      });
    }

    console.log('🔍 Debug: Not found in Firestore, calling Gemini...');
    const geminiRes = await queryGemini(pet, food);
    console.log('🔍 Debug: Gemini response:', geminiRes);

    console.log('🔍 Debug: Saving to Firestore...');
    await db.collection('foods').add({
      pet: pet.toLowerCase(),
      food: food.toLowerCase(),
      status: geminiRes.status,
      reason: geminiRes.reason,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('🔍 Debug: Saved to Firestore successfully');

    return res.json({
      source: 'gemini',
      ...geminiRes
    });

  } catch (error) {
    console.error('❌ Debug: Error in /is-safe route:', error);
    res.status(500).json({
      error: 'Something went wrong',
      message: error.message,
      debug: true
    });
  }
});

// Gemini AI function
async function queryGemini(pet, food) {
  console.log('🔍 Debug: queryGemini called');
  
  if (!process.env.GEMINI_API_KEY) {
    console.log('🔍 Debug: No Gemini API key found');
    return {
      pet,
      food,
      status: 'unknown',
      reason: 'Gemini API key not configured. Please consult a vet.'
    };
  }

  try {
    const prompt = `Is it safe for a ${pet} to eat ${food}? Respond with just "safe", "unsafe", or "caution" followed by a brief reason in one sentence.`;
    console.log('🔍 Debug: Sending request to Gemini...');
    
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      }
    );

    console.log('🔍 Debug: Gemini API response received');
    const aiResponse = response.data.candidates[0]?.content?.parts[0]?.text || 'No information available';
    console.log('🔍 Debug: AI Response:', aiResponse);
    
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
    console.error('❌ Debug: Gemini API error:', error.response?.data || error.message);
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
  console.log(`🚀 Debug PetPal API running at http://localhost:${PORT}`);
  console.log(`🧪 Test it: http://localhost:${PORT}/is-safe?pet=dog&food=chocolate`);
});
