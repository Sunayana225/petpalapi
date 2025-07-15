const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Load JSON data
const foodData = JSON.parse(fs.readFileSync('./data/foods.json', 'utf8'));

// Middleware
app.use(cors());

// Routes
app.get('/', (req, res) => {
  res.send('🐾 Welcome to PetPal API – Check if food is safe for your pet!');
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
    res.json(result);
  } else {
    res.status(404).json({
      pet,
      food,
      status: "unknown",
      message: "This food is not in our database. Please consult a vet."
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 PetPal API running at http://localhost:${port}`);
});
