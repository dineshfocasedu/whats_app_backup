const express = require('express');
const multer = require('multer');
const router = express.Router();

const Chat = require('../models/Chat');
const { parseAnyChat, dedupeAndSortMessages } = require('../middleware/parser');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 6000,
    fileSize: 10 * 1024 * 1024,
  },
});

/* ================= BULK UPLOAD ================= */
router.post('/upload', upload.array('files', 6000), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const grouped = new Map();
    let skipped = 0;

    for (const file of files) {
      const filename = file.originalname || '';
      if (!filename.match(/\.(json|txt)$/i)) {
        skipped += 1;
        continue;
      }

      try {
        const content = file.buffer.toString('utf8');
        const parsed = parseAnyChat(filename, content);

        if (!parsed.phone) {
          skipped += 1;
          continue;
        }

        if (!grouped.has(parsed.phone)) {
          grouped.set(parsed.phone, {
            phone: parsed.phone,
            filenames: new Set(),
            messages: [],
          });
        }

        const row = grouped.get(parsed.phone);
        row.filenames.add(filename);
        row.messages.push(...parsed.messages);
      } catch (err) {
        skipped += 1;
      }
    }

    const operations = [];
    for (const [, row] of grouped) {
      const messages = dedupeAndSortMessages(row.messages);
      const last = messages[messages.length - 1] || null;

      operations.push({
        updateOne: {
          filter: { phone: row.phone },
          update: {
            $set: {
              phone: row.phone,
              filename: Array.from(row.filenames).join(', '),
              messages,
              messageCount: messages.length,
              lastMessage: last ? last.text : '',
              lastMessageTime: last ? last.time : '',
            },
          },
          upsert: true,
        },
      });
    }

    if (operations.length > 0) {
      await Chat.bulkWrite(operations, { ordered: false });
    }

    res.json({
      success: true,
      uploadedFiles: files.length,
      importedChats: operations.length,
      skippedFiles: skipped,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
