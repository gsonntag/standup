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
export async function notifyDiscord({ content, embeds } = {}) {
  if (!WEBHOOK_URL) return false;
  if (!content && !embeds?.length) return false;

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: USERNAME,
        avatar_url: AVATAR_URL,
        allowed_mentions: { parse: ['users'] },
        content,
        embeds,
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

function ticketUrl(ticketId) {
  const base = process.env.APP_BASE_URL;
  return base ? `${base.replace(/\/$/, '')}/tickets?ticket=${ticketId}` : undefined;
}

export function notifyTicketCreated(ticket, { creatorName, assigneeDiscordId } = {}) {
  const mention = assigneeDiscordId ? ` · assigned to <@${assigneeDiscordId}>` : '';
  return notifyDiscord({
    content: mentionPrefix([assigneeDiscordId]),
    embeds: [{
      title: `🆕 #${ticket.number} ${ticket.title}`,
      url: ticketUrl(ticket.id),
      description: `Created by ${creatorName || 'someone'}${mention}`,
      color: 0x0969da,
    }],
  });
}

function assignedEmbed(ticket, { actorName, assigneeDiscordId, assigneeName }) {
  const who = assigneeDiscordId ? `<@${assigneeDiscordId}>` : (assigneeName || 'someone');
  return {
    title: `👤 #${ticket.number} ${ticket.title}`,
    url: ticketUrl(ticket.id),
    description: `Assigned to ${who} by ${actorName || 'someone'}`,
    color: 0x8250df,
  };
}

export function notifyTicketAssigned(ticket, { actorName, assigneeDiscordId, assigneeName, dueKind = null } = {}) {
  const embeds = [assignedEmbed(ticket, { actorName, assigneeDiscordId, assigneeName })];
  const due = dueKind ? dueEmbed(ticket, dueKind) : null;
  if (due) embeds.push(due);
  return notifyDiscord({
    content: mentionPrefix([assigneeDiscordId]),
    embeds,
  });
}

export function notifyTicketUnassigned(ticket, { actorName, oldAssigneeDiscordId, newAssigneeName } = {}) {
  if (!oldAssigneeDiscordId) return false;
  const destination = newAssigneeName ? `reassigned to ${newAssigneeName}` : 'unassigned from you';
  return notifyDiscord({
    content: mentionPrefix([oldAssigneeDiscordId]),
    embeds: [{
      title: `🔄 #${ticket.number} ${ticket.title}`,
      url: ticketUrl(ticket.id),
      description: `${destination} by ${actorName || 'someone'}`,
      color: 0x6e7781,
    }],
  });
}

export function notifyComment(ticket, { actorName, body, pingDiscordIds = [] } = {}) {
  return notifyDiscord({
    content: mentionPrefix(pingDiscordIds),
    embeds: [{
      title: `💬 #${ticket.number} ${ticket.title}`,
      url: ticketUrl(ticket.id),
      description: `${actorName || 'Someone'} commented:\n${(body || '').slice(0, 500)}`,
      color: 0x57606a,
    }],
  });
}

export function notifyStatusChanged(ticket, { actorName, oldStatus, newStatus, pingDiscordIds = [] } = {}) {
  const from = STATUS_LABELS[oldStatus] || oldStatus;
  const to = STATUS_LABELS[newStatus] || newStatus;
  return notifyDiscord({
    content: mentionPrefix(pingDiscordIds),
    embeds: [{
      title: `📋 #${ticket.number} ${ticket.title}`,
      url: ticketUrl(ticket.id),
      description: `Status: ${from} → **${to}** (by ${actorName || 'someone'})`,
      color: 0x0969da,
    }],
  });
}

export function notifyBlockerResolved(ticket, { resolvedBlocker, pingDiscordIds = [] } = {}) {
  const blockerRef = resolvedBlocker ? `#${resolvedBlocker.number} ${resolvedBlocker.title}` : 'its last blocker';
  return notifyDiscord({
    content: mentionPrefix(pingDiscordIds),
    embeds: [{
      title: `✅ #${ticket.number} ${ticket.title} is unblocked`,
      url: ticketUrl(ticket.id),
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
    url: ticketUrl(ticket.id),
    description: `This ticket ${variant.text} (due ${ticket.due_date}).`,
    color: variant.color,
  };
}

export function notifyDueReminder(ticket, { kind, assigneeDiscordId } = {}) {
  const embed = dueEmbed(ticket, kind);
  if (!embed) return false;
  return notifyDiscord({
    content: mentionPrefix([assigneeDiscordId]),
    embeds: [embed],
  });
}
