// In-memory rate limiter for email verification code sends
// Max 3 sends per email per 10-minute window

interface SendRecord {
  count: number;
  firstSend: number;
}

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SENDS = 3;

const sends = new Map<string, SendRecord>();

function getKey(pollId: string, email: string): string {
  return `${pollId}:${email.toLowerCase()}`;
}

// Clean up expired entries periodically
function cleanup() {
  const now = Date.now();
  sends.forEach((record, key) => {
    if (now - record.firstSend > WINDOW_MS) {
      sends.delete(key);
    }
  });
}

// Run cleanup every 5 minutes
setInterval(cleanup, 5 * 60 * 1000);

export function canSendEmail(pollId: string, email: string): { allowed: boolean; remainingMs: number } {
  const key = getKey(pollId, email);
  const record = sends.get(key);
  const now = Date.now();

  if (!record) {
    return { allowed: true, remainingMs: 0 };
  }

  // If the window has expired, allow
  if (now - record.firstSend > WINDOW_MS) {
    sends.delete(key);
    return { allowed: true, remainingMs: 0 };
  }

  if (record.count >= MAX_SENDS) {
    return { allowed: false, remainingMs: WINDOW_MS - (now - record.firstSend) };
  }

  return { allowed: true, remainingMs: 0 };
}

export function recordEmailSend(pollId: string, email: string): void {
  const key = getKey(pollId, email);
  const now = Date.now();
  const record = sends.get(key);

  if (!record || now - record.firstSend > WINDOW_MS) {
    sends.set(key, { count: 1, firstSend: now });
    return;
  }

  record.count += 1;
}
