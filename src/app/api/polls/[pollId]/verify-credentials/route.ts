import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { polls, responses, responseChoices, questionResponses } from '@/db/schema';
import { verifyCredentialsSchema } from '@/lib/validation';
import { verifyPin, verifyPinWithSalt, generateSalt, hashPinWithSalt } from '@/lib/pin';
import { isRateLimited, recordFailedAttempt, clearAttempts } from '@/lib/rateLimit';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;
    const body = await request.json();
    const validationResult = verifyCredentialsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { email, pin } = validationResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check rate limiting
    const { limited, remainingMs } = isRateLimited(pollId, normalizedEmail);
    if (limited) {
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return NextResponse.json(
        { error: 'RATE_LIMITED', remainingMinutes },
        { status: 429 }
      );
    }

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

    // Check if user is the poll creator
    if (poll.creatorEmail && poll.creatorEmail === normalizedEmail) {
      // Verify creator PIN
      if (poll.creatorPinSalt && poll.creatorPinHash) {
        const creatorPinValid = await verifyPinWithSalt(pin, poll.creatorPinSalt, poll.creatorPinHash);
        if (creatorPinValid) {
          clearAttempts(pollId, normalizedEmail);
          return NextResponse.json({
            success: true,
            isCreator: true,
            adminToken: poll.adminToken,
          });
        } else {
          const { locked, remainingMs: lockRemainingMs } = recordFailedAttempt(pollId, normalizedEmail);
          if (locked) {
            const remainingMinutes = Math.ceil(lockRemainingMs / 60000);
            return NextResponse.json(
              { error: 'RATE_LIMITED', remainingMinutes },
              { status: 429 }
            );
          }
          return NextResponse.json(
            { error: 'PIN_MISMATCH', message: 'Incorrect PIN' },
            { status: 403 }
          );
        }
      }
    }

    if (poll.status !== 'open') {
      return NextResponse.json(
        { error: 'Poll is not accepting responses' },
        { status: 403 }
      );
    }

    // Check for existing response by email
    const existingResponse = await db.query.responses.findFirst({
      where: and(
        eq(responses.pollId, pollId),
        eq(responses.email, normalizedEmail)
      ),
    });

    if (existingResponse) {
      // User exists - verify PIN
      let pinValid = false;

      if (existingResponse.pinSalt) {
        // Salted PIN verification
        pinValid = await verifyPinWithSalt(pin, existingResponse.pinSalt, existingResponse.pinHash || '');
      } else if (existingResponse.pinHash) {
        // Legacy unsalted PIN verification
        pinValid = await verifyPin(pin, existingResponse.pinHash);

        // Silent upgrade: re-hash with salt if legacy PIN matches
        if (pinValid) {
          const salt = generateSalt();
          const newHash = await hashPinWithSalt(pin, salt);
          await db
            .update(responses)
            .set({ pinHash: newHash, pinSalt: salt, updatedAt: new Date() })
            .where(eq(responses.responseId, existingResponse.responseId));
        }
      }

      if (!pinValid) {
        const { locked, remainingMs: lockRemainingMs } = recordFailedAttempt(pollId, normalizedEmail);
        if (locked) {
          const remainingMinutes = Math.ceil(lockRemainingMs / 60000);
          return NextResponse.json(
            { error: 'RATE_LIMITED', remainingMinutes },
            { status: 429 }
          );
        }
        return NextResponse.json(
          { error: 'PIN_MISMATCH', message: 'Incorrect PIN' },
          { status: 403 }
        );
      }

      // PIN matches - clear rate limit attempts and get existing choices and question answers
      clearAttempts(pollId, normalizedEmail);

      const choices = await db.query.responseChoices.findMany({
        where: eq(responseChoices.responseId, existingResponse.responseId),
      });

      const questionAnswers = await db.query.questionResponses.findMany({
        where: eq(questionResponses.responseId, existingResponse.responseId),
      });

      return NextResponse.json({
        success: true,
        isExistingUser: true,
        existingResponse: {
          responseId: existingResponse.responseId,
          name: existingResponse.name,
          email: existingResponse.email,
          notes: existingResponse.notes,
          selectedDates: choices.map((c) => c.candidateId),
          questionAnswers: questionAnswers.map((a) => ({
            questionId: a.questionId,
            textAnswer: a.textAnswer,
            selectedOptionId: a.selectedOptionId,
            selectedOptionIds: a.selectedOptionIds ? JSON.parse(a.selectedOptionIds) : null,
          })),
        },
      });
    }

    // New user - PIN will be created on submit
    return NextResponse.json({
      success: true,
      isExistingUser: false,
    });
  } catch (error) {
    console.error('Error verifying credentials:', error);
    return NextResponse.json(
      { error: 'Failed to verify credentials' },
      { status: 500 }
    );
  }
}
