import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { notifyDiscord } from '@/lib/discord';

// GitHub calls this endpoint directly, so it is intentionally unauthenticated
// and instead verifies the HMAC signature GitHub signs each delivery with.
function verifySignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function truncate(text, max = 140) {
  const firstLine = (text || '').split('\n')[0];
  return firstLine.length > max ? firstLine.slice(0, max - 1) + '…' : firstLine;
}

function pushEmbed(payload) {
  const commits = payload.commits || [];
  if (!commits.length) return null;
  const repo = payload.repository?.full_name || 'repository';
  const branch = (payload.ref || '').replace('refs/heads/', '');
  const pusher = payload.pusher?.name || payload.sender?.login || 'someone';
  const lines = commits
    .slice(0, 10)
    .map((c) => `[\`${c.id.slice(0, 7)}\`](${c.url}) ${truncate(c.message, 80)} — ${c.author?.name || ''}`);
  const extra = commits.length > 10 ? `\n…and ${commits.length - 10} more` : '';
  return {
    title: `${commits.length} new commit${commits.length === 1 ? '' : 's'} to ${repo}@${branch}`,
    description: lines.join('\n') + extra,
    url: payload.compare,
    color: 0x6e5494,
    footer: { text: `pushed by ${pusher}` },
  };
}

function pullRequestEmbed(payload) {
  if (payload.action !== 'opened') return null;
  const pr = payload.pull_request;
  const repo = payload.repository?.full_name || 'repository';
  return {
    title: `PR #${pr.number} opened: ${pr.title}`,
    description: truncate(pr.body || '', 300),
    url: pr.html_url,
    color: 0x2da44e,
    footer: { text: `${repo} — by ${pr.user?.login || 'unknown'}` },
  };
}

function workflowRunEmbed(payload) {
  const run = payload.workflow_run;
  // Only notify on a finished run that failed.
  if (payload.action !== 'completed' || run?.conclusion !== 'failure') return null;
  const repo = payload.repository?.full_name || 'repository';
  return {
    title: `❌ Workflow failed: ${run.name}`,
    description: `Branch \`${run.head_branch}\` · ${truncate(run.head_commit?.message || '', 100)}`,
    url: run.html_url,
    color: 0xd1242f,
    footer: { text: `${repo} — ${run.event}` },
  };
}

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifySignature(rawBody, signature, process.env.GITHUB_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  const event = request.headers.get('x-github-event');
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  let embed = null;
  if (event === 'push') embed = pushEmbed(payload);
  else if (event === 'pull_request') embed = pullRequestEmbed(payload);
  else if (event === 'workflow_run') embed = workflowRunEmbed(payload);

  if (embed) await notifyDiscord({ embeds: [embed] });

  // Always 200 so GitHub does not retry events we intentionally ignore.
  return NextResponse.json({ ok: true, handled: Boolean(embed) });
}
