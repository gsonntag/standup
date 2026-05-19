import { publish, subscribe } from '@/lib/events';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  let unsubscribe;
  let intervalId;

  const stream = new ReadableStream({
    start(controller) {
      function send(data) {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (_) {}
      }

      unsubscribe = subscribe((event) => {
        send(JSON.stringify(event));
      });

      intervalId = setInterval(() => send('ping'), 25000);
    },
    cancel() {
      unsubscribe?.();
      clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
