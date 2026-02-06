import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailSchema } from '@/lib/validation';
import { creatorVerifications } from '@/lib/creatorVerificationStore';

const MAX_VERIFY_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  try {
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

    // Get verification record
    const verification = creatorVerifications.get(normalizedEmail);

    if (!verification) {
      return NextResponse.json(
        { error: 'VERIFICATION_NOT_FOUND', message: 'No verification pending for this email' },
        { status: 404 }
      );
    }

    // Check if expired
    if (verification.expiresAt < new Date()) {
      creatorVerifications.delete(normalizedEmail);
      return NextResponse.json(
        { error: 'VERIFICATION_EXPIRED', message: 'Verification code has expired' },
        { status: 400 }
      );
    }

    // Check attempts
    if (verification.attempts >= MAX_VERIFY_ATTEMPTS) {
      creatorVerifications.delete(normalizedEmail);
      return NextResponse.json(
        { error: 'VERIFICATION_MAX_ATTEMPTS', message: 'Too many failed attempts' },
        { status: 429 }
      );
    }

    // Verify code
    if (verification.code !== code) {
      verification.attempts++;
      return NextResponse.json(
        { error: 'VERIFICATION_CODE_MISMATCH', message: 'Incorrect verification code' },
        { status: 400 }
      );
    }

    // Code matches - generate a signed verification token
    // Token format: email:timestamp:signature
    const verifiedAt = Date.now();
    const secret = process.env.NEXTAUTH_SECRET || 'dev-secret-key';
    const dataToSign = `${normalizedEmail}:${verifiedAt}`;

    // Create a simple HMAC-like signature using Web Crypto
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
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const verifiedToken = Buffer.from(`${dataToSign}:${signatureHex}`).toString('base64');

    // Clear the verification from memory
    creatorVerifications.delete(normalizedEmail);

    return NextResponse.json({
      success: true,
      verified: true,
      verifiedToken,
    });
  } catch (error) {
    console.error('Error verifying creator email:', error);
    return NextResponse.json(
      { error: 'Failed to verify email' },
      { status: 500 }
    );
  }
}
