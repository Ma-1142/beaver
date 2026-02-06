// In-memory store for creator verifications (in production, use Redis or a database)
// Key: email, Value: { code, expiresAt, attempts }
export const creatorVerifications = new Map<string, { code: string; expiresAt: Date; attempts: number }>();

// Rate limiting for email sends
export const emailSendAttempts = new Map<string, { count: number; resetAt: Date }>();
