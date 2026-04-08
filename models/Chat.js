const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  time: String,
  sender: String,
  text: String,
  type: { type: String, enum: ['incoming', 'outgoing', 'system'], default: 'incoming' },
});

const ChatSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true },
    filename: { type: String },
    messages: [MessageSchema],
    messageCount: { type: Number, default: 0 },
    lastMessage: { type: String, default: '' },
    lastMessageTime: { type: String, default: '' },
  },
  { timestamps: true }
);

// Compound index: one chat document per phone number
ChatSchema.index({ phone: 1 }, { unique: true });

module.exports = mongoose.model('Chat', ChatSchema);
