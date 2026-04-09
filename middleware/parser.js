const path = require('path');

const reTimestamp = /^\[\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}\]/;
const reMsg = /^\[(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2})\] ([^:]*): ([\s\S]*)$/;
const reTpl = /^\[(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2})\] (Template [\s\S]+?was sent\.)\s*$/;

function digitsOnly(value = '') {
  return String(value).replace(/\D/g, '');
}

function classifyTextMessage(sender, phone) {
  if (sender === '') return 'outgoing';
  if (/[a-zA-Z]/.test(sender)) return 'outgoing';

  const cs = digitsOnly(sender);
  const cp = digitsOnly(phone);

  if (cs && cp && cs === cp) return 'incoming';
  return 'incoming';
}

function classifyJsonMessage(userPhone, chatPhone, body) {
  const sender = String(userPhone || '').trim();
  const senderDigits = digitsOnly(sender);
  const chatDigits = digitsOnly(chatPhone);
  const lowerSender = sender.toLowerCase();
  const lowerBody = String(body || '').toLowerCase();

  if (!sender) return 'system';
  if (senderDigits && chatDigits && senderDigits === chatDigits) return 'incoming';

  if (
    lowerSender.includes('api') ||
    lowerSender.includes('automation') ||
    lowerSender.includes('trigger') ||
    lowerBody.includes('template')
  ) {
    return 'api';
  }

  if (
    lowerSender.includes('operator') ||
    lowerSender.includes('agent') ||
    lowerSender.includes('admin') ||
    lowerSender.includes('bot')
  ) {
    return 'outgoing';
  }

  if (senderDigits) return 'incoming';
  return 'outgoing';
}

function parseTxtChat(filename, content) {
  const match = filename.match(/^(\d+)-/);
  const phone = match ? match[1] : filename.replace('.txt', '');

  const lines = content.split('\n');
  const blocks = [];
  let cur = null;

  for (const line of lines) {
    if (reTimestamp.test(line)) {
      if (cur) blocks.push(cur);
      cur = { header: line, bodyLines: [] };
    } else if (cur) {
      cur.bodyLines.push(line);
    }
  }

  if (cur) blocks.push(cur);

  const messages = [];

  for (const block of blocks) {
    const fullText = block.bodyLines.length > 0
      ? block.header + '\n' + block.bodyLines.join('\n')
      : block.header;

    const tplM = fullText.match(reTpl);
    if (tplM) {
      messages.push({
        time: tplM[1],
        sender: 'System',
        text: tplM[2].trim(),
        type: 'system',
      });
      continue;
    }

    const msgM = block.header.match(reMsg);
    if (msgM) {
      const sender = msgM[2].trim();
      const bodyText = [msgM[3], ...block.bodyLines].join('\n').trimEnd();
      const type = classifyTextMessage(sender, phone);

      messages.push({
        time: msgM[1],
        sender: sender || 'Bot',
        text: bodyText,
        type,
      });
    }
  }

  return { phone: digitsOnly(phone) || phone, messages, filename };
}

function parseJsonChat(filename, content) {
  const data = JSON.parse(content);
  const contact = data.Contact || {};
  const rawPhone = contact.Phone || contact.WAid || path.basename(filename, '.json').split('-')[0];
  const phone = digitsOnly(rawPhone) || String(rawPhone || 'unknown');

  const rows = Array.isArray(data.Messages) ? data.Messages : [];
  const messages = rows.map((row) => {
    const senderPhone = row.UserPhone || '';
    const senderName = row.UserName || row.UserPhone || 'System';
    const body = row.MessageBody || '';
    const mediaType = row.MediaType ? String(row.MediaType) : '';
    const mediaLink = row.MediaLink || row.MediaPath || '';

    let text = String(body || '').trim();
    if (!text && mediaType) {
      text = `[${mediaType}]${mediaLink ? ` ${mediaLink}` : ''}`;
    }

    if (!text) text = '(empty message)';

    const date = row.Date1 || row.Date2 || '';
    const time = row.Time || '00:00:00';

    return {
      time: `${date} ${time}`.trim(),
      sender: String(senderName || 'System').trim() || 'System',
      text,
      type: classifyJsonMessage(senderPhone, phone, text),
    };
  });

  return { phone, messages, filename };
}

function parseAnyChat(filename, content) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.json') return parseJsonChat(filename, content);
  return parseTxtChat(filename, content);
}

function parseMessageDate(time) {
  if (!time || typeof time !== 'string') return Number.MAX_SAFE_INTEGER;

  const m = time.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return Number.MAX_SAFE_INTEGER;

  let a = Number(m[1]);
  let b = Number(m[2]);
  const y = Number(m[3]);
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  const ss = Number(m[6] || '0');

  // Supports both MM/DD/YYYY and DD/MM/YYYY by picking the valid month/day pair.
  let month = a;
  let day = b;
  if (a > 12 && b <= 12) {
    month = b;
    day = a;
  }

  const dt = new Date(y, month - 1, day, hh, mm, ss);
  return Number.isNaN(dt.getTime()) ? Number.MAX_SAFE_INTEGER : dt.getTime();
}

function dedupeAndSortMessages(messages = []) {
  const seen = new Set();
  const output = [];

  for (const msg of messages) {
    const key = `${msg.time}__${msg.sender}__${msg.type}__${msg.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(msg);
  }

  output.sort((a, b) => parseMessageDate(a.time) - parseMessageDate(b.time));
  return output;
}

module.exports = {
  parseAnyChat,
  dedupeAndSortMessages,
};
