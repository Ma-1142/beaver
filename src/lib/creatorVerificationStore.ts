// In-memory store for creator verifications (in production, use Redis or a database)
// Using globalThis to persist across hot reloads in development

type VerificationData = { code: string; expiresAt: Date; attempts: number };
type RateLimitData = { count: number; resetAt: Date };

// Extend globalThis type (var is required for global declarations)
/* eslint-disable no-var */
declare global {
  var creatorVerifications: Map<string, VerificationData> | undefined;
  var emailSendAttempts: Map<string, RateLimitData> | undefined;
}
/* eslint-enable no-var */

// Key: email, Value: { code, expiresAt, attempts }
export const creatorVerifications =
  globalThis.creatorVerifications ?? new Map<string, VerificationData>();

// Rate limiting for email sends
export const emailSendAttempts =
  globalThis.emailSendAttempts ?? new Map<string, RateLimitData>();

// Persist to globalThis for dev hot reloads
if (process.env.NODE_ENV !== 'production') {
  globalThis.creatorVerifications = creatorVerifications;
  globalThis.emailSendAttempts = emailSendAttempts;
}
