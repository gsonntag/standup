const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const USERNAME = process.env.DISCORD_WEBHOOK_USERNAME || 'Bob';
const AVATAR_URL = process.env.DISCORD_WEBHOOK_AVATAR_URL || undefined;

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
    embeds: [{
      title: `🆕 #${ticket.number} ${ticket.title}`,
      url: ticketUrl(ticket.id),
      description: `Created by ${creatorName || 'someone'}${mention}`,
      color: 0x0969da,
    }],
  });
}

export function notifyTicketAssigned(ticket, { actorName, assigneeDiscordId, assigneeName } = {}) {
  const who = assigneeDiscordId ? `<@${assigneeDiscordId}>` : (assigneeName || 'someone');
  return notifyDiscord({
    embeds: [{
      title: `👤 #${ticket.number} ${ticket.title}`,
      url: ticketUrl(ticket.id),
      description: `Assigned to ${who} by ${actorName || 'someone'}`,
      color: 0x8250df,
    }],
  });
}
