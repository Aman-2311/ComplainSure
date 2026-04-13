const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { initDB } = require('./db');
const authRoutes      = require('./routes/auth');
const complaintRoutes = require('./routes/complaint');
const adminRoutes     = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

// serve frontend and css
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/css', express.static(path.join(__dirname, '../css')));

// api routes
app.use('/api/auth',      authRoutes);
app.use('/api/complaint', complaintRoutes);
app.use('/api/admin',     adminRoutes);

// fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// start server
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ ComplainSure running on port ${PORT} (0.0.0.0)`);
  });
}).catch(err => {
  console.error('❌ Database connection failed:', err.message);
  process.exit(1);
});
