const subscribers = new Set();

export function publish(event) {
  for (const handler of subscribers) {
    try { handler(event); } catch (_) {}
  }
}

export function subscribe(handler) {
  subscribers.add(handler);
  return () => subscribers.delete(handler);
}
