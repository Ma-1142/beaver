# Email + PIN Authentication Migration

## Status: Code Complete, Needs Configuration

The migration from Name+PIN to Email+PIN authentication has been implemented. The database schema is already updated.

---

## Before Running the App

### 1. Set up Resend API key

Sign up at [resend.com](https://resend.com) and get an API key, then update `.env.local`:

```
RESEND_API_KEY=re_your_actual_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

You'll also need to verify your sending domain in Resend's dashboard. Until then, you can only send to the email associated with your Resend account.

### 2. Verify the database schema

The schema was already pushed via `npm run db:push`. If you reset or recreate the database, run it again:

```
npm run db:push
```

---

## What Changed

### User Flow (After)

- **New user:** Enter email + display name + PIN -> Verify email (6-digit code) -> Select dates -> Submit
- **Returning user:** Enter email + PIN -> (PIN verified, skip email check, name pre-filled) -> Select dates -> Submit

### New Files

| File | Purpose |
|------|---------|
| `src/lib/rateLimit.ts` | PIN attempt rate limiter (5 fails -> 15-min lockout) |
| `src/lib/emailRateLimit.ts` | Email send rate limiter (3 sends per 10 min) |
| `src/lib/email.ts` | Resend wrapper + verification code generator |
| `src/app/api/polls/[pollId]/send-verification/route.ts` | Send 6-digit code to email |
| `src/app/api/polls/[pollId]/verify-email/route.ts` | Verify 6-digit code |
| `.env.local` | Resend API credentials |

### Modified Files

| File | Changes |
|------|---------|
| `src/db/schema.ts` | Added `email`, `pinSalt` columns; `emailVerifications` table; `pollEmailIdx` index |
| `src/lib/pin.ts` | Added `generateSalt()`, `hashPinWithSalt()`, `verifyPinWithSalt()` |
| `src/lib/validation.ts` | Added email validation; changed `pinHash` to `pin` (raw); new schemas |
| `src/app/api/polls/[pollId]/verify-credentials/route.ts` | Email-based lookup, rate limiting, salted PIN |
| `src/app/api/polls/[pollId]/responses/route.ts` | Email as identity, server-side hashing, email verification gate |
| `src/app/api/polls/[pollId]/admin/[adminToken]/route.ts` | Email in admin response data |
| `src/app/api/polls/[pollId]/route.ts` | Email in existing response data |
| `src/components/poll/ResponseForm.tsx` | 3-step flow, email field, no client-side hashing |
| `src/components/poll/AdminDashboard.tsx` | Email column in respondents table |
| `messages/en.json` | Email/verification/rate-limit strings |
| `messages/ja.json` | Email/verification/rate-limit strings (Japanese) |

### Backward Compatibility

- Legacy responses (no email/salt) still work via unsalted PIN fallback
- Legacy PINs are silently upgraded to salted hashes on next successful login
- Admin dashboard shows "N/A" for legacy responses without email

---

## Testing Checklist

- [ ] Configure `.env.local` with real Resend credentials
- [ ] New user flow: email + name + PIN -> verify email code -> select dates -> submit
- [ ] Returning user flow: same email + correct PIN -> skips verification -> loads previous selections
- [ ] Wrong PIN: shows error; 5 wrong attempts -> 15-min lockout message
- [ ] Wrong verification code: shows error; 5 wrong codes -> code invalidated
- [ ] Email send limit: 3 codes in 10 min -> 4th blocked
- [ ] Admin dashboard: email column visible alongside display name
- [ ] Legacy responses: still visible in admin with "N/A" for email
- [ ] Public results page: no email or name data exposed
- [ ] `npm run build` passes with no errors
