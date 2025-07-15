const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Load JSON data (fallback for testing)
const foodData = JSON.parse(fs.readFileSync('./data/foods.json', 'utf8'));

// Middleware
app.use(cors());

// Routes
app.get('/', (req, res) => {
  res.send('🐾 PetPal API Test Version - Ready for Firebase migration!');
});

app.get('/is-safe', (req, res) => {
  const { pet, food } = req.query;

  if (!pet || !food) {
    return res.status(400).json({ error: "Please provide both 'pet' and 'food' parameters." });
  }

  const result = foodData.find(
    item =>
      item.pet.toLowerCase() === pet.toLowerCase() &&
      item.food.toLowerCase() === food.toLowerCase()
  );

  if (result) {
    res.json({
      source: 'json_file',
      ...result
    });
  } else {
    res.status(404).json({
      pet,
      food,
      status: "unknown",
      message: "This food is not in our database. Add Firebase credentials to enable AI fallback!",
      next_step: "Add serviceAccountKey.json and Gemini API key to enable full features"
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PetPal Test API running at http://localhost:${PORT}`);
  console.log(`🧪 Test it: http://localhost:${PORT}/is-safe?pet=dog&food=grapes`);
  console.log(`📋 Next: Add serviceAccountKey.json to enable Firestore + AI features`);
});
