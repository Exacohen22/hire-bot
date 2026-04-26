require('dotenv').config();
const express = require('express');
const { WebClient } = require('@slack/web-api');

// ---------------------------------------------------------------------------
// Nominal-branded rocket GIF — generated at startup in pure JavaScript
// ---------------------------------------------------------------------------
function _lzwEncode(pixels, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eofCode   = clearCode + 1;
  let codeSize    = minCodeSize + 1;
  let nextCode    = eofCode + 1;
  const output = [];
  let buf = 0, bits = 0;
  const emit = (code) => {
    buf |= (code << bits); bits += codeSize;
    while (bits >= 8) { output.push(buf & 0xFF); buf >>= 8; bits -= 8; }
  };
  const table = new Map();
  let prefix = -1;
  emit(clearCode);
  for (let i = 0; i < pixels.length; i++) {
    const px = pixels[i];
    if (prefix === -1) { prefix = px; continue; }
    const key = (prefix << 8) | px;
    if (table.has(key)) {
      prefix = table.get(key);
    } else {
      emit(prefix);
      if (nextCode < 4096) {
        table.set(key, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        emit(clearCode); table.clear(); nextCode = eofCode + 1; codeSize = minCodeSize + 1;
      }
      prefix = px;
    }
  }
  if (prefix !== -1) emit(prefix);
  emit(eofCode);
  if (bits > 0) output.push(buf & 0xFF);
  return Buffer.from(output);
}

function _subBlocks(data) {
  const parts = []; let pos = 0;
  while (pos < data.length) {
    const len = Math.min(255, data.length - pos);
    parts.push(Buffer.from([len]));
    parts.push(data.slice(pos, pos + len));
    pos += len;
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

const _u16 = (n) => Buffer.from([n & 0xFF, (n >> 8) & 0xFF]);

const _GIF_W = 540, _GIF_H = 160;

// Base palette (system colors, indices 0-10)
const _BASE_COLORS = [
  [0,0,0],[65,155,85],[30,80,45],[10,30,18],[210,215,225],[160,165,180],
  [75,170,250],[255,200,40],[255,130,20],[255,255,255],[120,120,130]
];

// Extra colors extracted from the actual 🚀 emoji (indices 11-140)
const _EMOJI_EXTRA = [
  [174,163,165],[185,177,182],[112,154,184],[99,169,224],[136,198,242],
  [122,170,215],[46,98,153],[181,126,129],[171,99,103],[129,61,65],
  [108,25,29],[189,70,74],[154,153,160],[166,188,194],[172,204,214],
  [181,228,243],[183,150,154],[104,85,92],[50,59,65],[202,122,125],
  [23,79,134],[99,67,74],[132,40,42],[221,150,150],[228,240,237],
  [188,198,194],[73,112,142],[17,69,115],[164,82,87],[60,38,45],
  [58,7,8],[209,43,45],[222,207,204],[204,211,204],[76,94,103],
  [134,152,166],[159,30,33],[113,8,9],[141,3,3],[202,24,26],
  [222,228,220],[109,117,114],[73,84,82],[143,71,79],[148,182,211],
  [106,133,149],[134,90,98],[161,62,65],[190,98,99],[213,186,185],
  [128,136,132],[226,20,20],[210,13,13],[97,155,203],[68,137,191],
  [189,212,215],[94,102,100],[245,24,20],[248,7,5],[54,128,185],
  [221,6,1],[160,9,8],[74,41,64],[127,186,228],[197,197,157],
  [183,185,165],[244,63,24],[253,44,6],[235,26,0],[193,18,1],
  [49,60,94],[52,114,166],[123,147,148],[248,102,30],[252,103,13],
  [247,78,0],[221,63,0],[168,44,2],[94,35,36],[57,90,130],
  [86,142,188],[142,132,153],[110,96,123],[253,149,25],[242,115,0],
  [206,86,3],[125,74,47],[98,134,169],[128,160,187],[37,82,119],
  [22,52,78],[243,164,17],[254,208,17],[253,188,16],[223,130,5],
  [60,77,92],[114,141,167],[87,53,61],[174,43,42],[31,66,99],
  [169,146,35],[78,20,24],[178,25,30],[132,18,30],[232,167,40],
  [248,220,73],[249,241,89],[168,173,94],[194,49,14],[254,246,118],
  [232,220,104],[140,95,50],[112,26,9],[188,74,10],[251,242,147],
  [185,139,74],[139,55,15],[180,96,12],[155,33,16],[255,237,72],
  [229,208,143],[149,73,29],[196,143,35],[213,162,28],[254,218,44],
  [179,128,57],[212,177,39],[230,199,46],[228,202,67],[235,142,9]
];

// 28x28 pixel indices into the full palette (-1 = transparent)
// Rasterised from the actual 🚀 emoji via browser canvas
const _EMOJI_IDX = [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,12,24,5,13,14,15,16,17,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,18,19,20,21,22,23,24,25,26,16,17,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,27,19,28,29,3,21,30,4,51,4,13,31,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,36,18,32,29,3,0,33,34,35,35,36,37,38,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,12,24,39,40,3,0,41,42,43,35,44,23,45,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,25,5,46,39,47,48,49,50,34,51,44,11,52,53,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,54,55,16,56,56,57,58,59,60,51,36,11,61,53,29,-1,-1,-1,-1,-1,-1,-1,-1,62,63,63,63,72,10,64,65,65,107,24,66,51,51,36,11,61,67,29,-1,-1,-1,-1,-1,-1,-1,62,68,69,69,69,63,33,37,70,70,65,64,24,44,44,36,11,61,67,53,-1,-1,-1,-1,-1,-1,-1,-1,68,68,69,69,71,72,73,17,70,65,64,74,24,75,76,23,61,67,53,29,-1,-1,-1,-1,-1,-1,-1,77,77,78,78,79,80,48,81,82,65,64,74,5,23,83,61,10,67,53,29,-1,-1,-1,-1,-1,-1,-1,84,84,85,85,86,87,88,89,90,91,64,16,92,22,93,37,90,53,29,29,-1,-1,-1,-1,-1,-1,-1,-1,94,94,94,8,95,96,97,45,98,16,99,93,22,32,90,100,110,101,29,-1,-1,-1,-1,-1,-1,-1,-1,102,103,103,104,104,105,29,29,106,107,56,108,109,28,110,110,101,101,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,111,106,29,40,112,48,113,101,101,73,114,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,115,116,117,118,67,89,48,119,21,21,72,71,71,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,140,116,120,120,121,122,123,88,124,80,71,71,69,69,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,105,104,130,120,125,126,127,128,128,129,71,71,69,69,69,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,140,103,130,125,131,132,133,134,124,63,71,69,69,69,69,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,102,135,117,120,136,137,138,-1,85,78,69,69,69,71,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,140,104,135,135,139,135,102,-1,-1,95,78,69,69,71,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,140,102,104,140,140,105,-1,-1,-1,95,86,69,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,140,102,140,-1,-1,-1,-1,-1,-1,95,86,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];

const _COLORS = [..._BASE_COLORS, ..._EMOJI_EXTRA];
while (_COLORS.length < 256) _COLORS.push([0, 0, 0]);

function _buildPalette() {
  const buf = Buffer.alloc(256 * 3);
  for (let i = 0; i < 256; i++) {
    buf[i*3] = _COLORS[i][0]; buf[i*3+1] = _COLORS[i][1]; buf[i*3+2] = _COLORS[i][2];
  }
  return buf;
}

function _newFrame() { return new Uint8Array(_GIF_W * _GIF_H); }

function _px(frame, x, y, c) {
  if (x >= 0 && x < _GIF_W && y >= 0 && y < _GIF_H) frame[y * _GIF_W + x] = c;
}

function _fillRect(frame, x0, y0, x1, y1, c) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) _px(frame, x, y, c);
}

// Draw the actual 🚀 emoji pixels (28x28, centred on cx,cy)
function _drawRocket(frame, cx, cy) {
  const ox = cx - 14, oy = cy - 14;
  for (let i = 0; i < 784; i++) {
    if (_EMOJI_IDX[i] >= 0) {
      _px(frame, ox + (i % 28), oy + Math.floor(i / 28), _EMOJI_IDX[i]);
    }
  }
}

function _drawGrid(frame) {
  for (const fy of [0.25, 0.5, 0.75]) {
    const y = Math.round(_GIF_H * fy);
    for (let x = 0; x < _GIF_W; x++) if (!frame[y * _GIF_W + x]) frame[y * _GIF_W + x] = 3;
  }
  for (const fx of [0.25, 0.5, 0.75]) {
    const x = Math.round(_GIF_W * fx);
    for (let y = 0; y < _GIF_H; y++) if (!frame[y * _GIF_W + x]) frame[y * _GIF_W + x] = 3;
  }
}

function _drawTrail(frame, cx, cy) {
  const engineY = cy + 14;
  for (let dy = 0; dy < 70; dy++) {
    const ty = engineY + dy;
    if (ty < 0 || ty >= _GIF_H) continue;
    const fade = 1 - dy / 70;
    const c = fade > 0.55 ? 1 : fade > 0.25 ? 2 : 3;
    const spread = Math.min(Math.round(dy / 5), 4);
    for (let dx = -spread; dx <= spread; dx++) {
      const edgeFade = Math.abs(dx) >= spread && spread > 1;
      _px(frame, cx + dx, ty, edgeFade ? 3 : c);
    }
  }
}

const _FONT = {
  N: [0b1111111, 0b0100000, 0b0010000, 0b0001000, 0b1111111],
  O: [0b0111110, 0b1000001, 0b1000001, 0b1000001, 0b0111110],
  M: [0b1111111, 0b1000000, 0b0111110, 0b1000000, 0b1111111],
  I: [0b1000001, 0b1000001, 0b1111111, 0b1000001, 0b1000001],
  A: [0b0111111, 0b1001000, 0b1001000, 0b1001000, 0b0111111],
  L: [0b1111111, 0b0000001, 0b0000001, 0b0000001, 0b0000001],
};

function _drawText(frame, text, sx, sy, c) {
  let x = sx;
  for (const ch of text) {
    const cols = _FONT[ch];
    if (!cols) { x += 6; continue; }
    for (let ci = 0; ci < cols.length; ci++) {
      for (let row = 0; row < 7; row++) {
        if (cols[ci] & (1 << (6 - row))) _px(frame, x + ci, sy + row, c);
      }
    }
    x += 7;
  }
}

const _ROCKETS = [
  [Math.round(_GIF_W * 0.12) + 10, 0.00],
  [Math.round(_GIF_W * 0.35) + 10, 0.50],
  [Math.round(_GIF_W * 0.58) + 10, 0.25],
  [Math.round(_GIF_W * 0.79) + 10, 0.75],
];
const _TOTAL_FRAMES = 30;

function _buildGifFrame(f) {
  const frame = _newFrame();
  _drawGrid(frame);
  for (const [cx, stagger] of _ROCKETS) {
    const p = ((f / _TOTAL_FRAMES) + stagger) % 1.0;
    const cy = Math.round((_GIF_H + 60) - p * (_GIF_H + 130));
    _drawTrail(frame, cx, cy);
    if (cy > -30 && cy < _GIF_H + 30) _drawRocket(frame, cx, cy);
  }
  _drawText(frame, 'NOMINAL', _GIF_W - 58, _GIF_H - 12, 1);
  return frame;
}

function _generateHireGif() {
  const palette  = _buildPalette();
  const minCS    = 8;
  const delayCs  = 6;
  const parts = [];
  parts.push(Buffer.from('GIF89a'));
  parts.push(_u16(_GIF_W)); parts.push(_u16(_GIF_H));
  parts.push(Buffer.from([0xF7, 0x00, 0x00]));
  parts.push(palette);
  parts.push(Buffer.from([0x21, 0xFF, 0x0B,
    ...Buffer.from('NETSCAPE2.0'), 0x03, 0x01, 0x00, 0x00, 0x00]));
  for (let f = 0; f < _TOTAL_FRAMES; f++) {
    const pixels = _buildGifFrame(f);
    parts.push(Buffer.from([0x21, 0xF9, 0x04, 0x00,
      delayCs & 0xFF, (delayCs >> 8) & 0xFF, 0x00, 0x00]));
    parts.push(Buffer.from([0x2C]));
    parts.push(_u16(0)); parts.push(_u16(0));
    parts.push(_u16(_GIF_W)); parts.push(_u16(_GIF_H));
    parts.push(Buffer.from([0x00]));
    parts.push(Buffer.from([minCS]));
    parts.push(_subBlocks(_lzwEncode(pixels, minCS)));
  }
  parts.push(Buffer.from([0x3B]));
  return Buffer.concat(parts);
}

const HIRE_GIF = _generateHireGif();
console.log('[hire-bot] GIF generated:', Math.round(HIRE_GIF.length / 1024), 'KB');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL = process.env.SLACK_CHANNEL || '#new-hires';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const GEM_API_KEY = process.env.GEM_API_KEY;
const GEM_API_BASE = 'https://api.gem.com/ats/v0';
const POLL_INTERVAL_MS = 10 * 60 * 1000;

const announcedAppIds = new Set();
let lastCheckedAt = new Date();

async function gemFetch(path) {
  const res = await fetch(`${GEM_API_BASE}${path}`, {
    headers: { 'X-API-Key': GEM_API_KEY, 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gem API ${res.status} on ${path}: ${body}`);
  }
  return res.json();
}

async function pollGemForHires() {
  if (!GEM_API_KEY) return { skipped: true };
  const after = lastCheckedAt.toISOString();
  const newLastChecked = new Date();
  const apps = await gemFetch(
    `/applications?status=hired&last_activity_after=${encodeURIComponent(after)}&per_page=100`
  );
  let announced = 0;
  for (const app of apps) {
    if (announcedAppIds.has(app.id)) continue;
    let candidateName = 'Unknown Candidate';
    try {
      const candidate = await gemFetch(`/candidates/${app.candidate_id}`);
      candidateName = candidate.name
        || [candidate.first_name, candidate.last_name].filter(Boolean).join(' ')
        || candidateName;
    } catch (_) {}
    const job = (app.jobs || [])[0] || {};
    const role = job.name || job.title || 'Unknown Role';
    const location = job.location || job.office || 'TBD';
    const rec = app.recruiter || app.coordinator || {};
    const recruiterName = rec.name || rec.email || 'Unknown Recruiter';
    try {
      await slack.chat.postMessage({
        channel: CHANNEL,
        text: `🎉 New hire alert! Welcome ${candidateName} as ${role}!`,
        blocks: buildHireBlocks({ candidateName, role, location, recruiter: recruiterName })
      });
      announcedAppIds.add(app.id);
      announced++;
    } catch (err) {
      console.error(`[hire-bot] Slack error for ${candidateName}:`, err.message);
    }
  }
  lastCheckedAt = newLastChecked;
  return { announced, total: apps.length };
}

function buildHireBlocks({ candidateName, role, location, recruiter }) {
  return [
    {
      type: 'image',
      image_url: 'https://hire-bot-032u.onrender.com/hire-gif?v=5',
      alt_text: 'Rocket emojis launching'
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '🎉 *We have a new hire!* 🎉' }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Please join us in welcoming *${candidateName}* to the team! :wave:`
      }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*NAME*\n${candidateName}` },
        { type: 'mrkdwn', text: `*ROLE*\n${role}` },
        { type: 'mrkdwn', text: `*LOCATION*\n${location}` },
        { type: 'mrkdwn', text: `*RECRUITER*\n${recruiter}` }
      ]
    },
    { type: 'divider' }
  ];
}

app.post('/new-hire', async (req, res) => {
  const incomingSecret = req.headers['x-webhook-secret'] || req.body.secret;
  if (WEBHOOK_SECRET && incomingSecret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid or missing secret.' });
  }
  const { candidateName, role, location, recruiter, channel: channelOverride } = req.body;
  if (!candidateName || !role) {
    return res.status(400).json({ error: 'candidateName and role are required.' });
  }
  try {
    await slack.chat.postMessage({
      channel: channelOverride || CHANNEL,
      text: `🎉 New hire alert! Welcome ${candidateName} as ${role}!`,
      blocks: buildHireBlocks({ candidateName, role, location: location || 'TBD', recruiter: recruiter || 'Unknown' })
    });
    res.json({ ok: true, message: `Announcement posted to ${CHANNEL}!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/slash-hired', async (req, res) => {
  const incomingSecret = req.headers['x-webhook-secret'] || req.query.secret;
  if (WEBHOOK_SECRET && incomingSecret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid or missing secret.' });
  }
  const text = (req.body.text || '').trim();
  const parts = text.split(',').map(s => s.trim());
  const candidateName = parts[0] || 'Unknown Candidate';
  const role          = parts[1] || 'Unknown Role';
  const location      = parts[2] || 'TBD';
  const recruiter     = parts[3] || 'Unknown Recruiter';
  try {
    await slack.chat.postMessage({
      channel: CHANNEL,
      text: `🎉 New hire alert! Welcome ${candidateName} as ${role}!`,
      blocks: buildHireBlocks({ candidateName, role, location, recruiter })
    });
    res.json({ response_type: 'in_channel', text: `Announced ${candidateName} in ${CHANNEL}!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/gem-webhook', async (req, res) => {
  const incomingSecret = req.headers['x-webhook-secret'] || req.query.secret;
  if (WEBHOOK_SECRET && incomingSecret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid or missing secret.' });
  }
  const { candidate, job, stage, recruiter } = req.body;
  const stageName = stage?.name || '';
  if (!stageName.toLowerCase().includes('hired')) {
    return res.json({ ok: true, message: `Stage "${stageName}" ignored.` });
  }
  const candidateName = candidate?.name
    || [candidate?.first_name, candidate?.last_name].filter(Boolean).join(' ')
    || 'Unknown Candidate';
  const role          = job?.name || 'Unknown Role';
  const location      = job?.office || job?.location || 'TBD';
  const recruiterName = recruiter?.name || recruiter?.email || 'Unknown Recruiter';
  try {
    await slack.chat.postMessage({
      channel: CHANNEL,
      text: `🎉 New hire alert! Welcome ${candidateName} as ${role}!`,
      blocks: buildHireBlocks({ candidateName, role, location, recruiter: recruiterName })
    });
    res.json({ ok: true, message: `Announcement posted to ${CHANNEL}!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/poll-gem', async (req, res) => {
  const incomingSecret = req.headers['x-webhook-secret'] || req.query.secret;
  if (WEBHOOK_SECRET && incomingSecret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid or missing secret.' });
  }
  try {
    const result = await pollGemForHires();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/test', async (req, res) => {
  const { candidateName = 'Rory Milne', role = 'Account Executive', location = 'UK', recruiter = 'Alex' } = req.body;
  try {
    await slack.chat.postMessage({
      channel: '#x-test',
      text: `🎉 New hire alert! Welcome ${candidateName} as ${role}!`,
      blocks: buildHireBlocks({ candidateName, role, location, recruiter })
    });
    res.json({ ok: true, message: 'Test posted to #x-test' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/hire-gif', (_req, res) => {
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(HIRE_GIF);
});

app.get('/', (_req, res) =>
  res.json({ status: 'ok', service: 'hire-bot', channel: CHANNEL })
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[hire-bot] Running on port ${PORT}`);
  console.log(`[hire-bot] Announcing to: ${CHANNEL}`);
  if (GEM_API_KEY) {
    setInterval(pollGemForHires, POLL_INTERVAL_MS);
    console.log(`[hire-bot] Gem ATS polling enabled`);
  } else {
    console.log(`[hire-bot] GEM_API_KEY not set — Gem polling disabled`);
  }
});
