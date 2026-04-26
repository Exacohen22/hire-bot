require('dotenv').config();
const express = require('express');
const { WebClient } = require('@slack/web-api');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Confi
// ---------------------------------------------------------------------------
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL = process.env.SLACK_CHANNEL || '#new-hires';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const GEM_API_KEY = process.env.GEM_API_KEY;
const GEM_API_BASE = 'https://api.gem.com/ats/v0';
const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------------------
// Gem ATS polling state (in-memory)
// ---------------------------------------------------------------------------
const announcedAppIds = new Set();
let lastCheckedAt = new Date();

async function gemFetch(path) {
  const res = await fetch(`${GEM_API_BASE}${path}`, {
    headers: { 'X-API-Key': GEM_API_KEY, 'Content-Type': 'application/json' }  });
  if (!res.ok) throw new Error(`Gem API ${res.status}: ${await res.text()}`);
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
        text: `:tada: New hire alert! Welcome ${candidateName} as ${role}!`,
        blocks: buildHireBlocks({ candidateName, role, location, recruiter: recruiterName })
      });
      announcedAppIds.add(app.id);
      announced++;
      console.log(`[hire-bot] Announced ${candidateName} (${role}) via Gem poll`);
    } catch (err) {
      console.error(`[hire-bot] Slack error for ${candidateName}:`, err.message);
    }
  }

  lastCheckedAt = newLastChecked;
  console.log(`[hire-bot] Gem poll complete — ${announced} new hire(s) announced.`);
  return { announced, total: apps.length };
}

// ---------------------------------------------------------------------------
// Message builder — Block Kit with confetti
// ---------------------------------------------------------------------------
function buildHireBlocks({ candidateName, role, location, recruiter }) {
  return [
    {
            type: 'image',
            image_url: 'https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif',
            alt_text: 'confetti'
    },
    { type: 'section', text: { type: 'mrkdwn', text: ':tada: :confetti_ball: *We have a new hire!* :confetti_ball: :tada:' } },
    { type: 'section', text: { type: 'mrkdwn', text: `Please join us in welcoming *${candidateName}* to the team! :wave:` } },
    { type: 'section', fields: [
      { type: 'mrkdwn', text: `*:bust_in_silhouette: Name*\n${candidateName}` },
      { type: 'mrkdwn', text: `*:briefcase: Role*\n${role}` },
      { type: 'mrkdwn', text: `*:round_pushpin: Location*\n${location}` },
      { type: 'mrkdwn', text: `*:handshake: Recruiter*\n${recruiter}` }
    ]},
    { type: 'divider' }
  ];
}

// POST /new-hire
app.post('/new-hire', async (req, res) => {
  const { candidateName, role, location, recruiter, secret } = req.body;
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Invalid or missing secret.' });
  const missing = ['candidateName', 'role', 'location', 'recruiter'].filter(f => !req.body[f]);
  if (missing.length) return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  try {
    await slack.chat.postMessage({ channel: CHANNEL, text: `:tada: New hire alert! Welcome ${candidateName} as ${role}!`, blocks: buildHireBlocks({ candidateName, role, location, recruiter }) });
    console.log(`[hire-bot] Announced ${candidateName} (${role}) via webhook`);
    res.json({ ok: true, message: `Announcement posted to ${CHANNEL}!` });
  } catch (err) { console.error('[hire-bot] Slack error:', err.message); res.status(500).json({ error: err.message }); }
});

// POST /slash-hired
app.post('/slash-hired', async (req, res) => {
  const { text = '', user_name, user_id } = req.body;
  const parts = text.split('|').map(s => s.trim());
  if (parts.length < 3 || parts.some(p => !p)) return res.json({ response_type: 'ephemeral', text: ':warning: Use: `/hired Name | Role | Location`' });
  const [candidateName, role, location] = parts;
  const recruiter = user_name || `<@${user_id}>`;
  res.json({ response_type: 'ephemeral', text: `:confetti_ball: Posting announcement for *${candidateName}*...` });
  try {
    await slack.chat.postMessage({ channel: CHANNEL, text: `:tada: New hire alert! Welcome ${candidateName} as ${role}!`, blocks: buildHireBlocks({ candidateName, role, location, recruiter }) });
    console.log(`[hire-bot] Announced ${candidateName} (${role}) via slash command by ${recruiter}`);
  } catch (err) { console.error('[hire-bot] Slack error:', err.message); }
});

// POST /gem-webhook
app.post('/gem-webhook', async (req, res) => {
  const incomingSecret = req.headers['x-webhook-secret'] || req.query.secret;
  if (WEBHOOK_SECRET && incomingSecret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Invalid or missing secret.' });
  const { candidate, job, stage, recruiter } = req.body;
  const stageName = stage?.name || '';
  if (!stageName.toLowerCase().includes('hired')) return res.json({ ok: true, message: `Stage "${stageName}" ignored.` });
  const candidateName = candidate?.name || [candidate?.first_name, candidate?.last_name].filter(Boolean).join(' ') || 'Unknown Candidate';
  const role = job?.name || 'Unknown Role';
  const location = job?.office || job?.location || 'TBD';
  const recruiterName = recruiter?.name || recruiter?.email || 'Unknown Recruiter';
  try {
    await slack.chat.postMessage({ channel: CHANNEL, text: `:tada: New hire alert! Welcome ${candidateName} as ${role}!`, blocks: buildHireBlocks({ candidateName, role, location, recruiter: recruiterName }) });
    console.log(`[hire-bot] Announced ${candidateName} (${role}) via Gem webhook`);
    res.json({ ok: true, message: `Announcement posted to ${CHANNEL}!` });
  } catch (err) { console.error('[hire-bot] Slack error:', err.message); res.status(500).json({ error: err.message }); }
});

// GET /poll-gem
app.get('/poll-gem', async (req, res) => {
  const incomingSecret = req.headers['x-webhook-secret'] || req.query.secret;
  if (WEBHOOK_SECRET && incomingSecret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Invalid or missing secret.' });
  try { const result = await pollGemForHires(); res.json({ ok: true, ...result }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Health check
app.get('/', (_req, res) => res.json({ status: 'ok', service: 'hire-bot', channel: CHANNEL }));

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[hire-bot] Running on port ${PORT}`);
  console.log(`[hire-bot] Announcing to: ${CHANNEL}`);
  console.log(`[hire-bot] Webhook endpoint:       POST /new-hire`);
  console.log(`[hire-bot] Gem webhook endpoint:   POST /gem-webhook`);
  console.log(`[hire-bot] Slash command endpoint: POST /slash-hired`);
  console.log(`[hire-bot] Gem poll endpoint:      GET  /poll-gem`);
  if (GEM_API_KEY) {
    setInterval(pollGemForHires, POLL_INTERVAL_MS);
    console.log(`[hire-bot] Gem ATS polling enabled (every ${POLL_INTERVAL_MS / 60000} min)`);
  } else {
    console.log(`[hire-bot] GEM_API_KEY not set — Gem polling disabled`);
  }
});
