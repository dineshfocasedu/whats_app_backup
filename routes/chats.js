const express = require('express');
const router = express.Router();

const Chat = require('../models/Chat');
const upload = require('../middleware/upload');
const { parseChat } = require('../middleware/parser');

/* ================= UPLOAD ================= */
router.post(
  '/upload',
  (req, res, next) => {
    upload.array('files', 500)(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Upload error' });
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    const errors = [];

    for (const file of req.files) {
      try {
        // ✅ FIX: read from memory buffer
        const content = file.buffer.toString('utf-8');

        const { phone, messages } = parseChat(file.originalname, content);

        if (!messages.length) {
          errors.push({ file: file.originalname, error: 'No messages found' });
          continue;
        }

        const lastMsg = messages[messages.length - 1];

        const existing = await Chat.findOne({ phone });

        if (existing) {
          const existingKeys = new Set(
            existing.messages.map((m) => `${m.time}||${m.sender}`)
          );

          const newMessages = messages.filter(
            (m) => !existingKeys.has(`${m.time}||${m.sender}`)
          );

          existing.messages.push(...newMessages);
          existing.messageCount = existing.messages.length;
          existing.lastMessage = lastMsg.text.replace(/\n/g, ' ').slice(0, 80);
          existing.lastMessageTime = lastMsg.time;
          existing.filename = file.originalname;

          await existing.save();

          results.push({
            phone,
            status: 'updated',
            newMessages: newMessages.length,
          });
        } else {
          const chat = new Chat({
            phone,
            filename: file.originalname,
            messages,
            messageCount: messages.length,
            lastMessage: lastMsg.text.replace(/\n/g, ' ').slice(0, 80),
            lastMessageTime: lastMsg.time,
          });

          await chat.save();

          results.push({
            phone,
            status: 'created',
            newMessages: messages.length,
          });
        }
      } catch (err) {
        errors.push({ file: file.originalname, error: err.message });
      }
    }

    res.json({ success: true, results, errors });
  }
);

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