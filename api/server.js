require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const chatRoutes = require('../routes/chats');

const app = express();

app.use(cors());
app.use(express.json());

/* DB */
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  const db = await mongoose.connect(process.env.MONGO_URI);
  isConnected = db.connections[0].readyState === 1;
  console.log("MongoDB connected");
};

/* Middleware */
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    return res.status(500).json({ error: "DB failed" });
  }
});

/* Routes */
app.get('/', (req, res) => {
  res.send('Backend running 🚀');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/chats', chatRoutes);

/* ================================
   ✅ LOCAL SERVER (IMPORTANT FIX)
================================ */
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 7000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

/* ================================
   ✅ EXPORT FOR VERCEL
================================ */
module.exports = app;