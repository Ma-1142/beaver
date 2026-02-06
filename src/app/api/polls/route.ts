import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { polls, candidateDates, pollQuestions, questionOptions } from '@/db/schema';
import { createPollSchema } from '@/lib/validation';
import { generateSalt, hashPinWithSalt } from '@/lib/pin';
import { nanoid } from 'nanoid';
import { z } from 'zod';

// Question schema
const questionSchema = z.object({
  type: z.enum(['text', 'multiple_choice']),
  question: z.string().min(1).max(500),
  required: z.boolean().default(false),
  multiSelect: z.boolean().default(false),
  options: z.array(z.string().min(1).max(200)).optional(),
});

// Extended schema to include verifiedToken and questions
const createPollWithTokenSchema = createPollSchema.extend({
  verifiedToken: z.string().min(1, 'Verification token is required'),
  questions: z.array(questionSchema).optional(),
});

// Verify the signed token
async function verifyToken(token: string, expectedEmail: string): Promise<boolean> {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;

    const [email, timestampStr, signatureHex] = parts;
    const timestamp = parseInt(timestampStr, 10);

    // Check email matches
    if (email !== expectedEmail.toLowerCase().trim()) return false;

    // Check timestamp is within 30 minutes
    const thirtyMinutes = 30 * 60 * 1000;
    if (Date.now() - timestamp > thirtyMinutes) return false;

    // Verify signature
    const secret = process.env.NEXTAUTH_SECRET || 'dev-secret-key';
    const dataToSign = `${email}:${timestampStr}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const data = encoder.encode(dataToSign);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const expectedSignature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return signatureHex === expectedHex;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = createPollWithTokenSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { title, description, candidateDates: dates, deadline, creatorEmail, creatorPin, verifiedToken, questions } = validationResult.data;

    // Verify the token
    const isValidToken = await verifyToken(verifiedToken, creatorEmail);
    if (!isValidToken) {
      return NextResponse.json(
        { error: 'EMAIL_NOT_VERIFIED', message: 'Email verification has expired or is invalid' },
        { status: 403 }
      );
    }

    const pollId = nanoid(12);
    const adminToken = nanoid(32);

    // Hash creator PIN
    const creatorPinSalt = generateSalt();
    const creatorPinHash = await hashPinWithSalt(creatorPin, creatorPinSalt);

    // Insert poll
    await db.insert(polls).values({
      pollId,
      title,
      description: description || null,
      adminToken,
      creatorEmail: creatorEmail.toLowerCase().trim(),
      creatorPinHash,
      creatorPinSalt,
      status: 'open',
      deadline: deadline ? new Date(deadline) : null,
    });

    // Insert candidate dates (sorted by dateValue if available)
    const sortedDates = [...dates].sort((a, b) => {
      if (a.dateValue && b.dateValue) {
        return a.dateValue.localeCompare(b.dateValue);
      }
      return 0;
    });

    const dateInserts = sortedDates.map((date, index) => ({
      candidateId: nanoid(12),
      pollId,
      label: date.label,
      dateValue: date.dateValue || null,
      sortOrder: index,
    }));

    await db.insert(candidateDates).values(dateInserts);

    // Insert questions if provided
    if (questions && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const questionId = nanoid(12);

        await db.insert(pollQuestions).values({
          questionId,
          pollId,
          type: q.type,
          question: q.question,
          required: q.required,
          multiSelect: q.multiSelect || false,
          sortOrder: i,
        });

        // Insert options for multiple choice questions
        if (q.type === 'multiple_choice' && q.options) {
          for (let j = 0; j < q.options.length; j++) {
            await db.insert(questionOptions).values({
              optionId: nanoid(12),
              questionId,
              label: q.options[j],
              sortOrder: j,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      pollId,
      adminToken,
    });
  } catch (error) {
    console.error('Error creating poll:', error);
    return NextResponse.json(
      { error: 'Failed to create poll' },
      { status: 500 }
    );
  }
}
