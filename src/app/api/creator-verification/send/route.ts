import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationSchema } from '@/lib/validation';
import { sendVerificationEmail, generateVerificationCode } from '@/lib/email';
import { creatorVerifications, emailSendAttempts } from '@/lib/creatorVerificationStore';

const VERIFICATION_EXPIRY_MINUTES = 10;
const MAX_SEND_ATTEMPTS = 3;
const SEND_RATE_LIMIT_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
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

    // Check email send rate limiting
    const sendLimit = emailSendAttempts.get(normalizedEmail);
    if (sendLimit && sendLimit.resetAt > new Date()) {
      if (sendLimit.count >= MAX_SEND_ATTEMPTS) {
        const remainingMinutes = Math.ceil((sendLimit.resetAt.getTime() - Date.now()) / 60000);
        return NextResponse.json(
          { error: 'EMAIL_RATE_LIMITED', remainingMinutes },
          { status: 429 }
        );
      }
    }

    // Generate verification code
    const code = generateVerificationCode();
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Creator verification code for ${normalizedEmail}: ${code}`);
    }
    const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_MINUTES * 60 * 1000);

    // Store verification
    creatorVerifications.set(normalizedEmail, {
      code,
      expiresAt,
      attempts: 0,
    });

    // Update rate limit counter
    const now = new Date();
    if (!sendLimit || sendLimit.resetAt <= now) {
      emailSendAttempts.set(normalizedEmail, {
        count: 1,
        resetAt: new Date(Date.now() + SEND_RATE_LIMIT_MINUTES * 60 * 1000),
      });
    } else {
      emailSendAttempts.set(normalizedEmail, {
        count: sendLimit.count + 1,
        resetAt: sendLimit.resetAt,
      });
    }

    // Send verification email
    const result = await sendVerificationEmail(normalizedEmail, code, locale || 'en');

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
      message: 'Verification code sent',
    });
  } catch (error) {
    console.error('Error sending creator verification:', error);
    return NextResponse.json(
      { error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}
