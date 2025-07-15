# 🐾 PetPal API

A simple REST API to check if food is safe for your pets.

## Features

- Check food safety for different pets (dogs, cats, rabbits, etc.)
- Simple JSON-based data storage
- CORS enabled for web applications
- Easy to deploy and extend

## Usage

### Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the server: `node index.js`
4. Visit: `http://localhost:3000`

### API Endpoints

- `GET /` - Welcome message
- `GET /is-safe?pet=dog&food=grapes` - Check if food is safe for a pet

### Example Response

```json
{
  "pet": "dog",
  "food": "grapes",
  "status": "unsafe",
  "reason": "Grapes can cause kidney failure in dogs."
}
```

## Deployment

This API is designed to be easily deployed on platforms like Render, Vercel, or Heroku.

### Render Deployment

1. Connect your GitHub repository
2. Use these settings:
   - Environment: Node
   - Build command: `npm install`
   - Start command: `node index.js`

## Contributing

Feel free to add more food safety data to `data/foods.json`!
