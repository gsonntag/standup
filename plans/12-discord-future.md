# Phase 12 (Future): Discord Integration

> [!NOTE]
> This phase is **not part of the MVP**. It is documented here so it can be picked up later without re-discovery. Implement only after Phases 1–11 are complete and stable.

## Goal

Add a Discord bot that allows the team to create tickets, view sprint status, and receive notifications — all without leaving Discord. The bot runs as a **separate process** alongside the Next.js app, sharing the same SQLite database.

---

## Prerequisites

1. All MVP phases (1–11) complete and working
2. A Discord server you control
3. A Discord bot application created at https://discord.com/developers/applications

## Discord App Setup

### Step 1: Create the application

1. Go to https://discord.com/developers/applications
2. Click "New Application", name it `scrum-bot`
3. Go to "Bot" tab → click "Reset Token" → **copy the token** (you'll need it)
4. Under "Privileged Gateway Intents", enable **Message Content Intent**
5. Go to "OAuth2" → "URL Generator":
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`
6. Copy the generated URL and open it to invite the bot to your server

### Step 2: Environment variables

Create/update `.env.local` in the project root:

```env
DISCORD_BOT_TOKEN=your-bot-token-here
DISCORD_CHANNEL_ID=your-notifications-channel-id
```

To get the channel ID: enable Developer Mode in Discord (User Settings → Advanced → Developer Mode), then right-click the channel → "Copy Channel ID".

## Dependencies

```bash
npm install discord.js
```

## Architecture

```
┌──────────────┐      ┌──────────────┐
│  Next.js App │      │  Discord Bot │
│  (port 3000) │      │  (bot/)      │
│              │      │              │
│  Web UI      │      │  Slash cmds  │
│  API routes  │      │  Notifier    │
│              │      │              │
└──────┬───────┘      └──────┬───────┘
       │                     │
       └──────────┬──────────┘
                  │
           ┌──────┴──────┐
           │  SQLite DB  │
           │  data/      │
           │  scrum.db   │
           └─────────────┘
```

Both processes read/write the same SQLite database. This works because:
- better-sqlite3 uses synchronous operations
- SQLite WAL mode allows concurrent readers
- Write contention is minimal (small team, low traffic)

The bot does **not** call the Next.js API — it reads/writes the database directly using the same `db.js` module and query patterns from Phase 4.

## Project Structure

```
bot/
├── index.mjs              # Entry point — starts the bot
├── commands/
│   ├── ticket-create.mjs  # /ticket create
│   ├── ticket-view.mjs    # /ticket view
│   ├── ticket-assign.mjs  # /ticket assign
│   ├── ticket-list.mjs    # /ticket list
│   ├── sprint-status.mjs  # /sprint status
│   └── link.mjs           # /link (map Discord user to scrum user)
├── notifier.mjs           # Polls for changes and posts to channel
└── deploy-commands.mjs    # One-time script to register slash commands
```

## Database Addition

Add a new table for Discord-to-scrum user mapping. Add this to `scripts/migrate.mjs`:

```sql
CREATE TABLE IF NOT EXISTS discord_mappings (
  discord_id TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
);
```

This maps a Discord user ID (snowflake) to a scrum user ID. Required for:
- Knowing who created a ticket from Discord
- Assigning tickets via Discord commands

---

## Bot Entry Point: `bot/index.mjs`

```js
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { setupCommands } from './commands/index.mjs';
import { startNotifier } from './notifier.mjs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
setupCommands(client);

client.on('ready', () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  startNotifier(client);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Command error:', error);
    const msg = { content: 'Something went wrong.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
```

Run with: `node bot/index.mjs`

Add a convenience script to `package.json`:
```json
{
  "scripts": {
    "bot": "node bot/index.mjs",
    "deploy-commands": "node bot/deploy-commands.mjs"
  }
}
```

---

## Slash Commands

### Helper: Resolve Discord user to scrum user

Used by every command to identify who's calling:

```js
// bot/utils.mjs
import { getDb } from '../src/lib/db.js';

export function getscrumUser(discordId) {
  const db = getDb();
  const mapping = db.prepare(`
    SELECT u.id, u.username, u.role
    FROM discord_mappings dm
    JOIN users u ON u.id = dm.user_id
    WHERE dm.discord_id = ?
  `).get(discordId);
  return mapping || null;
}

export function requireLinked(interaction) {
  const user = getscrumUser(interaction.user.id);
  if (!user) {
    interaction.reply({
      content: 'Your Discord account is not linked. Use `/link <username>` first.',
      ephemeral: true,
    });
    return null;
  }
  return user;
}
```

---

### Command: `/link <username>`

Maps the Discord user to a scrum username.

**Options**:
| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `username` | STRING | Yes | Your scrum username |

**Behavior**:
1. Look up the username in the `users` table
2. If not found → reply "User not found"
3. If found → insert/replace into `discord_mappings`
4. Reply "Linked your Discord account to scrum user `<username>`"

```js
// bot/commands/link.mjs
import { SlashCommandBuilder } from 'discord.js';
import { getDb } from '../../src/lib/db.js';

export const data = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Link your Discord account to your scrum username')
  .addStringOption(opt =>
    opt.setName('username').setDescription('Your scrum username').setRequired(true)
  );

export async function execute(interaction) {
  const username = interaction.options.getString('username').toLowerCase();
  const db = getDb();

  const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username);
  if (!user) {
    return interaction.reply({ content: `User "${username}" not found.`, ephemeral: true });
  }

  db.prepare(`
    INSERT INTO discord_mappings (discord_id, user_id) VALUES (?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET user_id = excluded.user_id
  `).run(interaction.user.id, user.id);

  return interaction.reply({
    content: `✓ Linked your Discord account to **${user.username}**.`,
    ephemeral: true,
  });
}
```

---

### Command: `/ticket create <title>`

Creates a new ticket in the backlog.

**Options**:
| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `title` | STRING | Yes | Ticket title |
| `priority` | STRING | No | low/medium/high/urgent. Default: medium |

**Behavior**:
1. Resolve Discord user → scrum user (require linked)
2. Create ticket with `status: 'backlog'`, `sprint_id: null`, `creator_id: scrumUser.id`
3. Pre-fill description with `TICKET_TEMPLATE`
4. Reply with an embed showing the created ticket

**Embed format**:
```
┌─────────────────────────────┐
│ ✅ Ticket #7 Created        │
│                             │
│ Title: Fix login bug        │
│ Priority: high              │
│ Status: backlog             │
│ Created by: gavin           │
│                             │
│ View on web: http://...     │
└─────────────────────────────┘
```

Use Discord.js `EmbedBuilder`:
```js
import { EmbedBuilder } from 'discord.js';

const embed = new EmbedBuilder()
  .setTitle(`Ticket #${ticket.number} Created`)
  .setColor(0x008800)
  .addFields(
    { name: 'Title', value: ticket.title },
    { name: 'Priority', value: ticket.priority, inline: true },
    { name: 'Status', value: 'backlog', inline: true },
  )
  .setFooter({ text: `Created by ${scrumUser.username}` })
  .setTimestamp();
```

---

### Command: `/ticket view <number>`

Shows ticket details in an embed.

**Options**:
| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `number` | INTEGER | Yes | Ticket number (e.g., 7) |

**Behavior**:
1. Query ticket by number (not ID)
2. If not found → "Ticket #N not found"
3. Reply with embed showing: title, status, priority, assignee, labels, blocker count, comment count

**Embed fields**:
```
Title:       Fix login bug
Status:      In Progress
Priority:    HIGH
Assignee:    gavin
Labels:      bug, frontend
Blocked by:  2 tickets (1 resolved)
Comments:    3
```

---

### Command: `/ticket assign <number> <user>`

Assigns a user to a ticket.

**Options**:
| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `number` | INTEGER | Yes | Ticket number |
| `user` | STRING | Yes | Scrum username to assign |

**Behavior**:
1. Require linked account
2. Find ticket by number
3. Find user by username
4. Update ticket: `UPDATE tickets SET assignee_id = ?, updated_at = datetime('now') WHERE id = ?`
5. Reply: "Assigned **#7 Fix login bug** to **gavin**"

---

### Command: `/ticket list`

Lists tickets in the current active sprint.

**Options**: None.

**Behavior**:
1. Find the active sprint
2. If none → "No active sprint"
3. Query all tickets in the sprint, ordered by status then priority
4. Reply with a formatted list

**Format** (plain text, not embed — embeds have field limits):
```
📋 Sprint 1 (Jun 1 → Jun 14) — 5/8 done

TO DO
  #3  Fix login bug         HIGH   gavin
  #5  Add search             MED   -

IN PROGRESS
  #7  Update API docs        LOW   alice

IN REVIEW
  #2  Refactor auth          MED   bob

DONE ✓
  #1  Setup project          MED   gavin
  #4  Create DB schema       HIGH  gavin
  #6  Write tests            LOW   alice
  #8  Fix typo               LOW   carol
```

If the list is too long, truncate and note "and N more...".

---

### Command: `/sprint status`

Shows current sprint progress.

**Options**: None.

**Behavior**:
1. Find the active sprint
2. If none → "No active sprint"
3. Reply with embed:

```
Sprint 1
Jun 1 → Jun 14 (day 8 of 14)

Progress: 5/8 tickets done (62%)

By status:
  To Do:       1
  In Progress: 1
  In Review:   1
  Done:        5
```

Calculate "day N of M" from today's date relative to start/end.

---

## Command Registration: `bot/deploy-commands.mjs`

This is a **one-time setup script** that registers all slash commands with Discord's API.

```js
import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Import all command data
import { data as linkData } from './commands/link.mjs';
import { data as ticketCreateData } from './commands/ticket-create.mjs';
import { data as ticketViewData } from './commands/ticket-view.mjs';
import { data as ticketAssignData } from './commands/ticket-assign.mjs';
import { data as ticketListData } from './commands/ticket-list.mjs';
import { data as sprintStatusData } from './commands/sprint-status.mjs';

const commands = [
  linkData, ticketCreateData, ticketViewData,
  ticketAssignData, ticketListData, sprintStatusData,
].map(c => c.toJSON());

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);

async function deploy() {
  console.log(`Registering ${commands.length} slash commands...`);

  // Register for a specific guild (instant) during development.
  // For production, use Routes.applicationCommands(clientId) instead (takes up to 1 hour).
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.DISCORD_CLIENT_ID,
      process.env.DISCORD_GUILD_ID
    ),
    { body: commands }
  );

  console.log('Commands registered.');
}

deploy().catch(console.error);
```

Add to `.env.local`:
```env
DISCORD_CLIENT_ID=your-app-client-id
DISCORD_GUILD_ID=your-server-id
```

Run once: `npm run deploy-commands`

---

## Notifications: `bot/notifier.mjs`

The notifier **polls the database** for changes and posts messages to a configured channel.

### What triggers notifications

| Event | Message |
|-------|---------|
| Ticket created | "**gavin** created ticket **#7 Fix login bug** [backlog]" |
| Ticket moved to Done | "✅ **#7 Fix login bug** completed by **gavin**" + list of newly unblocked tickets |
| Ticket assigned | "**#7 Fix login bug** assigned to **alice**" |

### Implementation: Polling approach

The simplest approach is to poll the database every 10 seconds and compare state. Use a `last_checked` timestamp:

```js
import { getDb } from '../src/lib/db.js';

let lastChecked = new Date().toISOString();

export function startNotifier(client) {
  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (!channelId) {
    console.log('DISCORD_CHANNEL_ID not set, notifications disabled.');
    return;
  }

  setInterval(async () => {
    const db = getDb();
    const channel = await client.channels.fetch(channelId);
    if (!channel) return;

    // Check for new tickets
    const newTickets = db.prepare(`
      SELECT t.*, u.username as creator_username
      FROM tickets t
      JOIN users u ON u.id = t.creator_id
      WHERE t.created_at > ?
      ORDER BY t.created_at ASC
    `).all(lastChecked);

    for (const ticket of newTickets) {
      await channel.send(
        `📝 **${ticket.creator_username}** created **#${ticket.number} ${ticket.title}** [${ticket.status}]`
      );
    }

    // Check for tickets that just moved to "done"
    // This requires tracking previous state. Simplest: add a `notified_done` column,
    // or use a separate tracking table.
    const doneTickets = db.prepare(`
      SELECT t.*, u.username as assignee_username
      FROM tickets t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.status = 'done' AND t.updated_at > ?
      ORDER BY t.updated_at ASC
    `).all(lastChecked);

    for (const ticket of doneTickets) {
      const assignee = ticket.assignee_username || 'unassigned';

      // Check what this ticket unblocks
      const unblocked = db.prepare(`
        SELECT t.number, t.title
        FROM ticket_dependencies td
        JOIN tickets t ON t.id = td.ticket_id
        WHERE td.depends_on_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM ticket_dependencies td2
          JOIN tickets blocker ON blocker.id = td2.depends_on_id
          WHERE td2.ticket_id = td.ticket_id
          AND blocker.status != 'done'
          AND blocker.id != ?
        )
      `).all(ticket.id, ticket.id);

      let msg = `✅ **#${ticket.number} ${ticket.title}** completed (${assignee})`;
      if (unblocked.length > 0) {
        msg += '\n🔓 Unblocked: ' + unblocked.map(u => `#${u.number} ${u.title}`).join(', ');
      }
      await channel.send(msg);
    }

    lastChecked = new Date().toISOString();
  }, 10_000); // Poll every 10 seconds
}
```

> [!WARNING]
> The "done" notification has a subtle issue: if a ticket is moved to "done" and then back, it might re-notify on the next transition. A more robust solution would add a `notified_done_at` column to the tickets table or a separate `notification_log` table. For a 6-person team, the polling approach is good enough to start with.

---

## Running Both Processes

During development, run both in separate terminals:

```bash
# Terminal 1: Web app
npm run dev

# Terminal 2: Discord bot
npm run bot
```

For production, use a process manager like `pm2` or a simple shell script:

```bash
#!/bin/bash
# start.sh
npm run build &
node bot/index.mjs &
wait
```

---

## Environment Variables Summary

| Variable | Description | Where to get it |
|----------|-------------|----------------|
| `DISCORD_BOT_TOKEN` | Bot authentication token | Discord Dev Portal → Bot → Token |
| `DISCORD_CLIENT_ID` | Application ID | Discord Dev Portal → General → Application ID |
| `DISCORD_GUILD_ID` | Your Discord server ID | Right-click server name → Copy Server ID |
| `DISCORD_CHANNEL_ID` | Channel for notifications | Right-click channel → Copy Channel ID |

---

## Verification

1. Run `npm run deploy-commands` → "Commands registered"
2. Run `npm run bot` → "Bot logged in as scrum-bot#1234"
3. In Discord, type `/link gavin` → "Linked your Discord account to gavin"
4. `/ticket create title:Fix login bug priority:high` → embed with ticket details
5. Check web UI → ticket appears in backlog
6. `/ticket view 1` → shows ticket details embed
7. `/ticket assign 1 alice` → "Assigned #1 to alice"
8. `/ticket list` → shows current sprint tickets
9. `/sprint status` → shows sprint progress
10. Mark a ticket as Done in web UI → notification appears in Discord channel
11. If the done ticket unblocked others → unblocked list shown in notification
