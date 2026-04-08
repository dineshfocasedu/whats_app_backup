require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const chatRoutes = require('./routes/chats');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/chats', chatRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok running' }));

// Connect to MongoDB (cached to avoid reconnecting on every request)
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
};

// Middleware to connect DB before each request
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// ✅ Export app instead of app.listen()
module.exports = app;