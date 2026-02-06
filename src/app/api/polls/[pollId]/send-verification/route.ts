import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { polls, responses, emailVerifications } from '@/db/schema';
import { sendVerificationSchema } from '@/lib/validation';
import { generateVerificationCode, sendVerificationEmail } from '@/lib/email';
import { canSendEmail, recordEmailSend } from '@/lib/emailRateLimit';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;
    const body = await request.json();
    const validationResult = sendVerificationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { email, locale } = validationResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if poll exists and is open
    const poll = await db.query.polls.findFirst({
      where: eq(polls.pollId, pollId),
    });

    if (!poll) {
      return NextResponse.json(
        { error: 'Poll not found' },
        { status: 404 }
      );
    }

    if (poll.status !== 'open') {
      return NextResponse.json(
        { error: 'Poll is not accepting responses' },
        { status: 403 }
      );
    }

    // Check if this is an existing user (skip verification for returning users)
    const existingResponse = await db.query.responses.findFirst({
      where: and(
        eq(responses.pollId, pollId),
        eq(responses.email, normalizedEmail)
      ),
    });

    if (existingResponse) {
      // Existing user — no need for email verification
      return NextResponse.json({
        success: true,
        isExistingUser: true,
      });
    }

    // Rate limit email sends
    const { allowed, remainingMs } = canSendEmail(pollId, normalizedEmail);
    if (!allowed) {
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return NextResponse.json(
        { error: 'EMAIL_RATE_LIMITED', remainingMinutes },
        { status: 429 }
      );
    }

    // Generate verification code
    const code = generateVerificationCode();
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Verification code for ${normalizedEmail}: ${code}`);
    }
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store verification record
    await db.insert(emailVerifications).values({
      id: nanoid(12),
      pollId,
      email: normalizedEmail,
      code,
      expiresAt,
      verified: false,
      attempts: 0,
    });

    // Record the send for rate limiting
    recordEmailSend(pollId, normalizedEmail);

    // Send verification email
    const result = await sendVerificationEmail(
      normalizedEmail,
      code,
      poll.title,
      locale || 'en'
    );

    if (!result.success) {
      // In development, allow proceeding even if email send fails (use console code)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV] Email send failed but continuing. Use code from console above.`);
      } else {
        return NextResponse.json(
          { error: 'Failed to send verification email' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      isExistingUser: false,
    });
  } catch (error) {
    console.error('Error sending verification:', error);
    return NextResponse.json(
      { error: 'Failed to send verification' },
      { status: 500 }
    );
  }
}
