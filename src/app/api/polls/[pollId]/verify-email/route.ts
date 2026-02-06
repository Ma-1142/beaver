import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { polls, emailVerifications } from '@/db/schema';
import { verifyEmailSchema } from '@/lib/validation';
import { eq, and, desc } from 'drizzle-orm';

const MAX_VERIFICATION_ATTEMPTS = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;
    const body = await request.json();
    const validationResult = verifyEmailSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { email, code } = validationResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if poll exists
    const poll = await db.query.polls.findFirst({
      where: eq(polls.pollId, pollId),
    });

    if (!poll) {
      return NextResponse.json(
        { error: 'Poll not found' },
        { status: 404 }
      );
    }

    // Find the most recent verification record for this email/poll
    const verificationRecords = await db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.pollId, pollId),
          eq(emailVerifications.email, normalizedEmail),
          eq(emailVerifications.verified, false)
        )
      )
      .orderBy(desc(emailVerifications.createdAt))
      .limit(1);

    const verification = verificationRecords[0];

    if (!verification) {
      return NextResponse.json(
        { error: 'VERIFICATION_NOT_FOUND', message: 'No pending verification found' },
        { status: 404 }
      );
    }

    // Check if expired
    if (new Date() > verification.expiresAt) {
      return NextResponse.json(
        { error: 'VERIFICATION_EXPIRED', message: 'Verification code has expired' },
        { status: 410 }
      );
    }

    // Check attempt count
    if (verification.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      return NextResponse.json(
        { error: 'VERIFICATION_MAX_ATTEMPTS', message: 'Too many verification attempts' },
        { status: 429 }
      );
    }

    // Increment attempts
    await db
      .update(emailVerifications)
      .set({ attempts: verification.attempts + 1 })
      .where(eq(emailVerifications.id, verification.id));

    // Check code
    if (verification.code !== code) {
      return NextResponse.json(
        { error: 'VERIFICATION_CODE_MISMATCH', message: 'Incorrect verification code' },
        { status: 403 }
      );
    }

    // Mark as verified
    await db
      .update(emailVerifications)
      .set({ verified: true })
      .where(eq(emailVerifications.id, verification.id));

    return NextResponse.json({
      success: true,
      verified: true,
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    return NextResponse.json(
      { error: 'Failed to verify email' },
      { status: 500 }
    );
  }
}
