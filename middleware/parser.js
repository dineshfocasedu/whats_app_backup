const reTimestamp = /^\[\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}\]/;
const reMsg = /^\[(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2})\] ([^:]*): ([\s\S]*)$/;
const reTpl = /^\[(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2})\] (Template [\s\S]+?was sent\.)\s*$/;

function classifyMessage(sender, phone) {
  if (sender === '') return 'outgoing';
  if (/[a-zA-Z]/.test(sender)) return 'outgoing';
  const cs = sender.replace(/\D/g, '');
  const cp = phone.replace(/\D/g, '');
  if (cs && cp && cs === cp) return 'incoming';
  return 'incoming';
}

function parseChat(filename, content) {
  const match = filename.match(/^(\d+)-/);
  const phone = match ? match[1] : filename.replace('.txt', '');

  const lines = content.split('\n');
  const blocks = [];
  let cur = null;

  for (const line of lines) {
    if (reTimestamp.test(line)) {
      if (cur) blocks.push(cur);
      cur = { header: line, bodyLines: [] };
    } else {
      if (cur) cur.bodyLines.push(line);
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
      const type = classifyMessage(sender, phone);
      messages.push({
        time: msgM[1],
        sender: sender || 'Bot',
        text: bodyText,
        type,
      });
    }
  }

  return { phone, messages };
}

module.exports = { parseChat };
