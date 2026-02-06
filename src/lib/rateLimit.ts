// In-memory rate limiter for PIN verification attempts
// 5 failed attempts per email/poll → 15-minute lockout

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, AttemptRecord>();

function getKey(pollId: string, email: string): string {
  return `${pollId}:${email.toLowerCase()}`;
}

// Clean up expired entries periodically
function cleanup() {
  const now = Date.now();
  attempts.forEach((record, key) => {
    if (record.lockedUntil && now > record.lockedUntil) {
      attempts.delete(key);
    } else if (now - record.firstAttempt > WINDOW_MS) {
      attempts.delete(key);
    }
  });
}

// Run cleanup every 5 minutes
setInterval(cleanup, 5 * 60 * 1000);

export function isRateLimited(pollId: string, email: string): { limited: boolean; remainingMs: number } {
  const key = getKey(pollId, email);
  const record = attempts.get(key);
  const now = Date.now();

  if (!record) {
    return { limited: false, remainingMs: 0 };
  }

  if (record.lockedUntil) {
    if (now < record.lockedUntil) {
      return { limited: true, remainingMs: record.lockedUntil - now };
    }
    // Lock expired, clear record
    attempts.delete(key);
    return { limited: false, remainingMs: 0 };
  }

  // If the window has expired, clear the record
  if (now - record.firstAttempt > WINDOW_MS) {
    attempts.delete(key);
    return { limited: false, remainingMs: 0 };
  }

  return { limited: false, remainingMs: 0 };
}

export function recordFailedAttempt(pollId: string, email: string): { locked: boolean; remainingMs: number } {
  const key = getKey(pollId, email);
  const now = Date.now();
  let record = attempts.get(key);

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    record = { count: 1, firstAttempt: now, lockedUntil: null };
    attempts.set(key, record);
    return { locked: false, remainingMs: 0 };
  }

  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + WINDOW_MS;
    return { locked: true, remainingMs: WINDOW_MS };
  }

  return { locked: false, remainingMs: 0 };
}

export function clearAttempts(pollId: string, email: string): void {
  const key = getKey(pollId, email);
  attempts.delete(key);
}
