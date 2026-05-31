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

All events post to the single channel webhook; the users an event concerns are
`@`-pinged (when their `discord_id` is set on the Team page), and the person who
triggered the event is never pinged for their own action. Events:

- **Ticket created** — pings the assignee.
- **Ticket assigned / reassigned** — pings the new assignee; the previous
  assignee is told they were dropped.
- **Comment added** — pings the assignee, watchers, and any `@mentioned` users.
- **Status changed** — pings the assignee and watchers.
- **Blocker resolved** — when a ticket's last open blocker is marked Done, its
  assignee and watchers are pinged that it's ready to start.
- **Due date reminders** — daily, the assignee is pinged when a ticket is due
  tomorrow, due today, or overdue (see the cron below).

## Due date reminder cron

Due reminders are sent by `GET /api/cron/due-reminders`, authenticated with a
shared secret. Set `CRON_SECRET` and call the endpoint once a day, e.g. a system
crontab entry on the server:

```
0 9 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/due-reminders
```

Reminders are de-duplicated, so calling it more than once a day is safe — each
ticket is reminded once per due date (and at most once a day while overdue).

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
