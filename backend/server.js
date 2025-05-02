console.log('Starting server.js...');

try {
  require('dotenv').config();
  console.log('Environment variables:', {
    MONGO_URI: process.env.MONGO_URI ? 'Set' : 'Missing',
    PORT: process.env.PORT || '5000',
    FIREBASE_CREDENTIALS: process.env.FIREBASE_CREDENTIALS || 'Missing',
  });

  if (!process.env.FIREBASE_CREDENTIALS) {
    throw new Error('FIREBASE_CREDENTIALS is not defined in .env');
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not defined in .env');
  }

  const express = require('express');
  const cors = require('cors');
  const admin = require('firebase-admin');
  const connectDB = require('./src/config/db');
  const casinoRoutes = require('./src/routes/casinos'); // Import the casino routes

  const app = express();

  // Initialize Firebase Admin SDK
  console.log('Initializing Firebase...');
  try {
    const serviceAccount = require(process.env.FIREBASE_CREDENTIALS);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`, // Add Firebase Realtime Database URL
    });
    console.log('Firebase initialized successfully');
  } catch (firebaseError) {
    console.error('Firebase initialization error:', firebaseError.message);
    throw firebaseError;
  }

  // Connect to MongoDB
  console.log('Connecting to MongoDB...');
  connectDB();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Routes
  app.use('/api/casinos', casinoRoutes); // Mount casino routes at /api/casinos

  // Basic route
  app.get('/', (req, res) => {
    res.send('Poker Tournament App Backend');
  });

  // Port
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
} catch (error) {
  console.error('Server error:', error.message);
  process.exit(1);
}