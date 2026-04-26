require('dotenv').config();
const express = require('express');
const { WebClient } = require('@slack/web-api');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const CHANNEL = process.env.SLACK_CHANNEL || '#new-hires';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// ---------------------------------------------------------------------------
// Message builder - Block Kit with confetti
// ---------------------------------------------------------------------------
function buildHireBlocks({ candidateName, role, location, recruiter }) {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':tada: :confetti_ball: *We have a new hire!* :confetti_ball: :tada:'
      }
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
        { type: 'mrkdwn', text: `*:bust_in_silhouette: Name*\n${candidateName}` },
        { type: 'mrkdwn', text: `*:briefcase: Role*\n${role}` },
        { type: 'mrkdwn', text: `*:round_pushpin: Location*\n${location}` },
        { type: 'mrkdwn', text: `*:handshake: Recruiter*\n${recruiter}` }
      ]
    },
    {
      type: 'divider'
    }
  ];
}

// ---------------------------------------------------------------------------
// POST /new-hire  -  Webhook for ATS / HRIS integration
// ---------------------------------------------------------------------------
app.post('/new-hire', async (req, res) => {
  const { candidateName, role, location, recruiter, secret } = req.body;

  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid or missing secret.' });
  }

  const missing = ['candidateName', 'role', 'location', 'recruiter'].filter(
    (f) => !req.body[f]
  );
  if (missing.length) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  try {
    await slack.chat.postMessage({
      channel: CHANNEL,
      text: `:tada: New hire alert! Welcome ${candidateName} as ${role}!`,
      blocks: buildHireBlocks({ candidateName, role, location, recruiter })
    });

    console.log(`[hire-bot] Announced ${candidateName} (${role}) via webhook`);
    res.json({ ok: true, message: `Announcement posted to ${CHANNEL}!` });
  } catch (err) {
    console.error('[hire-bot] Slack error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /slash-hired  -  Slack slash command /hired
// ---------------------------------------------------------------------------
app.post('/slash-hired', async (req, res) => {
  const { text = '', user_name, user_id } = req.body;

  const parts = text.split('|').map((s) => s.trim());
  if (parts.length < 3 || parts.some((p) => !p)) {
    return res.json({
      response_type: 'ephemeral',
      text: ':warning: *Incorrect format.* Use:\n`/hired [Candidate Name] | [Role] | [Location]`'
    });
  }

  const [candidateName, role, location] = parts;
  const recruiter = user_name || `<@${user_id}>`;

  res.json({
    response_type: 'ephemeral',
    text: `:confetti_ball: Posting announcement for *${candidateName}*...`
  });

  try {
    await slack.chat.postMessage({
      channel: CHANNEL,
      text: `:tada: New hire alert! Welcome ${candidateName} as ${role}!`,
      blocks: buildHireBlocks({ candidateName, role, location, recruiter })
    });
    console.log(`[hire-bot] Announced ${candidateName} (${role}) via slash command by ${recruiter}`);
  } catch (err) {
    console.error('[hire-bot] Slack error:', err.message);
  }
});

// ---------------------------------------------------------------------------
// POST /gem-webhook  -  Gem ATS "Stage Change" webhook
// ---------------------------------------------------------------------------
app.post('/gem-webhook', async (req, res) => {
  const incomingSecret =
    req.headers['x-webhook-secret'] || req.query.secret;
  if (WEBHOOK_SECRET && incomingSecret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid or missing secret.' });
  }

  const { event, candidate, job, stage, recruiter } = req.body;

  const stageName = stage?.name || '';
  if (!stageName.toLowerCase().includes('hired')) {
    return res.json({ ok: true, message: `Stage "${stageName}" ignored - not a hire event.` });
  }

  const candidateName = candidate?.name
    || [candidate?.first_name, candidate?.last_name].filter(Boolean).join(' ')
    || 'Unknown Candidate';
  const role      = job?.name || 'Unknown Role';
  const location  = job?.office || job?.location || 'TBD';
  const recruiterName = recruiter?.name || recruiter?.email || 'Unknown Recruiter';

  try {
    await slack.chat.postMessage({
      channel: CHANNEL,
      text: `:tada: New hire alert! Welcome ${candidateName} as ${role}!`,
      blocks: buildHireBlocks({
        candidateName,
        role,
        location,
        recruiter: recruiterName
      })
    });

    console.log(`[hire-bot] Announced ${candidateName} (${role}) via Gem webhook`);
    res.json({ ok: true, message: `Announcement posted to ${CHANNEL}!` });
  } catch (err) {
    console.error('[hire-bot] Slack error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/', (_req, res) =>
  res.json({ status: 'ok', service: 'hire-bot', channel: CHANNEL })
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[hire-bot] Running on port ${PORT}`);
  console.log(`[hire-bot] Announcing to: ${CHANNEL}`);
  console.log(`[hire-bot] Webhook endpoint:       POST /new-hire`);
  console.log(`[hire-bot] Gem webhook endpoint:   POST /gem-webhook`);
  console.log(`[hire-bot] Slash command endpoint: POST /slash-hired`);
});
