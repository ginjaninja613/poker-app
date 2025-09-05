console.log('Starting server.js...');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/auth');
const casinoRoutes = require('./src/routes/casinos');
const tournamentRoutes = require('./src/routes/tournaments');
const staffRequestsRoutes = require('./src/routes/staffRequests');


const app = express();

// Core middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api/staff-requests', staffRequestsRoutes);


// Health check
app.get('/', (_req, res) => res.send('Poker Tournament App Backend'));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/casinos', casinoRoutes);
app.use('/api/tournaments', tournamentRoutes);

// Start
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  // Force Express to bind to all interfaces (LAN included)
  const HOST = '0.0.0.0';
  app.listen(PORT, HOST, () => console.log(`Server running on http://${HOST}:${PORT}`));
}).catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

