# hire-bot

A Slack bot that announces new hires with confetti to your `#new-hires` channel. Supports two trigger methods:

- **Webhook** — call `POST /new-hire` from your ATS, HRIS, or any script
- **Slash command** — recruiter types `/hired Jane Smith | Senior Engineer | New York` in Slack

---

## What it posts

```
🎉 🎊 We have a new hire! 🎊 🎉
Please join us in welcoming Jane Smith to the team! 👋

👤 Name          💼 Role
Jane Smith       Senior Engineer

📍 Location      🤝 Recruiter
New York         Alex
```

---

## Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Name it `Hire Bot`, pick your workspace

### 2. Add Bot Scopes

Under **OAuth & Permissions → Scopes → Bot Token Scopes**, add:
- `chat:write`
- `chat:write.public`

### 3. Install the App

- Click **Install to Workspace** and authorize it
- Copy the **Bot User OAuth Token** (`xoxb-...`)

### 4. Configure the Bot

```bash
cp .env.example .env
```

Fill in your values in `.env`:

```
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_CHANNEL=#new-hires
WEBHOOK_SECRET=pick-a-secret-string
```

### 5. Run the Bot

```bash
npm install
npm start
```

---

## Connecting Gem ATS

The bot has a dedicated `/gem-webhook` endpoint that understands Gem's stage-change payload format.

### Steps in Gem

1. Go to **Settings → Integrations → Webhooks**
2. Click **Add Webhook**
3. Set the URL to: `https://your-deployed-domain.com/gem-webhook`
4. Choose event type: **Stage Change**
5. Add a filter so it only fires when the stage is **Hired**
6. Optionally add your `WEBHOOK_SECRET` as a custom header: `X-Webhook-Secret: your-secret`
7. Save and test with a dummy candidate

---

## Manual Webhook

```bash
curl -X POST https://your-domain.com/new-hire \
  -H "Content-Type: application/json" \
  -d '{"candidateName":"Jane Smith","role":"Senior Engineer","location":"New York","recruiter":"Alex","secret":"your-webhook-secret"}'
```

---

## Deploying

Deploy to Railway, Render, Fly.io, or Heroku. Set the environment variables from `.env.example` in the platform dashboard.

- **Render**: Connect this GitHub repo, set env vars, done.

---

## Security

Always set a strong `WEBHOOK_SECRET` in production to prevent unauthorized announcements.
