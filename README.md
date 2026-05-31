# Scrum

A lightweight sprint planning tool for a small engineering team.

## Setup

```bash
npm install
npm run migrate
npm run create-user -- --admin
npm run dev
```

The app stores SQLite data in `data/scrum.db`.

## Discord notifications

Notifications are delivered to a single Discord **channel webhook** (no bot
changes required). In Discord: Channel → Edit → Integrations → Webhooks → New
Webhook, then copy the URL.

- `DISCORD_WEBHOOK_URL` — required to enable notifications. Disabled if unset.
- `DISCORD_WEBHOOK_USERNAME` — optional display name (default `Bob`).
- `DISCORD_WEBHOOK_AVATAR_URL` — optional avatar URL.
- `APP_BASE_URL` — optional. Public base URL used to build clickable ticket
  links (e.g. `https://scrum.example.com`).

Ticket events (created, assigned) post automatically. Assignees are pinged when
their `discord_id` is set on the Team page.

## GitHub webhook listener

Real-time GitHub events are received at `POST /api/github/webhook` (no polling).
In the repo: Settings → Webhooks → Add webhook.

- Payload URL: `<APP_BASE_URL>/api/github/webhook`
- Content type: `application/json`
- Secret: the same value as `GITHUB_WEBHOOK_SECRET`
- Events: Pushes, Pull requests, Workflow runs

`GITHUB_WEBHOOK_SECRET` is required to accept webhooks — each delivery's
`X-Hub-Signature-256` is verified against it, and mismatches are rejected with
401. Notified events: pushes (with commits), pull requests opened, and **failed**
workflow runs.

## Container

```bash
docker compose up --build
```
