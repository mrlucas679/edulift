// Tracks whether the last request reached the server. Set by api.ts; read by the root layout.
type Listener = (offline: boolean) => void;

let offline = false;
const listeners = new Set<Listener>();

export function setOffline(next: boolean) {
  if (next === offline) return;
  offline = next;
  listeners.forEach((l) => l(offline));
}

export function subscribeOffline(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
