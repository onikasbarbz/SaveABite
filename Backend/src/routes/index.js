const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// 1. MIDDLEWARE

app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
// Ensure the 'uploads' folder exists in your Backend root
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 2. IMPORT ROUTES (Updated to match your filenames)
const authRoutes = require('./src/routes/auth.routes'); 
const listingRoutes = require('./src/routes/listingRoutes');
const ngoRoutes = require('./src/routes/ngo.routes');

// 3. REGISTER ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/ngo', ngoRoutes); 

// 4. TEST ROUTE
app.get('/', (req, res) => {
    res.send('SaveABite Backend is Running! 🚀');
});

// 5. START SERVER
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    =============================================
    ✅ SERVER RUNNING ON PORT: ${PORT}
    📡 LOCAL: http://localhost:${PORT}
    =============================================
    `);
});