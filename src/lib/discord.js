import { STATUSES } from './constants';
import { getDb } from './db';

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const USERNAME = process.env.DISCORD_WEBHOOK_USERNAME || 'Bob';
const AVATAR_URL = process.env.DISCORD_WEBHOOK_AVATAR_URL || undefined;

const STATUS_LABELS = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));

function mentionPrefix(discordIds = []) {
  const unique = [...new Set(discordIds.filter(Boolean))];
  return unique.length ? unique.map((id) => `<@${id}>`).join(' ') + ' ' : '';
}

const PING_DEBOUNCE_MS = 10 * 60 * 1000;

/**
 * Decide who actually gets @mentioned. `importantIds` (review requests, direct
 * @mentions, new assignments, due reminders) always ping. `pingIds` only ping
 * if they haven't been pinged in the last 10 minutes — otherwise the embed
 * still posts, just without their mention. Records the ping time for everyone
 * we do ping so the window slides forward.
 */
function resolvePings({ pingIds = [], importantIds = [] }) {
  const important = [...new Set(importantIds.filter(Boolean))];
  const debounced = [...new Set(pingIds.filter(Boolean))].filter((id) => !important.includes(id));
  const db = getDb();
  const now = Date.now();
  const allowed = new Set(important);
  const last = db.prepare('SELECT last_pinged_at FROM discord_ping_log WHERE discord_id = ?');
  for (const id of debounced) {
    const row = last.get(id);
    if (!row || now - row.last_pinged_at >= PING_DEBOUNCE_MS) allowed.add(id);
  }
  const record = db.prepare(`
    INSERT INTO discord_ping_log (discord_id, last_pinged_at) VALUES (?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET last_pinged_at = excluded.last_pinged_at
  `);
  for (const id of allowed) record.run(id, now);
  return [...allowed];
}

/**
 * Discord IDs of the people who care about a ticket — its assignee and watchers,
 * optionally the users @mentioned in a given comment — minus the actor who
 * triggered the event (so we never ping someone for their own action).
 */
export function ticketStakeholderDiscordIds(ticketId, { excludeUserId = null, mentionsForCommentId = null } = {}) {
  const db = getDb();
  const ids = new Set();
  const ticket = db.prepare('SELECT assignee_id FROM tickets WHERE id = ?').get(ticketId);
  if (ticket?.assignee_id) ids.add(ticket.assignee_id);
  for (const a of db.prepare('SELECT user_id FROM ticket_assignees WHERE ticket_id = ?').all(ticketId)) {
    ids.add(a.user_id);
  }
  for (const r of db.prepare('SELECT user_id FROM ticket_reviewers WHERE ticket_id = ?').all(ticketId)) {
    ids.add(r.user_id);
  }
  for (const w of db.prepare('SELECT user_id FROM ticket_watchers WHERE ticket_id = ?').all(ticketId)) {
    ids.add(w.user_id);
  }
  if (mentionsForCommentId) {
    for (const m of db.prepare('SELECT user_id FROM mentions WHERE comment_id = ?').all(mentionsForCommentId)) {
      ids.add(m.user_id);
    }
  }
  if (excludeUserId) ids.delete(excludeUserId);
  if (!ids.size) return [];
  const placeholders = [...ids].map(() => '?').join(',');
  return db.prepare(`SELECT discord_id FROM users WHERE id IN (${placeholders}) AND discord_id IS NOT NULL`)
    .all(...ids)
    .map((r) => r.discord_id);
}

/**
 * Fire-and-forget post to a Discord channel webhook. Never throws: notification
 * delivery must not break the request that triggered it. Returns true on a 2xx.
 */
export async function notifyDiscord({ content, embeds, pingIds, importantIds } = {}) {
  if (!WEBHOOK_URL) return false;

  // When the caller passes ping targets, resolve them through the debounce and
  // build the mention string ourselves; otherwise use the literal content.
  let mentionContent = content;
  if (pingIds !== undefined || importantIds !== undefined) {
    mentionContent = mentionPrefix(resolvePings({ pingIds, importantIds }));
  }
  if (!mentionContent && !embeds?.length) return false;

  // Append a visible "View ticket" link to any embed that carries a ticket URL.
  const withLinks = embeds?.map((embed) => {
    if (!embed.url) return embed;
    const link = `[View ticket →](${embed.url})`;
    return {
      ...embed,
      description: embed.description ? `${embed.description}\n\n${link}` : link,
    };
  });

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: USERNAME,
        avatar_url: AVATAR_URL,
        allowed_mentions: { parse: ['users'] },
        content: mentionContent,
        embeds: withLinks,
      }),
    });
    if (!res.ok) {
      console.error(`Discord webhook failed: ${res.status} ${await res.text().catch(() => '')}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Discord webhook error:', err);
    return false;
  }
}

function ticketUrl(ticketNumber) {
  const base = process.env.APP_BASE_URL;
  return base ? `${base.replace(/\/$/, '')}/ticket/${ticketNumber}` : undefined;
}

export function notifyTicketCreated(ticket, { creatorName, assigneeDiscordId, assigneeDiscordIds } = {}) {
  const ids = assigneeDiscordIds || (assigneeDiscordId ? [assigneeDiscordId] : []);
  const mention = ids.length ? ` · assigned to ${ids.map((id) => `<@${id}>`).join(', ')}` : '';
  return notifyDiscord({
    importantIds: ids,
    embeds: [{
      title: `🆕 #${ticket.number} ${ticket.title}`,
      url: ticketUrl(ticket.number),
      description: `Created by ${creatorName || 'someone'}${mention}`,
      color: 0x0969da,
    }],
  });
}

function assignedEmbed(ticket, { actorName, assigneeDiscordId, assigneeName }) {
  const who = assigneeDiscordId ? `<@${assigneeDiscordId}>` : (assigneeName || 'someone');
  return {
    title: `👤 #${ticket.number} ${ticket.title}`,
    url: ticketUrl(ticket.number),
    description: `Assigned to ${who} by ${actorName || 'someone'}`,
    color: 0x8250df,
  };
}

export function notifyTicketAssigned(ticket, { actorName, assigneeDiscordId, assigneeName, dueKind = null } = {}) {
  const embeds = [assignedEmbed(ticket, { actorName, assigneeDiscordId, assigneeName })];
  const due = dueKind ? dueEmbed(ticket, dueKind) : null;
  if (due) embeds.push(due);
  return notifyDiscord({
    importantIds: [assigneeDiscordId],
    embeds,
  });
}

export function notifyTicketUnassigned(ticket, { actorName, oldAssigneeDiscordId, newAssigneeName } = {}) {
  if (!oldAssigneeDiscordId) return false;
  const destination = newAssigneeName ? `reassigned to ${newAssigneeName}` : 'unassigned from you';
  return notifyDiscord({
    pingIds: [oldAssigneeDiscordId],
    embeds: [{
      title: `🔄 #${ticket.number} ${ticket.title}`,
      url: ticketUrl(ticket.number),
      description: `${destination} by ${actorName || 'someone'}`,
      color: 0x6e7781,
    }],
  });
}

export function notifyReviewRequested(ticket, { actorName, reviewerDiscordIds = [] } = {}) {
  if (!reviewerDiscordIds.length) return false;
  return notifyDiscord({
    importantIds: reviewerDiscordIds,
    embeds: [{
      title: `Review requested on #${ticket.number}`,
      url: ticketUrl(ticket.number),
      description: `${actorName || 'Someone'} requested your review on #${ticket.number} ${ticket.title}`,
      color: 0x5e6ad2,
    }],
  });
}

export function notifyComment(ticket, { actorName, body, pingDiscordIds = [], mentionDiscordIds = [] } = {}) {
  return notifyDiscord({
    pingIds: pingDiscordIds,
    importantIds: mentionDiscordIds,
    embeds: [{
      title: `💬 #${ticket.number} ${ticket.title}`,
      url: ticketUrl(ticket.number),
      description: `${actorName || 'Someone'} commented:\n${(body || '').slice(0, 500)}`,
      color: 0x57606a,
    }],
  });
}

export function notifyStatusChanged(ticket, { actorName, oldStatus, newStatus, pingDiscordIds = [] } = {}) {
  const from = STATUS_LABELS[oldStatus] || oldStatus;
  const to = STATUS_LABELS[newStatus] || newStatus;
  return notifyDiscord({
    pingIds: pingDiscordIds,
    embeds: [{
      title: `📋 #${ticket.number} ${ticket.title}`,
      url: ticketUrl(ticket.number),
      description: `Status: ${from} → **${to}** (by ${actorName || 'someone'})`,
      color: 0x0969da,
    }],
  });
}

export function notifyBlockerResolved(ticket, { resolvedBlocker, pingDiscordIds = [] } = {}) {
  const blockerRef = resolvedBlocker ? `#${resolvedBlocker.number} ${resolvedBlocker.title}` : 'its last blocker';
  return notifyDiscord({
    pingIds: pingDiscordIds,
    embeds: [{
      title: `✅ #${ticket.number} ${ticket.title} is unblocked`,
      url: ticketUrl(ticket.number),
      description: `Blocker ${blockerRef} is done — this ticket is ready to start.`,
      color: 0x2da44e,
    }],
  });
}

const DUE_VARIANTS = {
  overdue: { emoji: '🔴', text: 'is overdue', color: 0xd1242f },
  today: { emoji: '🟠', text: 'is due today', color: 0xbf8700 },
  soon: { emoji: '🟡', text: 'is due tomorrow', color: 0xd4a72c },
};

function dueEmbed(ticket, kind) {
  const variant = DUE_VARIANTS[kind];
  if (!variant) return null;
  return {
    title: `${variant.emoji} #${ticket.number} ${ticket.title}`,
    url: ticketUrl(ticket.number),
    description: `This ticket ${variant.text} (due ${ticket.due_date}).`,
    color: variant.color,
  };
}

export function notifyDueReminder(ticket, { kind, assigneeDiscordId } = {}) {
  const embed = dueEmbed(ticket, kind);
  if (!embed) return false;
  const ids = Array.isArray(assigneeDiscordId) ? assigneeDiscordId : [assigneeDiscordId];
  return notifyDiscord({
    importantIds: ids,
    embeds: [embed],
  });
}
