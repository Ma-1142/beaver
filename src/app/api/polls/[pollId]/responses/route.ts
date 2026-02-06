import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { polls, responses, responseChoices, emailVerifications, questionResponses } from '@/db/schema';
import { submitResponseSchema } from '@/lib/validation';
import { generateSalt, hashPinWithSalt, verifyPinWithSalt, verifyPin } from '@/lib/pin';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;
    const body = await request.json();
    const validationResult = submitResponseSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { email, name, selectedDates, respondentToken, pin, notes, questionAnswers } = validationResult.data;
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

    // Check if deadline has passed (server-side validation)
    if (poll.deadline && new Date(poll.deadline) < new Date()) {
      return NextResponse.json(
        { error: 'Poll deadline has passed' },
        { status: 403 }
      );
    }

    // Check for existing response by email
    const existingResponseByEmail = await db.query.responses.findFirst({
      where: and(
        eq(responses.pollId, pollId),
        eq(responses.email, normalizedEmail)
      ),
    });

    let responseId: string;
    let isUpdate = false;

    if (existingResponseByEmail) {
      // Verify PIN matches
      let pinValid = false;

      if (existingResponseByEmail.pinSalt) {
        pinValid = await verifyPinWithSalt(pin, existingResponseByEmail.pinSalt, existingResponseByEmail.pinHash || '');
      } else if (existingResponseByEmail.pinHash) {
        pinValid = await verifyPin(pin, existingResponseByEmail.pinHash);
      }

      if (!pinValid) {
        return NextResponse.json(
          { error: 'PIN_MISMATCH', message: 'Incorrect PIN for this email address.' },
          { status: 403 }
        );
      }

      // Update existing response
      responseId = existingResponseByEmail.responseId;
      isUpdate = true;

      // Re-hash with salt if legacy (silent upgrade)
      const updateData: Record<string, unknown> = {
        respondentToken,
        name,
        notes: notes || null,
        updatedAt: new Date(),
      };

      if (!existingResponseByEmail.pinSalt) {
        const salt = generateSalt();
        const newHash = await hashPinWithSalt(pin, salt);
        updateData.pinHash = newHash;
        updateData.pinSalt = salt;
      }

      await db
        .update(responses)
        .set(updateData)
        .where(eq(responses.responseId, responseId));

      // Delete old choices
      await db
        .delete(responseChoices)
        .where(eq(responseChoices.responseId, responseId));

      // Delete old question responses
      await db
        .delete(questionResponses)
        .where(eq(questionResponses.responseId, responseId));
    } else {
      // New user - require email verification
      const verificationRecords = await db
        .select()
        .from(emailVerifications)
        .where(
          and(
            eq(emailVerifications.pollId, pollId),
            eq(emailVerifications.email, normalizedEmail),
            eq(emailVerifications.verified, true)
          )
        )
        .orderBy(desc(emailVerifications.createdAt))
        .limit(1);

      if (verificationRecords.length === 0) {
        return NextResponse.json(
          { error: 'EMAIL_NOT_VERIFIED', message: 'Email must be verified before submitting' },
          { status: 403 }
        );
      }

      // Create new response with salted PIN
      responseId = nanoid(12);
      const salt = generateSalt();
      const pinHash = await hashPinWithSalt(pin, salt);

      await db.insert(responses).values({
        responseId,
        pollId,
        respondentToken,
        name,
        email: normalizedEmail,
        pinHash,
        pinSalt: salt,
        notes: notes || null,
      });
    }

    // Insert new choices
    const choiceInserts = selectedDates.map((candidateId) => ({
      responseId,
      candidateId,
    }));

    if (choiceInserts.length > 0) {
      await db.insert(responseChoices).values(choiceInserts);
    }

    // Insert question answers
    if (questionAnswers && questionAnswers.length > 0) {
      const questionAnswerInserts = questionAnswers
        .filter((a) => a.textAnswer || a.selectedOptionId || (a.selectedOptionIds && a.selectedOptionIds.length > 0))
        .map((answer) => ({
          id: nanoid(12),
          responseId,
          questionId: answer.questionId,
          textAnswer: answer.textAnswer || null,
          selectedOptionId: answer.selectedOptionId || null,
          selectedOptionIds: answer.selectedOptionIds && answer.selectedOptionIds.length > 0
            ? JSON.stringify(answer.selectedOptionIds)
            : null,
        }));

      if (questionAnswerInserts.length > 0) {
        await db.insert(questionResponses).values(questionAnswerInserts);
      }
    }

    return NextResponse.json({
      success: true,
      responseId,
      isUpdate,
    });
  } catch (error) {
    console.error('Error submitting response:', error);
    return NextResponse.json(
      { error: 'Failed to submit response' },
      { status: 500 }
    );
  }
}
