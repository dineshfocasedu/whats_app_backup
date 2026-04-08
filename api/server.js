require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const PORT = process.env.PORT || 7000;

const chatRoutes = require('../routes/chats');

const app = express();

app.use(cors());
app.use(express.json());

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  const db = await mongoose.connect(process.env.MONGO_URI);
  isConnected = db.connections[0].readyState === 1;
  console.log('MongoDB connected');
};

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ error: 'DB failed' });
  }
});

app.get('/', (req, res) => {
  res.send('Backend running 🚀');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/chats', chatRoutes);

/* LOCAL */
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;