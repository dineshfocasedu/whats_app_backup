const express = require('express');
const router = express.Router();

const Chat = require('../models/Chat');

/* ================= LIST ================= */
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;

    const query = search
      ? { phone: { $regex: search, $options: 'i' } }
      : {};

    const chats = await Chat.find(query)
      .select('phone messageCount lastMessage lastMessageTime filename updatedAt')
      .sort({ updatedAt: -1 });

    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= GET ONE ================= */
router.get('/:phone', async (req, res) => {
  try {
    const chat = await Chat.findOne({ phone: req.params.phone });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= DELETE ================= */
router.delete('/:phone', async (req, res) => {
  try {
    await Chat.deleteOne({ phone: req.params.phone });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;